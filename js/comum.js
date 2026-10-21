/* ============================================================
   SpaceTek — helpers compartilhados entre o site e o painel admin
   ----------------------------------------------------------
   Carregado como script normal (sem JSX), antes do app.
   Uso: js/comum.js?v=<versao>

   Exporta (escopo global):
     h                 React.createElement
     useOverlayClose   fecha modal ao clicar no fundo
     REGIOES_CEP       regiao do CEP (1o digito) -> sigla
     window.FRETE_TABELA  tabela de frete por regiao (fallback)
     precoDe           preco numerico do produto (ou null)
     cmpProd           ordenacao de produtos (destaque, ordem)
     formatBRL         1234.5 -> R$ 1.234,50
     parseDimensoes    "10 x 5 x 8 cm" -> {comprimento, largura, altura}
     pesoKgDe          peso do produto em kg (cadastro guarda gramas)
     medidasDe         medidas (cm) do produto, numericas ou do texto
     temMedidasFrete   produto pronto para cotar frete real
   ============================================================ */

const h = React.createElement;
/* Fecha o modal ao clicar no fundo, sem fechar quando o usuario esta
   selecionando/copiando texto (evita fechar ao dar Ctrl+C). */
function useOverlayClose(onClose) {
  const pressOnOverlay = React.useRef(false);
  return {
    onMouseDown: (e) => { pressOnOverlay.current = (e.target === e.currentTarget); },
    onClick: (e) => {
      if (e.target !== e.currentTarget) return;
      if (!pressOnOverlay.current) return;
      const sel = window.getSelection && window.getSelection();
      if (sel && String(sel).length > 0) return;
      onClose();
    }
  };
}
/* ---------- Precos e frete ---------- */
const REGIOES_CEP = {
  0: "SP", 1: "SP", 2: "RJ/ES", 3: "MG",
  4: "BA/SE", 5: "PE/AL/PB/RN", 6: "CE/PI/MA",
  7: "DF/GO/MT/MS/TO/RO/AC", 8: "PR/SC", 9: "RS"
};
window.FRETE_TABELA = { 0: 15, 1: 15, 2: 20, 3: 20, 4: 32, 5: 32, 6: 35, 7: 28, 8: 22, 9: 22 };
function precoDe(produto) {
  const v = produto && produto.preco;
  const n = typeof v === "number" ? v : parseFloat(v);
  return isFinite(n) && n > 0 ? n : null;
}
function cmpProd(a, b) {
  if ((!!a.destaque) !== (!!b.destaque)) return (!!b.destaque) ? 1 : -1;
  return (Number(a.ordem) || 0) - (Number(b.ordem) || 0);
}
function formatBRL(v) {
  return "R$ " + Number(v).toFixed(2).replace(".", ",");
}
/* Extrai medidas (cm) de um texto livre, ex.: "10 x 5 x 8 cm" -> "10","5","8". */
function parseDimensoes(txt) {
  const nums = String(txt || "").match(/\d+(?:[.,]\d+)?/g) || [];
  return { comprimento: nums[0] || "", largura: nums[1] || "", altura: nums[2] || "" };
}
/* Peso do produto em kg (o cadastro guarda gramas). */
function pesoKgDe(p) {
  const g = Number(p && p.peso);
  return isFinite(g) && g > 0 ? g / 1000 : null;
}
/* Medidas em cm do produto: prefere os campos numericos; se faltarem
   (pecas cadastradas antes da Part 1), extrai do texto "dimensoes",
   ex.: "6,5x5x10 cm" -> 6.5 x 5 x 10. Retorna null se nao der. */
function medidasDe(p) {
  if (!p) return null;
  const num = (v) => Number(String(v).replace(",", "."));
  const c = num(p.comprimento), l = num(p.largura), a = num(p.altura);
  if (c > 0 && l > 0 && a > 0) return { comprimento: c, largura: l, altura: a };
  const dm = parseDimensoes(p.dimensoes);
  const c2 = num(dm.comprimento), l2 = num(dm.largura), a2 = num(dm.altura);
  if (c2 > 0 && l2 > 0 && a2 > 0) return { comprimento: c2, largura: l2, altura: a2 };
  return null;
}
/* Produto pronto para cotar frete real: precisa de peso e 3 dimensoes. */
function temMedidasFrete(p) {
  return !!(medidasDe(p) && pesoKgDe(p) != null);
}
