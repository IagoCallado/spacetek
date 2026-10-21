# Painel administrativo (SpaceTek)

Todo o código do painel administrativo do site fica nesta pasta.

## Arquivos

| Arquivo | Conteúdo |
|---|---|
| `admin-panel.js` | JSX do painel: `AdminLogin`, `CatAutocomplete`, `AdminPanel` + helpers exclusivos (`gerarMiniatura`, `comprimirImagem`, `dimTexto`, `tabelaParaArray`). Exporta `window.AdminLogin` e `window.AdminPanel`. |
| `admin.css` | Estilos do painel (`.admin*`, `.badge-*`, `.btn-setinha`, `.btn-star`, `.autocomplete*`, `.field--mini`, `.field__help`, `.check--compact`). Usa as custom properties (`:root`) de `styles.css`. |
| `README.md` | Este arquivo. |

## Como é carregado

`index.html` inclui:

```html
<link rel="stylesheet" href="admin/admin.css?v=<versao>" />
<script src="js/comum.js?v=<versao>"></script>
<script type="text/babel" data-presets="react" src="admin/admin-panel.js?v=<versao>"></script>
```

O painel continua sendo aberto **como modal dentro do site** (dois cliques no logo),
sem mudar a URL nem o fluxo do usuário.

## Dependências

- **React 18** (CDN, `window.React`) — hooks usados: `useState`, `useRef`, `useEffect`.
- **`js/comum.js`** — helpers compartilhados com o site (carregado como script normal,
  sem JSX): `h`, `useOverlayClose`, `REGIOES_CEP`, `window.FRETE_TABELA`, `precoDe`,
  `cmpProd`, `formatBRL`, `parseDimensoes`, `pesoKgDe`, `medidasDe`, `temMedidasFrete`.
- **`window.fbDb` / `window.fbAuth`** — Firebase, de `data/firebase-config.js`.
- **`window.CATALOGO` / `window.LANCAMENTOS`** — de `data/products.js`.

## Limitação: abrir o `index.html` direto do disco (`file://`)

O Babel busca o JSX externo por XHR, e o Chrome bloqueia isso em `file://`.
Nesses casos:

- o site continua funcionando normalmente (o app está inline em `index.html`);
- o painel mostra o aviso **"Painel indisponível — abra pelo site publicado"**.

Para desenvolver/testar o painel, use um servidor local:

```powershell
# dentro da pasta do site
python -m http.server 8899
# http://localhost:8899/index.html
```

## Regras

1. Ao alterar qualquer arquivo, **bump a versão** (`window.__APP_VERSION` no
   `index.html`, o `?v=` dos scripts/estilos e `version.json`) — é o que dispara o
   reload automático nos dispositivos que já abriram o site.
2. O painel **não** deve declarar `const h` / `REGIOES_CEP` (já vêm de `js/comum.js`).
3. Novas regras de CSS do painel entram aqui, não em `styles.css`.
