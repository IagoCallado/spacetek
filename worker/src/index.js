/**
 * SpaceTek — Worker de cotacao de frete.
 *
 * Recebe POST /quote { cepOrigem?, cep, items:[{width,height,length,weight,insurance_value,quantity}] }
 * e devolve { opcoes:[{ id, servico, empresa, preco, prazo }] }.
 *
 * Segredos (via `wrangler secret put`):
 *   PROVEDOR_TOKEN  — token da conta no provedor (Frenet / SuperFrete)
 *   CEP_ORIGEM      — CEP de origem (fallback; o site tambem envia)
 *
 * Vars (wrangler.toml): PROVEDOR, USER_AGENT, ALLOWED_ORIGINS
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
      "token": env.PROVEDOR_TOKEN
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
  if (!resp.ok) throw new Error("frenet http " + resp.status);
  const data = await resp.json();
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

/* ---------- Provedor: SuperFrete ---------- */
async function cotarSuperFrete(env, cepOrigem, cep, dados) {
  const resp = await fetch("https://api.superfrete.com/api/v0/calculator", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "Authorization": "Bearer " + env.PROVEDOR_TOKEN,
      "User-Agent": env.USER_AGENT || "SpaceTek Frete"
    },
    body: JSON.stringify({
      from: { postal_code: cepOrigem },
      to: { postal_code: cep },
      services: "1,2,17,3,4",
      options: { receipt: false, own_hand: false, collect: false },
      products: dados.itens.map((i) => ({
        id: i.id, width: i.width, height: i.height, length: i.length,
        weight: i.weight, insurance_value: i.insurance_value || 0, quantity: i.quantity
      }))
    })
  });
  if (!resp.ok) throw new Error("superfrete http " + resp.status);
  const data = await resp.json();
  const arr = Array.isArray(data) ? data : (data.opcoes || data.data || []);
  return arr
    .filter((s) => !s.error && (s.price != null || s.custom_price != null))
    .map((s) => ({
      id: String(s.id || s.service || s.name || ""),
      servico: s.name || s.service || "Frete",
      empresa: (s.company && (s.company.name || s.company)) || "",
      preco: Number(String(s.custom_price != null ? s.custom_price : s.price).replace(",", ".")),
      prazo: s.custom_delivery_time != null ? parseInt(s.custom_delivery_time, 10)
        : (s.delivery_time != null ? parseInt(s.delivery_time, 10) : null)
    }))
    .filter((o) => isFinite(o.preco) && o.preco > 0);
}

async function cotar(env, cepOrigem, cep, dados) {
  const provedor = String(env.PROVEDOR || "frenet").toLowerCase();
  if (provedor === "superfrete") return cotarSuperFrete(env, cepOrigem, cep, dados);
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
      return json({ ok: true, provedor: env.PROVEDOR || "frenet", token: !!env.PROVEDOR_TOKEN }, 200, env, origin);
    }

    if (url.pathname !== "/quote" || request.method !== "POST") {
      return json({ erro: "rota invalida" }, 404, env, origin);
    }

    if (!env.PROVEDOR_TOKEN) {
      return json({ erro: "PROVEDOR_TOKEN nao configurado" }, 500, env, origin);
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
