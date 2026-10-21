/**
 * SpaceTek — Worker de cotacao de frete.
 *
 * Recebe POST /quote { cepOrigem?, cep, items:[{width,height,length,weight,insurance_value,quantity}] }
 * e devolve { opcoes:[{ id, servico, empresa, preco, prazo }] }.
 *
 * Segredos (via `wrangler secret put`):
 *   SUPERFRETE_TOKEN  — token da conta SuperFrete (usado quando PROVEDOR = "superfrete")
 *   FRENET_TOKEN      — token da conta Frenet     (usado quando PROVEDOR = "frenet")
 *   PROVEDOR_TOKEN    — fallback para qualquer provedor
 *   CEP_ORIGEM        — CEP de origem (fallback; o site tambem envia)
 *
 * Vars (wrangler.toml): PROVEDOR, USER_AGENT, ALLOWED_ORIGINS,
 *                       SUPERFRETE_URL, SUPERFRETE_SERVICES
 */

const LIMITE_ITENS = 20;
const LIMITE_KG = 100;

function origemPermitida(env, origin) {
  if (!origin) return "";
  const lista = String(env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
  return lista.includes(origin) ? origin : "";
}

function corsHeaders(env, origin) {
  const ok = origemPermitida(env, origin);
  const h = { "Vary": "Origin" };
  if (ok) {
    h["Access-Control-Allow-Origin"] = ok;
    h["Access-Control-Allow-Methods"] = "POST, GET, OPTIONS";
    h["Access-Control-Allow-Headers"] = "Content-Type";
    h["Access-Control-Max-Age"] = "86400";
  }
  return h;
}

function json(obj, status, env, origin) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: Object.assign({ "Content-Type": "application/json; charset=utf-8" }, corsHeaders(env, origin))
  });
}

const soDigitos = (v) => String(v || "").replace(/\D/g, "");

/* Provedor ativo (frenet | superfrete). */
function provedorAtivo(env) {
  return String((env && env.PROVEDOR) || "frenet").toLowerCase();
}

/* Token do provedor: remove espacos/quebras de linha que vem do copy/paste.
   Cada provedor tem seu proprio secret (FRENET_TOKEN / SUPERFRETE_TOKEN).
   PROVEDOR_TOKEN e fallback apenas do Frenet (onde ja estava gravado). */
function tokenProvedor(env) {
  const raw = provedorAtivo(env) === "superfrete"
    ? (env && env.SUPERFRETE_TOKEN)
    : ((env && env.FRENET_TOKEN) || (env && env.PROVEDOR_TOKEN));
  return String(raw || "").trim().replace(/\s+/g, "");
}

function normalizarItems(items) {
  if (!Array.isArray(items) || items.length === 0) return null;
  if (items.length > LIMITE_ITENS) return null;
  const out = [];
  let peso = 0;
  let valor = 0;
  for (const it of items) {
    const w = Number(it.width), h = Number(it.height), l = Number(it.length);
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

/* ---------- Provedor: Frenet ---------- */
async function cotarFrenet(env, cepOrigem, cep, dados) {
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
        Height: i.height, Length: i.length, Width: i.width, Weight: i.weight, Quantity: i.quantity
      }))
    })
  });
  const raw = await resp.text();
  if (!resp.ok) {
    throw new Error("frenet http " + resp.status + " -> " + raw.slice(0, 300));
  }
  let data;
  try { data = JSON.parse(raw); }
  catch (e) { throw new Error("frenet resposta nao-JSON: " + raw.slice(0, 200)); }
  if (data && data.error) {
    throw new Error("frenet erro: " + JSON.stringify(data).slice(0, 300));
  }
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
  if (!resp.ok) {
    throw new Error("superfrete http " + resp.status + " -> " + raw.slice(0, 300));
  }
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

    if (url.pathname === "/health") {
      const provedor = provedorAtivo(env);
      const tok = tokenProvedor(env);
      const rawToken = String((env.PROVEDOR_TOKEN || "") + String(env.SUPERFRETE_TOKEN || "") + String(env.FRENET_TOKEN || ""));
      const info = { ok: true, provedor, token: !!tok,
        tokenLen: tok.length, tokenTemEspaco: /\s/.test(rawToken),
        tokenFormato: /^[A-Za-z0-9._-]+$/i.test(tok) };
      /* Diagnostico: faz uma cotacao minima (a cotacao e gratis; so a etiqueta e cobrada).
         200 = token valido; 401/403 = token recusado. */
      if (tok) {
        try {
          if (provedor === "superfrete") {
            const r = await fetch(env.SUPERFRETE_URL || "https://api.superfrete.com/api/v0/calculator", {
              method: "POST",
              headers: { "Content-Type": "application/json", Accept: "application/json",
                Authorization: "Bearer " + tok, "User-Agent": env.USER_AGENT || "SpaceTek Frete (contato@spacetek.com)" },
              body: JSON.stringify({
                from: { postal_code: "01153000" },
                to: { postal_code: "20020050" },
                services: env.SUPERFRETE_SERVICES || "1,2,17",
                options: { own_hand: false, receipt: false, insurance_value: 0, use_insurance_value: false },
                products: [{ quantity: 1, weight: 0.3, height: 4, width: 11, length: 17 }]
              })
            });
            const t = await r.text();
            info.servicosStatus = r.status;
            let j = null; try { j = JSON.parse(t); } catch (e) {}
            info.servicosQtde = Array.isArray(j) ? j.length : null;
            info.servicos = Array.isArray(j)
              ? j.map((s) => (s && s.name) + " " + (s && s.price) + " (" + (s && s.delivery_time) + "d)" + (s && s.has_error ? " [erro]" : "")).join(" | ")
              : t.slice(0, 400);
          } else {
            const r = await fetch("https://api.frenet.com.br/shipping/info", {
              headers: { token: tok, Accept: "application/json" }
            });
            const t = await r.text();
            info.servicosStatus = r.status;
            info.servicos = t.slice(0, 500);
          }
        } catch (e) { info.servicosErro = String(e && e.message || e); }
      }
      return json(info, 200, env, origin);
    }

    if (url.pathname !== "/quote" || request.method !== "POST") {
      return json({ erro: "rota invalida" }, 404, env, origin);
    }

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

    try {
      const opcoes = await cotar(env, cepOrigem, cep, dados);
      if (!opcoes.length) return json({ erro: "sem opcoes de frete" }, 422, env, origin);
      opcoes.sort((a, b) => a.preco - b.preco);
      return json({ opcoes }, 200, env, origin);
    } catch (err) {
      return json({ erro: "falha na cotacao", detalhe: String(err && err.message || err) }, 502, env, origin);
    }
  }
};
