# Painel administrativo (SpaceTek)

O painel administrativo é uma **página própria**: `admin/index.html`
(https://iagocallado.github.io/spacetek/admin/).

No site público, **dois cliques na logo** abrem essa página em uma aba nova.
O site público não carrega mais nenhum código do painel (nem o SDK de Auth do
Firebase): o modal antigo (`admin/admin-panel.js` + `admin/admin.css`) foi removido
em favor desta página.

## Arquivos

| Arquivo | Conteúdo |
|---|---|
| `index.html` | Página do painel: shell, CDNs (React 18, Babel standalone, Firebase), monta `window.AdminApp` e mostra o aviso de "Painel indisponível" se o JSX não carregar. |
| `admin-app.js` | JSX do painel: `AdminApp` (shell + abas), `AdminLogin`, `AbaCatalogo`, `PecaForm`, `AbaFrete`, `AbaPedidos`, `AbaResumo`, `CatAutocomplete` + helpers (`gerarMiniatura`, `comprimirImagem`, `dimTexto`, `tabelaParaArray`, `imgSrc`, `numeroPedido`, `mascaraPedido`, `linkWhatsApp`, `mensagemStatus`). Exporta `window.AdminApp`. |
| `admin-page.css` | Estilos da página (`.admin*`, `.badge-*`, `.pedido-*`, `.btn-setinha`, `.btn-star`, `.autocomplete*`, `.field--mini`, `.field__help`, `.check--compact`). Usa as custom properties (`:root`) de `styles.css`. |
| `README.md` | Este arquivo. |

## Abas

- **Catálogo** — hero da home, busca/filtros, tabela de peças (destaque, duplicar,
  editar, excluir, reordenar) e o formulário de peça em **drawer lateral**.
- **Frete** — CEP de origem, frete grátis, peso incluso/excedente, endpoint do Worker,
  tabela por região (10 dígitos do CEP) + teste de cotação.
- **Pedidos** — cards dos pedidos (cliente, WhatsApp, itens, totais, histórico de status),
  busca por nome/id/telefone, filtros por status com contagem e o botão **Confirmar pedido**
  da loja. Trocar o status salva no Worker e abre a conversa `wa.me` do cliente com a
  mensagem já preenchida (o checkout exige o WhatsApp por isso). Pedidos sem WhatsApp
  cadastrado mostram o aviso e não abrem a conversa.
- **Resumo** — totais do catálogo (destaques, lançamentos, esgotados, sem medidas,
  sem preço), aviso de peças que não são cotadas, status do Worker e os contadores
  do dia (visitas, cliques em produto, acessos ao carrinho).

## Como é carregado

`admin/index.html` inclui (paths relativos à pasta `admin/`):

```html
<link rel="stylesheet" href="../styles.css?v=<versao>" />
<link rel="stylesheet" href="admin-page.css?v=<versao>" />
<script src="../js/comum.js?v=<versao>"></script>
<script type="text/babel" data-presets="react" src="admin-app.js?v=<versao>"></script>
```

## Dependências

- **React 18** (CDN, `window.React`) — hooks usados: `useState`, `useRef`, `useEffect`.
- **`js/comum.js`** — helpers compartilhados com o site (script normal, sem JSX):
  `h`, `useOverlayClose`, `REGIOES_CEP`, `window.FRETE_TABELA`, `precoDe`, `cmpProd`,
  `formatBRL`, `parseDimensoes`, `pesoKgDe`, `medidasDe`, `temMedidasFrete`.
- **`window.fbDb` / `window.fbAuth`** — Firebase, de `data/firebase-config.js`
  (o `fbAuth` só existe se o SDK de Auth estiver carregado — nesta página ele está).
- **`window.CATALOGO` / `window.LANCAMENTOS`** — de `data/products.js`
  (usados pelo botão "Importar catálogo atual").
- **Imagens**: o banco guarda caminhos relativos à raiz do site
  (ex.: `assets/images/p1.svg`); na página `/admin/` o helper `imgSrc()` prepende
  `../` para a imagem carregar.

## Limitação: abrir o `admin/index.html` direto do disco (`file://`)

O Babel busca o JSX externo por XHR, e o Chrome bloqueia isso em `file://`.
Nesses casos a página mostra **"Painel indisponível"**.

Para desenvolver/testar, use um servidor local:

```powershell
# dentro da pasta do site
python -m http.server 8899
# http://localhost:8899/admin/
```

## Regras

1. Ao alterar qualquer arquivo, **bump a versão** (`window.__APP_VERSION` e o `?v=`
   dos scripts/estilos em `index.html` e `admin/index.html`, além de `version.json`) —
   é o que dispara o reload automático nos dispositivos que já abriram a página.
2. O painel **não** deve declarar `const h` / `REGIOES_CEP` (já vêm de `js/comum.js`).
3. Novas regras de CSS do painel entram aqui, não em `styles.css`.
4. A lógica do Firestore (ler/gravar `produtos` e `produtos/_site`) fica na página do
   painel; o site público apenas **lê** `produtos`.
