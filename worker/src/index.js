/**
 * SpaceTek — Worker (frete + pedidos + eventos).
 *
 * Rotas:
 *   GET   /health          diagnostico (provedor, token, KV, allowlist)
 *   POST  /quote           cotacao real de frete { cepOrigem?, cep, items[] }
 *   POST  /event           registra evento de uso (visita/produto/carrinho/admin)
 *   GET   /analytics?dia=  contadores do dia
 *   POST  /order           registra pedido (checkout do site)
 *   GET   /orders          lista pedidos (admin; exige ID token do Firebase)
 *   PATCH /orders/:id      atualiza status do pedido (admin; exige ID token)
 *
 * Segredos (via `wrangler secret put`):
 *   SUPERFRETE_TOKEN  — token da conta SuperFrete (quando PROVEDOR = "superfrete")
 *   FRENET_TOKEN      — token da conta Frenet     (quando PROVEDOR = "frenet")
 *   PROVEDOR_TOKEN    — fallback para o Frenet
 *   CEP_ORIGEM        — CEP de origem (fallback; o site tambem envia)
 *
 * Vars (wrangler.toml): PROVEDOR, USER_AGENT, ALLOWED_ORIGINS,
 *                       SUPERFRETE_URL, SUPERFRETE_SERVICES,
 *                       ADMIN_EMAILS, FIREBASE_PROJECT_ID
 *
 * Bindings KV (wrangler.toml): FRETE_CACHE, PEDIDOS, EVENTOS
 */

const VERSAO = "2026-10-12.19";

/* Limites de seguranca da cotacao. */
const LIMITE_ITENS = 20;
const LIMITE_KG = 100;

/* Cache das opcoes de frete (KV FRETE_CACHE): 1 hora. */
const CACHE_TTL = 3600;

/* Cache das chaves publicas do Firebase (JWKS): 1 hora. */
const JWKS_TTL = 3600;
let jwksCache = { expires: 0, keys: [] };

/* Rate limit por instancia: no maximo 4 cotacoes por segundo. */
const BUCKET_MAX = 4;
const BUCKET_WINDOW = 1000;
const bucket = [];

function limparBucket(agora) {
  while (bucket.length && agora - bucket[0] > BUCKET_WINDOW) bucket.shift();
}

function podeCotar() {
  const agora = Date.now();
  limparBucket(agora);
  if (bucket.length >= BUCKET_MAX) return false;
  bucket.push(agora);
  return true;
}

/* ---------- CORS ---------- */

function origemPermitida(env, origin) {
  if (!origin) return "";
  const lista = String(env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
  return lista.includes(origin) ? origin : "";
}

function corsHeaders(env, origin) {
  const ok = origemPermitida(env, origin);
  const h = {
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "POST, GET, PATCH, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    /* Beacon (sendBeacon) e uma requisicao "credentialed": sem este cabecalho
       o navegador bloqueia o preflight e o evento nao e registrado. */
    "Access-Control-Allow-Credentials": "true"
  };
  if (ok) h["Access-Control-Allow-Origin"] = ok;
  return h;
}

function json(obj, status, env, origin) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: Object.assign({ "Content-Type": "application/json; charset=utf-8" }, corsHeaders(env, origin))
  });
}

const soDigitos = (v) => String(v || "").replace(/\D/g, "");

/* ---------- Provedor de frete ---------- */

/* Provedor ativo (frenet | superfrete). */
function provedorAtivo(env) {
  return String((env && env.PROVEDOR) || "superfrete").toLowerCase();
}

/* Token do provedor: remove espacos/quebras de linha que vem do copy/paste.
   Cada provedor tem seu proprio secret (FRENET_TOKEN / SUPERFRETE_TOKEN).
   PROVEDOR_TOKEN e fallback do Frenet. */
function tokenProvedor(env) {
  const raw = provedorAtivo(env) === "superfrete"
    ? (env && env.SUPERFRETE_TOKEN)
    : ((env && env.FRENET_TOKEN) || (env && env.PROVEDOR_TOKEN));
  return String(raw || "").trim().replace(/\s+/g, "");
}

/* Valida os itens do pedido de frete. Retorna null se algum item estiver
   invalido (sem peso/dimensoes) ou se passar dos limites. */
function normalizarItems(items) {
  if (!Array.isArray(items) || items.length === 0) return null;
  if (items.length > LIMITE_ITENS) return null;
  const out = [];
  let peso = 0;
  let valor = 0;
  for (const it of items) {
    const w = Number(it.width);
    const h = Number(it.height);
    const l = Number(it.length);
    const kg = Number(it.weight);
    const q = Math.max(1, parseInt(it.quantity, 10) || 1);
    if (!(w > 0 && h > 0 && l > 0 && kg > 0)) return null;
    peso += kg * q;
    valor += (Number(it.insurance_value) || 0) * q;
    out.push({ id: String(it.id || "item"), width: w, height: h, length: l, weight: kg, quantity: q });
  }
  if (peso > LIMITE_KG) return null;
  return { itens: out, peso, valor: Math.round(valor * 100) / 100 };
}

/* Tabela por regiao (1o digito do CEP) usada quando o provedor falha.
   O site tem a tabela completa no painel; aqui e so uma reserva. */
const TABELA_REGIOES = { 0: 15, 1: 15, 2: 20, 3: 20, 4: 32, 5: 32, 6: 35, 7: 28, 8: 22, 9: 22 };

function fallbackEstimado(cepDestino) {
  const d = soDigitos(cepDestino);
  if (d.length !== 8) return [];
  const base = Number(TABELA_REGIOES[Number(d[0])]);
  if (!isFinite(base)) return [];
  return [
    { id: "pac-est", servico: "PAC (estimado)", empresa: "Correios", preco: Math.round(base * 100) / 100, prazo: 7, estimado: true },
    { id: "sedex-est", servico: "SEDEX (estimado)", empresa: "Correios", preco: Math.round(base * 1.21 * 100) / 100, prazo: 3, estimado: true }
  ];
}

/* ---------- Provedor: Frenet ---------- */

async function cotarFrenet(env, cepOrigem, cep, dados) {
  if (!podeCotar()) throw new Error("limite");
  const resp = await fetch("https://api.frenet.com.br/shipping/quote", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "token": tokenProvedor(env)
    },
    body: JSON.stringify({
      SellerCEP: cepOrigem,
      RecipientCEP: cep,
      ShipmentInvoiceValue: dados.valor,
      RecipientCountry: "BR",
      ShippingItemArray: dados.itens.map((i) => ({
        Height: i.height,
        Length: i.length,
        Width: i.width,
        Weight: i.weight,
        Quantity: i.quantity
      }))
    })
  });
  const raw = await resp.text();
  if (!resp.ok) throw new Error("frenet http " + resp.status + " -> " + raw.slice(0, 300));
  let data;
  try { data = JSON.parse(raw); }
  catch (e) { throw new Error("frenet resposta nao-JSON: " + raw.slice(0, 200)); }
  if (data && data.error) throw new Error("frenet erro: " + JSON.stringify(data).slice(0, 300));
  /* A Frenet pode responder HTTP 200 com {"Message":"Acesso negado!"} no corpo. */
  if (data && data.Message && !data.ShippingSevicesArray) {
    throw new Error("frenet recusou a chamada: " + String(data.Message).slice(0, 200));
  }
  const arr = data.ShippingSevicesArray || data.ShippingServicesArray || [];
  return arr
    .filter((s) => !s.Error && s.ShippingPrice != null)
    .map((s) => ({
      id: String(s.ServiceCode || s.ServiceDescription || ""),
      servico: s.ServiceDescription || "Frete",
      empresa: s.Carrier || s.CarrierName || "",
      preco: Number(String(s.ShippingPrice).replace(",", ".")),
      prazo: s.DeliveryTime != null ? parseInt(s.DeliveryTime, 10) : null
    }))
    .filter((o) => isFinite(o.preco) && o.preco > 0);
}

/* ---------- Provedor: SuperFrete ----------
   Doc: POST https://api.superfrete.com/api/v0/calculator
   Headers: Authorization: Bearer {token} + User-Agent: NomeApp/versao (email@tecnico.com)
   Body: { from:{postal_code}, to:{postal_code}, services:"1,2,17",
           options:{own_hand,receipt,insurance_value,use_insurance_value},
           products:[{quantity,weight,height,width,length}] }
   Resposta: array de { id, name, price, delivery_time, delivery_range, company:{name}, has_error } */

async function cotarSuperFrete(env, cepOrigem, cep, dados) {
  if (!podeCotar()) throw new Error("limite");
  const url = env.SUPERFRETE_URL || "https://api.superfrete.com/api/v0/calculator";
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "Authorization": "Bearer " + tokenProvedor(env),
      "User-Agent": env.USER_AGENT || "SpaceTek Frete (contato@spacetek.com)"
    },
    body: JSON.stringify({
      from: { postal_code: cepOrigem },
      to: { postal_code: cep },
      services: env.SUPERFRETE_SERVICES || "1,2,17",
      options: {
        own_hand: false,
        receipt: false,
        insurance_value: dados.valor,
        use_insurance_value: dados.valor > 0
      },
      products: dados.itens.map((i) => ({
        quantity: i.quantity,
        weight: i.weight,
        height: i.height,
        width: i.width,
        length: i.length
      }))
    })
  });
  const raw = await resp.text();
  if (!resp.ok) throw new Error("superfrete http " + resp.status + " -> " + raw.slice(0, 300));
  let data;
  try { data = JSON.parse(raw); }
  catch (e) { throw new Error("superfrete resposta nao-JSON: " + raw.slice(0, 200)); }
  const arr = Array.isArray(data) ? data : (data.services || data.data || []);
  return arr
    /* has_error:true = servico nao atende o pacote (ex.: Mini Envios) -> esconder. */
    .filter((s) => s && !s.has_error && !s.error && (s.price != null || s.custom_price != null))
    .map((s) => ({
      id: String(s.id || s.service || s.name || ""),
      servico: s.name || s.service || "Frete",
      empresa: (s.company && (s.company.name || s.company)) || s.carrier_name || "",
      preco: Number(String(s.custom_price != null ? s.custom_price : s.price).replace(",", ".")),
      prazo: s.custom_delivery_time != null ? parseInt(s.custom_delivery_time, 10)
        : (s.delivery_time != null ? parseInt(s.delivery_time, 10)
          : (s.delivery_range && s.delivery_range.max != null ? parseInt(s.delivery_range.max, 10) : null))
    }))
    .filter((o) => isFinite(o.preco) && o.preco > 0);
}

async function cotar(env, cepOrigem, cep, dados) {
  if (provedorAtivo(env) === "superfrete") return cotarSuperFrete(env, cepOrigem, cep, dados);
  return cotarFrenet(env, cepOrigem, cep, dados);
}

/* ---------- Utilidades ---------- */

async function sha256Hex(s) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function base64urlToUint8(b64url) {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((b64url.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/* ---------- Autenticacao do admin (ID token do Firebase) ---------- */

/* Chaves publicas do Firebase (JWKS). Cache de 1 hora para nao buscar
   no Google a cada requisicao do painel. */
async function pegarJwks() {
  const agora = Date.now();
  if (jwksCache.keys.length && agora < jwksCache.expires) return jwksCache.keys;
  const resp = await fetch("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com");
  if (!resp.ok) throw new Error("jwks http " + resp.status);
  const jwks = await resp.json();
  jwksCache = { expires: agora + JWKS_TTL, keys: jwks.keys || [] };
  return jwksCache.keys;
}

/* Valida o ID token (RS256) e devolve o payload, ou null se for invalido. */
async function jwtVerificar(token, env) {
  try {
    if (!token) return null;
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const header = JSON.parse(new TextDecoder().decode(await base64urlToUint8(parts[0])));
    const payload = JSON.parse(new TextDecoder().decode(await base64urlToUint8(parts[1])));
    const kid = header.kid;
    if (header.alg !== "RS256" || !kid) return null;
    const proj = env.FIREBASE_PROJECT_ID || "spacetek-3bf38";
    if (payload.aud !== proj) return null;
    if (payload.iss !== "https://securetoken.google.com/" + proj) return null;
    if (payload.exp && Date.now() / 1000 > payload.exp) return null;
    const keys = await pegarJwks();
    const key = keys.find((k) => k.kid === kid);
    if (!key) return null;
    const pub = await crypto.subtle.importKey(
      "jwk",
      { kty: "RSA", n: key.n, e: key.e, alg: "RS256", ext: true },
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const ok = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      pub,
      await base64urlToUint8(parts[2]),
      new TextEncoder().encode(parts[0] + "." + parts[1])
    );
    if (!ok) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

/* Allowlist de e-mails admin. Vazio = aceita qualquer ID token valido. */
function adminAutorizado(payload, env) {
  if (!payload) return false;
  const lista = String(env.ADMIN_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (lista.length === 0) return true;
  return lista.includes(String(payload.email || "").toLowerCase());
}

/* Le o ID token do cabecalho Authorization e valida. */
async function exigirAdmin(request, env) {
  const auth = request.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const payload = await jwtVerificar(token, env);
  if (!payload || !adminAutorizado(payload, env)) return null;
  return payload;
}

/* ---------- Status do pedido ---------- */

const STATUS_PERMITIDOS = ["novo", "em_andamento", "enviado", "entregue", "cancelado"];

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(env, origin) });
    }

    if (origin && !origemPermitida(env, origin)) {
      return json({ erro: "origem nao permitida" }, 403, env, "");
    }

    /* ---------- /health ---------- */
    if (url.pathname === "/health") {
      const provedor = provedorAtivo(env);
      const tok = tokenProvedor(env);
      const info = {
        ok: true,
        versao: VERSAO,
        provedor,
        token: !!tok,
        allowlistAtiva: String(env.ADMIN_EMAILS || "").trim().length > 0,
        kv: {
          freteCache: !!env.FRETE_CACHE,
          pedidos: !!env.PEDIDOS,
          eventos: !!env.EVENTOS
        }
      };
      /* Diagnostico: faz uma cotacao minima (a cotacao e gratis).
         200 = token valido; 401/403 = token recusado. */
      if (tok && provedor === "superfrete") {
        try {
          const r = await fetch(env.SUPERFRETE_URL || "https://api.superfrete.com/api/v0/calculator", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
              Authorization: "Bearer " + tok,
              "User-Agent": env.USER_AGENT || "SpaceTek Frete (contato@spacetek.com)"
            },
            body: JSON.stringify({
              from: { postal_code: "01153000" },
              to: { postal_code: "20020050" },
              services: env.SUPERFRETE_SERVICES || "1,2,17",
              options: { own_hand: false, receipt: false, insurance_value: 0, use_insurance_value: false },
              products: [{ quantity: 1, weight: 0.3, height: 4, width: 11, length: 17 }]
            })
          });
          const t = await r.text();
          let j = null;
          try { j = JSON.parse(t); } catch (e) {}
          info.servicosStatus = r.status;
          info.servicosQtde = Array.isArray(j) ? j.length : null;
        } catch (e) {
          info.servicosErro = String((e && e.message) || e);
        }
      }
      return json(info, 200, env, origin);
    }

    /* ---------- /quote ---------- */
    if (url.pathname === "/quote" && request.method === "POST") {
      if (!tokenProvedor(env)) {
        const p = provedorAtivo(env);
        return json({ erro: p === "superfrete" ? "SUPERFRETE_TOKEN nao configurado" : "PROVEDOR_TOKEN nao configurado" }, 500, env, origin);
      }
      let body;
      try { body = await request.json(); }
      catch (e) { return json({ erro: "json invalido" }, 400, env, origin); }
      const cep = soDigitos(body && body.cep);
      const cepOrigem = soDigitos((body && body.cepOrigem) || env.CEP_ORIGEM);
      if (cep.length !== 8) return json({ erro: "CEP de destino invalido" }, 400, env, origin);
      if (cepOrigem.length !== 8) return json({ erro: "CEP de origem nao configurado" }, 400, env, origin);
      const dados = normalizarItems(body && body.items);
      if (!dados) return json({ erro: "itens invalidos (peso/dimensoes)" }, 422, env, origin);

      /* Cache: mesma cotacao (mesmo CEP + mesmos itens) reaproveita o resultado. */
      const chave = "q:" + await sha256Hex(cepOrigem + "|" + cep + "|" + JSON.stringify(dados.itens));
      if (env.FRETE_CACHE) {
        try {
          const hit = await env.FRETE_CACHE.get(chave, "json");
          if (hit) return json({ opcoes: hit, cache: true }, 200, env, origin);
        } catch (e) {}
      }
      try {
        const opcoes = await cotar(env, cepOrigem, cep, dados);
        if (opcoes.length) {
          opcoes.sort((a, b) => a.preco - b.preco);
          if (env.FRETE_CACHE) {
            try { await env.FRETE_CACHE.put(chave, JSON.stringify(opcoes), { expirationTtl: CACHE_TTL }); } catch (e) {}
          }
          return json({ opcoes, cache: false }, 200, env, origin);
        }
      } catch (err) {
        /* Provedor fora do ar: cai na tabela estimada abaixo. */
      }
      const est = fallbackEstimado(cep);
      if (est.length) {
        est.sort((a, b) => a.preco - b.preco);
        return json({ opcoes: est, cache: false, fallback: true }, 200, env, origin);
      }
      return json({ erro: "sem opcoes de frete" }, 422, env, origin);
    }

    /* ---------- /event (contadores do dia) ---------- */
    if (url.pathname === "/event" && request.method === "POST") {
      if (env.EVENTOS) {
        try {
          const body = await request.json().catch(() => ({}));
          const key = "d:" + new Date().toISOString().slice(0, 10);
          const cur = await env.EVENTOS.get(key, "json") || {};
          if (body.pagina === "produto") cur.produto = (cur.produto || 0) + 1;
          else if (body.pagina === "carrinho") cur.carrinho = (cur.carrinho || 0) + 1;
          else if (body.pagina === "admin") cur.admin = (cur.admin || 0) + 1;
          else cur.visita = (cur.visita || 0) + 1;
          /* 90 dias: contador antigo nao precisa ficar no KV para sempre. */
          await env.EVENTOS.put(key, JSON.stringify(cur), { expirationTtl: 60 * 60 * 24 * 90 });
        } catch (e) {}
      }
      return json({ ok: true }, 200, env, origin);
    }

    /* ---------- /analytics ---------- */
    if (url.pathname === "/analytics" && request.method === "GET") {
      const dia = url.searchParams.get("dia") || new Date().toISOString().slice(0, 10);
      const vazio = { dia, visita: 0, produto: 0, carrinho: 0, admin: 0 };
      if (!env.EVENTOS) return json(vazio, 200, env, origin);
      try {
        const cur = await env.EVENTOS.get("d:" + dia, "json") || {};
        return json({
          dia,
          visita: cur.visita || 0,
          produto: cur.produto || 0,
          carrinho: cur.carrinho || 0,
          admin: cur.admin || 0
        }, 200, env, origin);
      } catch (e) {
        return json(vazio, 200, env, origin);
      }
    }

    /* ---------- /order (checkout do site) ---------- */
    if (url.pathname === "/order" && request.method === "POST") {
      let body;
      try { body = await request.json(); }
      catch (e) { return json({ erro: "json invalido" }, 400, env, origin); }
      if (!Array.isArray(body.itens) || body.itens.length === 0) return json({ erro: "carrinho vazio" }, 400, env, origin);
      const pedido = {
        id: crypto.randomUUID(),
        status: "novo",
        criadoEm: Date.now(),
        nome: body.nome || "",
        /* WhatsApp do cliente (55 + DDD + numero). Usado para avisar
           mudancas de status no painel admin. */
        whatsapp: soDigitos(body.whatsapp),
        contato: body.contato || "",
        cep: body.cep || "",
        endereco: body.endereco || "",
        obs: body.obs || "",
        itens: body.itens,
        subtotal: body.subtotal,
        frete: body.frete,
        total: body.total
      };
      if (env.PEDIDOS) {
        try { await env.PEDIDOS.put("p:" + pedido.id, JSON.stringify(pedido)); } catch (e) {}
      }
      return json({ id: pedido.id }, 200, env, origin);
    }

    /* ---------- /orders (lista, admin) ---------- */
    if (url.pathname === "/orders" && request.method === "GET") {
      const payload = await exigirAdmin(request, env);
      if (!payload) return json({ erro: "nao autorizado" }, 403, env, origin);
      if (!env.PEDIDOS) return json({ pedidos: [] }, 200, env, origin);
      try {
        const lista = await env.PEDIDOS.list({ prefix: "p:" });
        const pedidos = [];
        for (const k of (lista.keys || []).slice(0, 100)) {
          const p = await env.PEDIDOS.get(k.name, "json");
          if (p) pedidos.push(p);
        }
        pedidos.sort((a, b) => (b.criadoEm || 0) - (a.criadoEm || 0));
        return json({ pedidos }, 200, env, origin);
      } catch (e) {
        return json({ pedidos: [] }, 200, env, origin);
      }
    }

    /* ---------- PATCH /orders/:id (status, admin) ---------- */
    if (url.pathname.startsWith("/orders/") && request.method === "PATCH") {
      const payload = await exigirAdmin(request, env);
      if (!payload) return json({ erro: "nao autorizado" }, 403, env, origin);
      const id = url.pathname.split("/")[2];
      let body;
      try { body = await request.json(); }
      catch (e) { return json({ erro: "json invalido" }, 400, env, origin); }
      if (!env.PEDIDOS || !id) return json({ erro: "indisponivel" }, 400, env, origin);
      try {
        const p = await env.PEDIDOS.get("p:" + id, "json");
        if (!p) return json({ erro: "pedido nao encontrado" }, 404, env, origin);
        if (body.status && STATUS_PERMITIDOS.includes(body.status) && body.status !== p.status) {
          /* Historico das mudancas de status (mostrado no painel). */
          p.historico = Array.isArray(p.historico) ? p.historico : [];
          p.historico.push({ status: body.status, em: Date.now() });
          p.status = body.status;
        }
        p.atualizadoEm = Date.now();
        await env.PEDIDOS.put("p:" + id, JSON.stringify(p));
        return json({ ok: true, status: p.status }, 200, env, origin);
      } catch (e) {
        return json({ erro: "falha" }, 500, env, origin);
      }
    }

    return json({ erro: "rota invalida" }, 404, env, origin);
  }
};
