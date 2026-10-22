/* ============================================================
   SpaceTek — Painel administrativo (pagina dedicada)
   ----------------------------------------------------------
   Pagina: admin/index.html  ->  /spacetek/admin/

   Carregado por admin/index.html como JSX externo:
     <script type="text/babel" data-presets="react"
             src="admin-panel.js?v=<versao>"></script>

   IMPORTANTE: o Babel busca este arquivo via XHR, entao ele so
   carrega via http(s) (site publicado). Abrindo o index.html
   direto do disco (file://) a pagina mostra um aviso.

   Depende dos helpers compartilhados em js/comum.js:
     h, useOverlayClose, REGIOES_CEP, window.FRETE_TABELA, precoDe,
     cmpProd, formatBRL, parseDimensoes, pesoKgDe, medidasDe,
     temMedidasFrete

   Expoe: window.AdminApp
   ============================================================ */
(function () {

  /* ---------- Imagens ---------- */
  function gerarMiniatura(img, maxLado, qualidade) {
    const escala = Math.min(1, maxLado / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * escala));
    const hh = Math.max(1, Math.round(img.height * escala));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = hh;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, hh);
    ctx.drawImage(img, 0, 0, w, hh);
    let q = qualidade;
    let dataUrl = canvas.toDataURL("image/jpeg", q);
    while (dataUrl.length > 700000 && q > 0.4) {
      q -= 0.08;
      dataUrl = canvas.toDataURL("image/jpeg", q);
    }
    if (dataUrl.length > 700000 && maxLado > 500) {
      return gerarMiniatura(img, Math.round(maxLado * 0.8), 0.7);
    }
    return dataUrl;
  }
  function comprimirImagem(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => {
        const img = new Image();
        img.onerror = reject;
        img.onload = () => resolve(gerarMiniatura(img, 1200, 0.72));
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }
  function dimTexto(c, l, a) {
    return (c !== "" && l !== "" && a !== "") ? (c + " x " + l + " x " + a + " cm") : "";
  }
  /* Converte a tabela (objeto por digito ou array) em array de strings [0..9]. */
  function tabelaParaArray(t) {
    const arr = [];
    for (let i = 0; i < 10; i++) arr.push(t && t[i] != null ? String(t[i]) : "");
    return arr;
  }
  /* As imagens do banco usam caminho relativo a raiz do site
     (ex.: "assets/images/p1.svg"). Na pagina /admin/ precisa de "../". */
  function imgSrc(u) {
    const s = String(u || "");
    if (!s) return "";
    if (/^(https?:|data:|blob:)/i.test(s)) return s;
    if (s.indexOf("/") === 0 || s.indexOf("../") === 0) return s;
    return "../" + s.replace(/^\.\//, "");
  }
  function dataHora(ts) {
    const d = ts ? new Date(ts) : new Date();
    const p = (n) => String(n).padStart(2, "0");
    return p(d.getDate()) + "/" + p(d.getMonth() + 1) + "/" + d.getFullYear() +
      " " + p(d.getHours()) + ":" + p(d.getMinutes());
  }

  /* ---------- Login ---------- */
  function AdminLogin({ onSuccess }) {
    const [usuario, setUsuario] = React.useState("");
    const [senha, setSenha] = React.useState("");
    const [erro, setErro] = React.useState("");
    const [carregando, setCarregando] = React.useState(false);
    const [logoOk, setLogoOk] = React.useState(true);

    const entrar = async (e) => {
      e.preventDefault();
      setErro("");
      if (!usuario.trim() || !senha) { setErro("Preencha usuario e senha."); return; }
      if (!window.fbAuth) { setErro("Autenticacao indisponivel. Verifique a conexao."); return; }
      const email = usuario.indexOf("@") >= 0 ? usuario.trim() : usuario.trim().toLowerCase() + "@spacetek.com";
      setCarregando(true);
      try {
        await window.fbAuth.signInWithEmailAndPassword(email, senha);
        if (onSuccess) onSuccess();
      } catch (err) {
        setErro("Usuario ou senha invalidos.");
      } finally {
        setCarregando(false);
      }
    };

    return h("div", { className: "admin-login" },
      h("form", { className: "admin-login__card", onSubmit: entrar },
        logoOk
          ? h("img", { className: "admin-login__logo", src: "../assets/images/logo.jpg", alt: "SpaceTek",
              onError: () => setLogoOk(false) })
          : h("p", { className: "admin-login__marca" }, "SpaceTek"),
        h("h1", { className: "admin-login__title" }, "Painel do administrador"),
        h("p", { className: "admin-login__sub" }, "Entre para gerenciar o catalogo, a home e o frete."),
        h("label", { className: "field" },
          h("span", null, "Usuario"),
          h("input", { value: usuario, placeholder: "admin", autoFocus: true, autoComplete: "username",
            onChange: (e) => setUsuario(e.target.value) })
        ),
        h("label", { className: "field" },
          h("span", null, "Senha"),
          h("input", { type: "password", value: senha, placeholder: "........", autoComplete: "current-password",
            onChange: (e) => setSenha(e.target.value) })
        ),
        erro && h("p", { className: "admin__msg admin__msg--erro" }, erro),
        h("button", { type: "submit", className: "btn btn--primary btn--block", disabled: carregando },
          carregando ? "Entrando..." : "Entrar"),
        h("a", { className: "admin-login__voltar", href: "../" }, "Voltar ao site")
      )
    );
  }

  /* ---------- Autocomplete de categoria ---------- */
  function CatAutocomplete({ value, onChange, categorias }) {
    const [aberto, setAberto] = React.useState(false);
    const termo = (value || "").toLowerCase();
    const sugestoes = (categorias || []).filter((c) => c.toLowerCase().indexOf(termo) >= 0);
    return h("div", { className: "autocomplete" },
      h("input", { value: value, placeholder: "Ex.: Decoracao",
        onChange: (e) => { onChange(e.target.value); setAberto(true); },
        onFocus: () => setAberto(true),
        onBlur: () => setTimeout(() => setAberto(false), 150) }),
      aberto && sugestoes.length > 0 && h("ul", { className: "autocomplete__list" },
        sugestoes.map((c) => h("li", { key: c,
          onMouseDown: (e) => { e.preventDefault(); onChange(c); setAberto(false); } }, c))
      )
    );
  }

  /* ---------- Formulario da peca (drawer lateral) ---------- */
  function PecaForm({ produto, categorias, onSalvar, onCancelar, salvando }) {
    const editando = !!produto;
    /* Medidas: usa os campos numericos; se nao existirem, tenta o texto
       "dimensoes" (pecas cadastradas antes da Part 1). */
    const medidasIniciais = (p) => {
      if (!p) return { comprimento: "", largura: "", altura: "" };
      const dm = (p.comprimento || p.largura || p.altura)
        ? { comprimento: p.comprimento, largura: p.largura, altura: p.altura }
        : parseDimensoes(p.dimensoes);
      return {
        comprimento: dm.comprimento == null ? "" : String(dm.comprimento),
        largura: dm.largura == null ? "" : String(dm.largura),
        altura: dm.altura == null ? "" : String(dm.altura)
      };
    };
    const [nome, setNome] = React.useState(produto ? (produto.nome || "") : "");
    const [categoria, setCategoria] = React.useState(produto ? (produto.categoria || "") : "");
    const [secao, setSecao] = React.useState(produto && produto.secao === "lancamentos" ? "lancamentos" : "catalogo");
    const [novo, setNovo] = React.useState(produto ? !!produto.novo : false);
    const [esgotado, setEsgotado] = React.useState(produto ? !!produto.esgotado : false);
    const [destaque, setDestaque] = React.useState(produto ? !!produto.destaque : false);
    const [imagem, setImagem] = React.useState(produto ? (produto.imagem || "") : "");
    const [preco, setPreco] = React.useState(produto && produto.preco != null ? String(produto.preco) : "");
    const [descricao, setDescricao] = React.useState(produto ? (produto.descricao || "") : "");
    const [filamento, setFilamento] = React.useState(produto ? (produto.filamento || "") : "");
    const [peso, setPeso] = React.useState(produto && produto.peso != null ? String(produto.peso) : "");
    const [comprimento, setComprimento] = React.useState(medidasIniciais(produto).comprimento);
    const [largura, setLargura] = React.useState(medidasIniciais(produto).largura);
    const [altura, setAltura] = React.useState(medidasIniciais(produto).altura);
    const [erros, setErros] = React.useState({});
    const [msgLocal, setMsgLocal] = React.useState("");

    const erroCampo = (campo) => erros[campo] && h("small", { className: "field__erro" }, erros[campo]);
    const clsCampo = (campo) => "field" + (erros[campo] ? " field--erro" : "");
    const limparErro = (campo) => setErros((e) => (e[campo] ? Object.assign({}, e, { [campo]: "" }) : e));

    const escolherArquivo = async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      setMsgLocal("Processando imagem...");
      try {
        const dataUrl = await comprimirImagem(file);
        setImagem(dataUrl);
        setMsgLocal("");
      } catch (err) {
        setMsgLocal("Falha ao processar a imagem.");
      }
    };

    const salvar = (ev) => {
      ev.preventDefault();
      setMsgLocal("");
      const precoNum = preco === "" ? null : Number(String(preco).replace(",", "."));
      const pesoNum = peso === "" ? null : Number(String(peso).replace(",", "."));
      const compNum = comprimento === "" ? null : Number(String(comprimento).replace(",", "."));
      const largNum = largura === "" ? null : Number(String(largura).replace(",", "."));
      const altNum = altura === "" ? null : Number(String(altura).replace(",", "."));
      const e = {};
      if (!nome.trim()) e.nome = "Informe o nome da peca.";
      if (!categoria.trim()) e.categoria = "Informe a categoria.";
      if (preco !== "" && (!isFinite(precoNum) || precoNum < 0)) {
        e.preco = "Preco invalido. Use apenas numeros, ex.: 49.90";
      }
      if (pesoNum == null || !isFinite(pesoNum) || pesoNum <= 0) {
        e.peso = "Informe o peso em gramas (ex.: 120).";
      }
      if (compNum == null || !isFinite(compNum) || compNum <= 0) e.comprimento = "Informe em cm (ex.: 10).";
      if (largNum == null || !isFinite(largNum) || largNum <= 0) e.largura = "Informe em cm (ex.: 5).";
      if (altNum == null || !isFinite(altNum) || altNum <= 0) e.altura = "Informe em cm (ex.: 8).";
      setErros(e);
      if (Object.keys(e).some((k) => e[k])) return;
      onSalvar({
        nome: nome.trim(),
        categoria: categoria.trim(),
        secao: secao,
        novo: !!novo,
        esgotado: !!esgotado,
        destaque: !!destaque,
        preco: precoNum,
        descricao: descricao.trim(),
        filamento: filamento,
        peso: pesoNum,
        comprimento: compNum,
        largura: largNum,
        altura: altNum,
        dimensoes: dimTexto(compNum, largNum, altNum),
        imagem: imagem || "assets/images/p1.svg"
      });
    };

    return h("form", { className: "admin-form", onSubmit: salvar },
      h("div", { className: "admin-form__grid" },
        h("label", { className: clsCampo("nome") },
          h("span", null, "Nome *"),
          h("input", { value: nome, placeholder: "Ex.: Vaso Geometrico",
            onChange: (e) => { setNome(e.target.value); limparErro("nome"); } }),
          erroCampo("nome")
        ),
        h("label", { className: clsCampo("categoria") },
          h("span", null, "Categoria *"),
          h(CatAutocomplete, { value: categoria,
            onChange: (v) => { setCategoria(v); limparErro("categoria"); }, categorias: categorias }),
          erroCampo("categoria")
        ),
        h("div", { className: "admin-form__row" },
          h("label", { className: "field" },
            h("span", null, "Secao"),
            h("select", { value: secao, onChange: (e) => setSecao(e.target.value) },
              h("option", { value: "catalogo" }, "Catalogo"),
              h("option", { value: "lancamentos" }, "Lancamentos")
            )
          ),
          h("label", { className: clsCampo("preco") },
            h("span", null, "Preco (R$)"),
            h("input", { value: preco, inputMode: "decimal", placeholder: "Ex.: 49.90",
              onChange: (e) => { setPreco(e.target.value); limparErro("preco"); } }),
            erroCampo("preco")
          )
        ),
        h("div", { className: "admin-form__row" },
          h("label", { className: "field" },
            h("span", null, "Filamento"),
            h("select", { value: filamento, onChange: (e) => setFilamento(e.target.value) },
              h("option", { value: "" }, "-"),
              h("option", { value: "PLA" }, "PLA"),
              h("option", { value: "PETG" }, "PETG")
            )
          ),
          h("label", { className: "field" },
            h("span", null, "Descricao"),
            h("textarea", { value: descricao, rows: 3, placeholder: "Detalhes da peca...",
              onChange: (e) => setDescricao(e.target.value) })
          )
        ),
        h("div", { className: "admin-form__row" },
          h("label", { className: clsCampo("peso") },
            h("span", null, "Peso (g) *"),
            h("input", { value: peso, inputMode: "numeric", placeholder: "Ex.: 120",
              onChange: (e) => { setPeso(e.target.value); limparErro("peso"); } }),
            erroCampo("peso")
          ),
          h("label", { className: clsCampo("comprimento") },
            h("span", null, "Comprimento (cm) *"),
            h("input", { value: comprimento, inputMode: "decimal", placeholder: "Ex.: 10",
              onChange: (e) => { setComprimento(e.target.value); limparErro("comprimento"); } }),
            erroCampo("comprimento")
          )
        ),
        h("div", { className: "admin-form__row" },
          h("label", { className: clsCampo("largura") },
            h("span", null, "Largura (cm) *"),
            h("input", { value: largura, inputMode: "decimal", placeholder: "Ex.: 5",
              onChange: (e) => { setLargura(e.target.value); limparErro("largura"); } }),
            erroCampo("largura")
          ),
          h("label", { className: clsCampo("altura") },
            h("span", null, "Altura (cm) *"),
            h("input", { value: altura, inputMode: "decimal", placeholder: "Ex.: 8",
              onChange: (e) => { setAltura(e.target.value); limparErro("altura"); } }),
            erroCampo("altura")
          )
        ),
        h("small", { className: "field__help" }, "Peso e medidas (cm) sao obrigatorios: usados no calculo do frete real."),
        h("div", { className: "admin-form__checks" },
          h("label", { className: "check" },
            h("input", { type: "checkbox", checked: novo,
              onChange: (e) => setNovo(e.target.checked) }),
            h("span", null, "Marcar como \"Novo\"")
          ),
          h("label", { className: "check" },
            h("input", { type: "checkbox", checked: esgotado,
              onChange: (e) => setEsgotado(e.target.checked) }),
            h("span", null, "Esgotado (sem estoque)")
          ),
          h("label", { className: "check" },
            h("input", { type: "checkbox", checked: destaque,
              onChange: (e) => setDestaque(e.target.checked) }),
            h("span", null, "Destacar no topo do catalogo")
          )
        ),
        h("label", { className: "field" },
          h("span", null, "Imagem (comprimida automaticamente)"),
          h("input", { type: "file", accept: "image/*", onChange: escolherArquivo })
        ),
        imagem && h("img", { className: "admin__preview", src: imgSrc(imagem), alt: "Previa" }),
        msgLocal && h("p", { className: "admin__msg" }, msgLocal),
        h("div", { className: "admin-form__acoes" },
          h("button", { type: "button", className: "btn btn--ghost", onClick: onCancelar }, "Cancelar"),
          h("button", { type: "submit", className: "btn btn--primary", disabled: salvando },
            salvando ? "Salvando..." : (editando ? "Salvar alteracoes" : "Adicionar ao catalogo"))
        )
      )
    );
  }

  /* ---------- Assistente: preencher os dados que faltam ----------
     Preenche peso/medidas/preco das pecas com um padrao por categoria.
     Os valores sao PROVISORIOS: o usuario ajusta cada peca depois. */
  const PADRAO_CATEGORIA = {
    decoracao: { peso: 100, comprimento: 10, largura: 10, altura: 10, preco: 49.90 },
    colecionaveis: { peso: 90, comprimento: 8, largura: 6, altura: 10, preco: 99.90 },
    iluminacao: { peso: 400, comprimento: 19, largura: 19, altura: 23, preco: 189.90 },
    escritorio: { peso: 120, comprimento: 12, largura: 10, altura: 10, preco: 39.90 },
    utilidades: { peso: 90, comprimento: 10, largura: 10, altura: 6, preco: 34.90 },
    personalizados: { peso: 80, comprimento: 8, largura: 8, altura: 8, preco: 44.90 }
  };
  const PADRAO_GENERICO = { peso: 100, comprimento: 10, largura: 10, altura: 10, preco: 49.90 };

  function semAcento(t) {
    return String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  }
  function chavePadrao(categoria) {
    return semAcento(categoria).replace(/[^a-z0-9]+/g, "");
  }
  function numDe(v) {
    if (v === null || v === undefined) return null;
    const s = String(v).trim().replace(",", ".");
    if (s === "") return null;
    const n = Number(s);
    return isFinite(n) ? n : null;
  }
  function fmtNum(v) {
    const n = Number(v);
    if (!isFinite(n)) return "";
    return String(n).replace(".", ",");
  }
  function dimTextoBR(c, l, a) {
    if (c == null || l == null || a == null) return "";
    if (!(c > 0 && l > 0 && a > 0)) return "";
    return fmtNum(c) + " x " + fmtNum(l) + " x " + fmtNum(a) + " cm";
  }
  /* O que falta em cada peca e o valor que sera gravado. */
  function calcularAlteracoes(produtos, padroes, corrigirPesoEstranho) {
    const out = [];
    (produtos || []).forEach((p) => {
      const pad = (padroes && padroes[chavePadrao(p.categoria)]) || PADRAO_GENERICO;
      const mud = {};
      const dm = parseDimensoes(p.dimensoes);
      const c0 = numDe(p.comprimento), l0 = numDe(p.largura), a0 = numDe(p.altura);
      let c = c0 > 0 ? c0 : numDe(dm.comprimento);
      let l = l0 > 0 ? l0 : numDe(dm.largura);
      let a = a0 > 0 ? a0 : numDe(dm.altura);
      const medidasMudam = !(c0 > 0 && l0 > 0 && a0 > 0);
      if (!(c > 0 && l > 0 && a > 0)) {
        c = numDe(pad.comprimento); l = numDe(pad.largura); a = numDe(pad.altura);
        if (!(c > 0 && l > 0 && a > 0)) { c = 10; l = 10; a = 10; }
      }
      if (medidasMudam) { mud.comprimento = c; mud.largura = l; mud.altura = a; }
      const peso = numDe(p.peso);
      const pesoEstranho = peso != null && peso > 0 && peso < 10;
      if (peso == null || peso <= 0 || (pesoEstranho && corrigirPesoEstranho)) mud.peso = numDe(pad.peso);
      if (precoDe(p) == null) mud.preco = numDe(pad.preco);
      const textoNovo = dimTextoBR(c, l, a);
      if (textoNovo && medidasMudam && textoNovo !== (p.dimensoes || "")) mud.dimensoes = textoNovo;
      if (Object.keys(mud).length) {
        out.push({ peca: p, mud: mud, pesoEstranho: pesoEstranho && !corrigirPesoEstranho });
      }
    });
    return out;
  }

  function AssistenteDados({ produtos, padroes, onSalvarPadroes, onAplicar, onFechar, aplicando }) {
    const [pad, setPad] = React.useState(() => {
      const base = {};
      Object.keys(PADRAO_CATEGORIA).forEach((k) => { base[k] = Object.assign({}, PADRAO_CATEGORIA[k]); });
      Object.assign(base, padroes || {});
      return base;
    });
    const [corrigirPeso, setCorrigirPeso] = React.useState(false);
    const [desmarca, setDesmarca] = React.useState({});

    const categorias = Array.from(new Set((produtos || []).map((p) => p.categoria).filter(Boolean))).sort();
    const chaves = categorias.map(chavePadrao).filter((k, i, a) => a.indexOf(k) === i);
    const alteracoes = React.useMemo(
      () => calcularAlteracoes(produtos, pad, corrigirPeso),
      [produtos, pad, corrigirPeso]);
    const marcadas = alteracoes.filter((a) => !desmarca[a.peca.id]);
    const marcadasSet = new Set(marcadas.map((a) => a.peca.id));

    const setCampo = (chave, campo, valor) => {
      setPad((ant) => {
        const atual = Object.assign({}, PADRAO_GENERICO, ant[chave] || {});
        const novo = Object.assign({}, atual);
        novo[campo] = valor === "" ? "" : numDe(valor);
        const copia = Object.assign({}, ant);
        copia[chave] = novo;
        return copia;
      });
    };

    const numero = (rotulo, chave, campo, valor, extra) => h("label", { className: "admin-mini" },
      h("span", null, rotulo),
      h("input", { type: "number", step: "any", min: "0", value: valor == null ? "" : valor,
        onChange: (e) => setCampo(chave, campo, e.target.value), ...extra })
    );

    const chips = (a) => {
      const itens = [];
      if (a.mud.peso != null) itens.push(h("span", { className: "admin-chip" },
        "peso ", h("b", null, a.mud.peso + " g"),
        h("em", null, " (era " + (numDe(a.peca.peso) != null ? numDe(a.peca.peso) + " g" : "vazio") + ")")));      if (a.mud.comprimento != null) itens.push(h("span", { className: "admin-chip" },
        "medidas ", h("b", null, dimTextoBR(a.mud.comprimento, a.mud.largura, a.mud.altura))));
      if (a.mud.preco != null) itens.push(h("span", { className: "admin-chip" },
        "preco ", h("b", null, formatBRL(a.mud.preco)), h("em", null, " (era sob consulta)")));
      return h("div", { className: "admin-chips" }, itens);
    };

    return h(React.Fragment, null,
      h("div", { className: "admin-secao" },
        h("h3", null, "Padroes por categoria"),
        h("p", { className: "admin-card__hint" },
          "Valores provisorios aplicados apenas nos campos vazios. Voce pode ajustar aqui: os valores ficam salvos para as proximas vezes."),
        h("div", { className: "admin-padroes" },
          chaves.map((chave) => {
            const cat = categorias.find((c) => chavePadrao(c) === chave) || chave;
            const v = Object.assign({}, PADRAO_GENERICO, pad[chave] || {});
            return h("div", { className: "admin-padrao", key: chave },
              h("div", { className: "admin-padrao__nome" }, cat),
              h("div", { className: "admin-padrao__campos" },
                numero("peso (g)", chave, "peso", v.peso),
                numero("comp (cm)", chave, "comprimento", v.comprimento),
                numero("larg (cm)", chave, "largura", v.largura),
                numero("alt (cm)", chave, "altura", v.altura),
                numero("preco (R$)", chave, "preco", v.preco)
              )
            );
          })
        )
      ),
      h("div", { className: "admin-secao" },
        h("h3", null, "O que sera atualizado"),
        alteracoes.length === 0
          ? h("p", { className: "admin__hint-medidas" }, "Todas as pecas ja tem peso, medidas e preco.")
          : h(React.Fragment, null,
              h("div", { className: "admin-tools admin-tools--fim" },
                h("label", { className: "check check--compact" },
                  h("input", { type: "checkbox", checked: corrigirPeso,
                    onChange: (e) => setCorrigirPeso(e.target.checked) }),
                  h("span", null, "corrigir peso menor que 10 g")
                ),
                h("button", { type: "button", className: "link", onClick: () => setDesmarca({}) },
                  "marcar todas"),
                h("button", { type: "button", className: "link", onClick: () => {
                  const todos = {};
                  alteracoes.forEach((a) => { todos[a.peca.id] = true; });
                  setDesmarca(todos);
                } }, "desmarcar todas")
              ),
              h("ul", { className: "admin-lista" },
                alteracoes.map((a) => h("li", { key: a.peca.id, className: "admin-lista__item" },
                  h("label", { className: "admin-lista__principal" },
                    h("input", { type: "checkbox", checked: marcadasSet.has(a.peca.id),
                      onChange: (e) => setDesmarca((ant) => {
                        const c = Object.assign({}, ant);
                        if (e.target.checked) delete c[a.peca.id]; else c[a.peca.id] = true;
                        return c;
                      }) }),
                    h("span", { className: "admin-lista__nome" }, a.peca.nome),
                    h("span", { className: "admin-cell__sub" }, a.peca.categoria || ""),
                    a.pesoEstranho && h("span", { className: "badge-alerta" }, "peso estranho: " + numDe(a.peca.peso) + " g")
                  ),
                  chips(a)
                ))
              )
            )
      ),
      h("div", { className: "admin-form__acoes" },
        h("button", { type: "button", className: "btn btn--ghost", onClick: onFechar }, "Cancelar"),
        h("button", { type: "button", className: "btn btn--primary", disabled: aplicando || marcadas.length === 0,
          onClick: () => { onSalvarPadroes(pad); onAplicar(marcadas); } },
          aplicando ? "Aplicando..." : ("Aplicar em " + marcadas.length + " pecas"))
      )
    );
  }

  /* ---------- Aba: Catalogo ---------- */
  function AbaCatalogo({ produtos, hero, salvarHero, filtro, padroes, salvarPadroes }) {
    const [busca, setBusca] = React.useState("");
    const [secFiltro, setSecFiltro] = React.useState("todos");
    const [soDestaque, setSoDestaque] = React.useState(false);
    const [soSemMedidas, setSoSemMedidas] = React.useState(false);
    const [soSemPreco, setSoSemPreco] = React.useState(false);
    const [formAberto, setFormAberto] = React.useState(false);
    const [editando, setEditando] = React.useState(null);
    const [assistenteAberto, setAssistenteAberto] = React.useState(false);
    const [msg, setMsg] = React.useState(null);
    const [salvando, setSalvando] = React.useState(false);
    const [importando, setImportando] = React.useState(false);
    const [aplicando, setAplicando] = React.useState(false);
    const [ordenando, setOrdenando] = React.useState(false);

    /* Filtro vindo do Resumo (clique em um card). */
    React.useEffect(() => {
      if (!filtro) return;
      if (filtro.tipo === "semMedidas") setSoSemMedidas(true);
      if (filtro.tipo === "semPreco") setSoSemPreco(true);
      if (filtro.tipo === "esgotados") setSecFiltro("todos");
    }, [filtro]);

    const mostrarMsg = (texto, erro) => setMsg(texto ? { texto: texto, erro: !!erro } : null);

    const abrirNovo = () => { setEditando(null); setFormAberto(true); mostrarMsg("", false); };
    const abrirEdicao = (p) => { setEditando(p); setFormAberto(true); mostrarMsg("", false); };
    const fecharForm = () => { setFormAberto(false); setEditando(null); };

    /* Aplica as alteracoes do assistente em lote (um update por peca). */
    const aplicarDados = async (alteracoes) => {
      if (!window.fbDb || !alteracoes.length) return;
      setAplicando(true);
      mostrarMsg("", false);
      try {
        const lote = window.fbDb.batch();
        const col = window.fbDb.collection("produtos");
        alteracoes.forEach((a) => lote.update(col.doc(a.peca.id), a.mud));
        await lote.commit();
        mostrarMsg(alteracoes.length + " pecas atualizadas com os dados padrao.", false);
        setAssistenteAberto(false);
      } catch (err) {
        mostrarMsg("Erro ao aplicar: " + (err.message || err), true);
      } finally {
        setAplicando(false);
      }
    };

    React.useEffect(() => {
      document.body.classList.toggle("no-scroll", formAberto || assistenteAberto);
      return () => document.body.classList.remove("no-scroll");
    }, [formAberto, assistenteAberto]);

    React.useEffect(() => {
      if (!formAberto && !assistenteAberto) return;
      const onKey = (e) => { if (e.key === "Escape") { fecharForm(); setAssistenteAberto(false); } };
      document.addEventListener("keydown", onKey);
      return () => document.removeEventListener("keydown", onKey);
    }, [formAberto, assistenteAberto]);

    const salvarPeca = async (dados) => {
      if (!window.fbDb) { mostrarMsg("Banco de dados indisponivel.", true); return; }
      setSalvando(true);
      try {
        if (editando) {
          await window.fbDb.collection("produtos").doc(editando.id).update(dados);
          mostrarMsg("Peca atualizada.", false);
        } else {
          dados.ordem = Date.now();
          await window.fbDb.collection("produtos").add(dados);
          mostrarMsg("Peca adicionada com sucesso.", false);
        }
        fecharForm();
      } catch (err) {
        mostrarMsg("Erro ao salvar: " + err.message, true);
      } finally {
        setSalvando(false);
      }
    };

    const remover = async (id, nome) => {
      if (!window.fbDb) return;
      if (!window.confirm("Remover \"" + nome + "\" do catalogo?")) return;
      try {
        await window.fbDb.collection("produtos").doc(id).delete();
        mostrarMsg("Peca removida.", false);
      } catch (err) {
        mostrarMsg("Erro ao remover: " + err.message, true);
      }
    };

    const alternarDestaque = async (p) => {
      if (!window.fbDb) return;
      try {
        await window.fbDb.collection("produtos").doc(p.id).update({ destaque: !p.destaque });
        mostrarMsg(p.destaque ? "\"" + p.nome + "\" saiu do destaque." : "\"" + p.nome + "\" esta em destaque no topo.", false);
      } catch (err) {
        mostrarMsg("Erro ao alterar destaque: " + err.message, true);
      }
    };

    const duplicar = async (p) => {
      if (!window.fbDb) return;
      try {
        await window.fbDb.collection("produtos").add({
          nome: (p.nome || "") + " (copia)",
          categoria: p.categoria || "",
          secao: p.secao === "lancamentos" ? "lancamentos" : "catalogo",
          novo: false,
          esgotado: false,
          destaque: false,
          preco: p.preco != null ? p.preco : null,
          descricao: p.descricao || "",
          filamento: p.filamento || "",
          peso: p.peso != null ? p.peso : null,
          comprimento: p.comprimento != null ? p.comprimento : null,
          largura: p.largura != null ? p.largura : null,
          altura: p.altura != null ? p.altura : null,
          dimensoes: p.dimensoes || "",
          imagem: p.imagem || "assets/images/p1.svg",
          ordem: Date.now()
        });
        mostrarMsg("Copia de \"" + (p.nome || "") + "\" adicionada.", false);
      } catch (err) {
        mostrarMsg("Erro ao duplicar: " + err.message, true);
      }
    };

    const mover = async (id, dir) => {
      if (!window.fbDb || ordenando) return;
      setOrdenando(true);
      try {
        const ordenados = (produtos || []).slice().sort(cmpProd);
        const i = ordenados.findIndex((p) => p.id === id);
        const j = i + dir;
        if (i < 0 || j < 0 || j >= ordenados.length) return;
        let a = ordenados[i], b = ordenados[j];
        if (a.ordem === b.ordem || a.ordem == null || b.ordem == null) {
          b = Object.assign({}, b, { ordem: (a.ordem || 0) + (dir > 0 ? 1 : -1) });
          await window.fbDb.collection("produtos").doc(b.id).update({ ordem: b.ordem });
        } else {
          const lote = window.fbDb.batch();
          const col = window.fbDb.collection("produtos");
          lote.update(col.doc(a.id), { ordem: b.ordem });
          lote.update(col.doc(b.id), { ordem: a.ordem });
          await lote.commit();
        }
      } catch (err) {
        mostrarMsg("Erro ao reordenar: " + err.message, true);
      } finally {
        setOrdenando(false);
      }
    };

    const importar = async () => {
      if (!window.fbDb) return;
      if (!window.confirm("Importar o catalogo atual para o banco de dados?")) return;
      setImportando(true);
      mostrarMsg("", false);
      try {
        const lote = window.fbDb.batch();
        const col = window.fbDb.collection("produtos");
        const base = (window.CATALOGO || []).map((p) => Object.assign({}, p, { secao: "catalogo" }))
          .concat((window.LANCAMENTOS || []).map((p) => Object.assign({}, p, { secao: "lancamentos" })));
        let i = 0;
        base.forEach((p) => {
          const ref = col.doc();
          const dm = parseDimensoes(p.dimensoes);
          const c = p.comprimento != null ? Number(p.comprimento) : (dm.comprimento ? Number(dm.comprimento) : null);
          const l = p.largura != null ? Number(p.largura) : (dm.largura ? Number(dm.largura) : null);
          const a = p.altura != null ? Number(p.altura) : (dm.altura ? Number(dm.altura) : null);
          lote.set(ref, { nome: p.nome, categoria: p.categoria, secao: p.secao,
            novo: !!p.novo, destaque: !!p.destaque, imagem: p.imagem, ordem: i++,
            esgotado: false, preco: null, descricao: "", filamento: "",
            peso: p.peso != null ? Number(p.peso) : null,
            comprimento: c, largura: l, altura: a,
            dimensoes: p.dimensoes || dimTexto(c, l, a) });
        });
        await lote.commit();
        mostrarMsg("Catalogo importado.", false);
      } catch (err) {
        mostrarMsg("Erro ao importar: " + err.message, true);
      } finally {
        setImportando(false);
      }
    };

    const listaBase = (produtos || []).slice().sort(cmpProd);
    const termo = busca.trim().toLowerCase();
    const filtrosAtivos = termo !== "" || secFiltro !== "todos" || soDestaque || soSemMedidas || soSemPreco;
    const lista = listaBase.filter((p) => {
      const secaoP = p.secao || "catalogo";
      if (secFiltro === "catalogo" && secaoP === "lancamentos") return false;
      if (secFiltro === "lancamentos" && secaoP !== "lancamentos") return false;
      if (soDestaque && !p.destaque) return false;
      if (soSemMedidas && temMedidasFrete(p)) return false;
      if (soSemPreco && precoDe(p) != null) return false;
      if (termo !== "" && (((p.nome || "") + " " + (p.categoria || "")).toLowerCase().indexOf(termo) < 0)) return false;
      return true;
    });
    const nDestaques = listaBase.filter((p) => p.destaque).length;
    const semMedidas = listaBase.filter((p) => !temMedidasFrete(p)).length;
    const semPreco = listaBase.filter((p) => precoDe(p) == null).length;
    const categorias = Array.from(new Set(listaBase.map((p) => p.categoria).filter(Boolean))).sort();
    const nDestaqueHero = listaBase.filter((p) => p.destaque).length;

    const limparFiltros = () => {
      setBusca(""); setSecFiltro("todos");
      setSoDestaque(false); setSoSemMedidas(false); setSoSemPreco(false);
    };

    return h("div", { className: "admin-tab" },
      /* Hero (o que aparece no topo da home) */
      h("section", { className: "admin-card admin-card--hero" },
        h("div", { className: "admin-card__head" },
          h("h2", null, "Home"),
          h("span", { className: "admin-card__hint" }, "Define o que aparece no topo da pagina inicial")
        ),
        h("div", { className: "admin-card__body admin-card__body--row" },
          h("label", { className: "field admin-field--inline" },
            h("span", null, "Hero"),
            h("select", { value: hero === "destaques" ? "destaques" : "lancamentos",
              onChange: (e) => salvarHero(e.target.value) },
              h("option", { value: "lancamentos" }, "Lancamentos"),
              h("option", { value: "destaques" }, "Produtos em destaque")
            )
          ),
          h("p", { className: "admin-card__nota" }, nDestaqueHero > 0
            ? (hero === "destaques"
                ? "Mostrando os " + nDestaqueHero + " destacados. Use o estrela para trocar."
                : "Os " + nDestaqueHero + " destacados aparecem no topo do catalogo.")
            : "Marque pecas com o estrela para ve-las aqui.")
        )
      ),

      /* Ferramentas da lista */
      h("section", { className: "admin-card" },
        h("div", { className: "admin-card__head" },
          h("h2", null, "Catalogo"),
          h("div", { className: "admin-card__acoes" },
            h("button", { type: "button", className: "btn btn--primary", onClick: abrirNovo }, "+ Nova peca"),
            h("button", { type: "button", className: "btn btn--ghost", onClick: () => { setAssistenteAberto(true); mostrarMsg("", false); } },
              "Completar dados"),
            h("button", { type: "button", className: "btn btn--ghost", onClick: importar, disabled: importando },
              importando ? "Importando..." : "Importar catalogo atual")
          )
        ),
        h("div", { className: "admin-card__body" },
          h("div", { className: "admin-tools" },
            h("input", { className: "admin__busca", type: "search", value: busca,
              placeholder: "Buscar por nome ou categoria...",
              onChange: (e) => setBusca(e.target.value) }),
            h("select", { className: "admin__sec", value: secFiltro,
              onChange: (e) => setSecFiltro(e.target.value) },
              h("option", { value: "todos" }, "Todas as secoes"),
              h("option", { value: "catalogo" }, "Catalogo"),
              h("option", { value: "lancamentos" }, "Lancamentos")
            ),
            h("label", { className: "check check--compact" },
              h("input", { type: "checkbox", checked: soDestaque,
                onChange: (e) => setSoDestaque(e.target.checked) }),
              h("span", null, "so destaques (" + nDestaques + ")")
            ),
            h("label", { className: "check check--compact" },
              h("input", { type: "checkbox", checked: soSemMedidas,
                onChange: (e) => setSoSemMedidas(e.target.checked) }),
              h("span", null, "sem medidas (" + semMedidas + ")")
            ),
            h("label", { className: "check check--compact" },
              h("input", { type: "checkbox", checked: soSemPreco,
                onChange: (e) => setSoSemPreco(e.target.checked) }),
              h("span", null, "sem preco (" + semPreco + ")")
            ),
            filtrosAtivos && h("button", { type: "button", className: "link", onClick: limparFiltros },
              "Limpar filtros")
          ),
          msg && h("p", { className: "admin__msg" + (msg.erro ? " admin__msg--erro" : "") }, msg.texto),
          h("p", { className: "admin-counts" },
            lista.length + " de " + listaBase.length + " pecas",
            semMedidas > 0 ? h("span", { className: "admin__hint-medidas" }, " " + semMedidas + " sem medidas") : null,
            semPreco > 0 ? h("span", { className: "admin__hint-preco" }, " " + semPreco + " sem preco") : null
          ),
          lista.length === 0
            ? h("p", { className: "drawer__empty" }, "Nenhuma peca corresponde aos filtros.")
            : h("div", { className: "admin-tablewrap" },
              h("table", { className: "admin-table" },
                h("thead", null,
                  h("tr", null,
                    h("th", null, "Peca"),
                    h("th", null, "Categoria"),
                    h("th", null, "Secao"),
                    h("th", null, "Preco"),
                    h("th", null, "Medidas"),
                    h("th", null, "Status"),
                    h("th", { className: "admin-table__acoes" }, "Acoes")
                  )
                ),
                h("tbody", null,
                  lista.map((p, i) => {
                    const m = medidasDe(p);
                    return h("tr", { key: p.id },
                      h("td", null,
                        h("div", { className: "admin-cell__peca" },
                          h("img", { src: imgSrc(p.imagem), alt: p.nome, loading: "lazy" }),
                          h("div", null,
                            h("div", { className: "admin-cell__nome" },
                              h("strong", null, p.nome),
                              p.novo && h("span", { className: "badge-novo" }, "Novo"),
                              p.destaque && h("span", { className: "badge-destaque" }, "Destaque")
                            ),
                            h("span", { className: "admin-cell__sub" }, p.filamento || "")
                          )
                        )
                      ),
                      h("td", null, p.categoria || "-"),
                      h("td", null, p.secao === "lancamentos" ? "Lancamentos" : "Catalogo"),
                      h("td", null, precoDe(p) != null ? formatBRL(precoDe(p))
                        : h("span", { className: "admin-cell__fraco" }, "Sob consulta")),
                      h("td", null, m
                        ? h("span", { className: "admin-cell__medidas" },
                            m.comprimento + "x" + m.largura + "x" + m.altura + " cm",
                            pesoKgDe(p) != null ? h("em", null, " · " + pesoKgDe(p) + " kg") : null)
                        : h("span", { className: "admin-cell__fraco" }, "sem medidas")),
                      h("td", null, p.esgotado
                        ? h("span", { className: "badge-esgotado" }, "Esgotado")
                        : h("span", { className: "badge-ok" }, "Ativo")),
                      h("td", { className: "admin-table__acoes" },
                        h("div", { className: "admin-item-reorder" },
                          h("button", { type: "button", className: "btn-setinha", title: "Mover para cima",
                            disabled: filtrosAtivos || i === 0, onClick: () => mover(p.id, -1),
                            "aria-label": "Mover para cima" }, "▲"),
                          h("button", { type: "button", className: "btn-setinha", title: "Mover para baixo",
                            disabled: filtrosAtivos || i === lista.length - 1, onClick: () => mover(p.id, 1),
                            "aria-label": "Mover para baixo" }, "▼")
                        ),
                        h("button", { type: "button", className: "btn-star" + (p.destaque ? " btn-star--on" : ""),
                          title: p.destaque ? "Remover do destaque" : "Destacar no topo",
                          onClick: () => alternarDestaque(p), "aria-label": "Alternar destaque" }, "★"),
                        h("button", { type: "button", className: "btn-dup",
                          title: "Duplicar peca", onClick: () => duplicar(p), "aria-label": "Duplicar" }, "⧉"),
                        h("button", { type: "button", className: "btn-editar",
                          onClick: () => abrirEdicao(p), "aria-label": "Editar" }, "Editar"),
                        h("button", { type: "button", className: "cart-item__remove",
                          title: "Remover do catalogo", onClick: () => remover(p.id, p.nome),
                          "aria-label": "Remover" }, "×")
                      )
                    );
                  })
                )
              )
            )
        )
      ),

      /* Drawer: formulario da peca */
      formAberto && h(React.Fragment, null,
        h("div", { className: "overlay overlay--show", onClick: fecharForm }),
        h("aside", { className: "drawer drawer--open admin-drawer" },
          h("div", { className: "drawer__head" },
            h("h2", null, editando ? "Editar peca" : "Nova peca"),
            h("button", { type: "button", className: "drawer__close", onClick: fecharForm, "aria-label": "Fechar" }, "×")
          ),
          h("div", { className: "drawer__body" },
            h(PecaForm, {
              key: editando ? editando.id : "nova",
              produto: editando,
              categorias: categorias,
              salvando: salvando,
              onSalvar: salvarPeca,
              onCancelar: fecharForm
            })
          )
        )
      ),

      /* Drawer: assistente de dados */
      assistenteAberto && h(React.Fragment, null,
        h("div", { className: "overlay overlay--show", onClick: () => setAssistenteAberto(false) }),
        h("aside", { className: "drawer drawer--open admin-drawer admin-drawer--wide" },
          h("div", { className: "drawer__head" },
            h("h2", null, "Completar dados"),
            h("button", { type: "button", className: "drawer__close",
              onClick: () => setAssistenteAberto(false), "aria-label": "Fechar" }, "×")
          ),
          h("div", { className: "drawer__body" },
            h(AssistenteDados, {
              produtos: produtos,
              padroes: padroes,
              onSalvarPadroes: salvarPadroes,
              onAplicar: aplicarDados,
              onFechar: () => setAssistenteAberto(false),
              aplicando: aplicando
            })
          )
        )
      )
    );
  }

  /* ---------- Aba: Frete ---------- */
  function AbaFrete({ frete, onSalvar }) {
    const [fCep, setFCep] = React.useState("");
    const [fGratis, setFGratis] = React.useState("");
    const [fPesoIncl, setFPesoIncl] = React.useState("");
    const [fPesoExc, setFPesoExc] = React.useState("");
    const [fEndpoint, setFEndpoint] = React.useState("");
    const [fTab, setFTab] = React.useState(() => tabelaParaArray(window.FRETE_TABELA));
    const [msg, setMsg] = React.useState(null);
    const [salvando, setSalvando] = React.useState(false);
    const [testando, setTestando] = React.useState(false);

    React.useEffect(() => {
      const f = frete || {};
      setFCep(f.cepOrigem || "");
      setFGratis(f.freteGratis ? String(f.freteGratis) : "");
      setFPesoIncl(f.pesoIncluidoKg ? String(f.pesoIncluidoKg) : "");
      setFPesoExc(f.valorKgExcedente ? String(f.valorKgExcedente) : "");
      setFEndpoint(f.endpoint || "");
      setFTab(Array.isArray(f.tabelaFrete) && f.tabelaFrete.length === 10
        ? f.tabelaFrete.map((v) => (v == null ? "" : String(v)))
        : tabelaParaArray(window.FRETE_TABELA));
    }, [frete]);

    const mostrarMsg = (texto, erro) => setMsg(texto ? { texto: texto, erro: !!erro } : null);

    const salvar = async () => {
      const num = (v) => { const n = Number(String(v).replace(",", ".")); return isFinite(n) ? n : 0; };
      const freteObj = {
        cepOrigem: String(fCep).replace(/\D/g, "").slice(0, 8),
        freteGratis: String(fGratis).trim() === "" ? 0 : num(fGratis),
        pesoIncluidoKg: String(fPesoIncl).trim() === "" ? 0 : num(fPesoIncl),
        valorKgExcedente: String(fPesoExc).trim() === "" ? 0 : num(fPesoExc),
        endpoint: String(fEndpoint).trim(),
        tabelaFrete: fTab.map((v) => num(v))
      };
      setSalvando(true);
      try {
        await onSalvar(freteObj);
        mostrarMsg("Configuracoes de frete salvas.", false);
      } catch (err) {
        mostrarMsg("Erro ao salvar frete: " + err.message, true);
      } finally {
        setSalvando(false);
      }
    };

    /* Testa o endpoint do Worker com o CEP de origem informado, para validar
       a cotacao real antes de o cliente final usa-la. */
    const testarCotacao = async () => {
      const base = String(fEndpoint || "").trim().replace(/\/+$/, "");
      const cepOrigem = String(fCep || "").replace(/\D/g, "").slice(0, 8);
      if (!base) { mostrarMsg("Informe o endpoint do Worker antes de testar.", true); return; }
      if (cepOrigem.length !== 8) { mostrarMsg("Informe um CEP de origem com 8 digitos.", true); return; }
      setTestando(true);
      mostrarMsg("Testando cotacao...", false);
      try {
        const resp = await fetch(base + "/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cepOrigem: cepOrigem, cep: cepOrigem,
            items: [{ id: "teste", width: 16, height: 10, length: 20, weight: 0.6, insurance_value: 120, quantity: 1 }]
          })
        });
        const txt = await resp.text();
        let data = null; try { data = JSON.parse(txt); } catch (e) {}
        if (!resp.ok) {
          const det = data && (data.detalhe || data.erro) ? (data.detalhe || data.erro) : txt.slice(0, 300);
          mostrarMsg("Falha na cotacao (" + resp.status + "): " + det, true);
          return;
        }
        const ops = (data && data.opcoes) || [];
        if (!ops.length) { mostrarMsg("O Worker respondeu sem opcoes de frete.", true); return; }
        const resumo = ops.map((o) =>
          ([o.empresa, o.servico].filter(Boolean).join(" ") + " " + formatBRL(o.preco) + (o.prazo != null ? " (" + o.prazo + "d)" : ""))
        ).join(" · ");
        mostrarMsg("Cotacao OK — " + resumo, false);
      } catch (err) {
        mostrarMsg("Nao foi possivel falar com o Worker: " + (err && err.message || err), true);
      } finally {
        setTestando(false);
      }
    };

    const maxTab = Math.max.apply(null, fTab.map((v) => Number(String(v).replace(",", ".")) || 0).concat([1]));

    return h("div", { className: "admin-tab" },
      h("section", { className: "admin-card" },
        h("div", { className: "admin-card__head" },
          h("h2", null, "Calculo do frete"),
          h("span", { className: "admin-card__hint" }, "Valores usados no checkout do site")
        ),
        h("div", { className: "admin-card__body" },
          h("div", { className: "admin-form__row" },
            h("label", { className: "field" },
              h("span", null, "CEP de origem"),
              h("input", { value: fCep, inputMode: "numeric", placeholder: "00000000",
                onChange: (e) => setFCep(e.target.value.replace(/\D/g, "").slice(0, 8)) })
            ),
            h("label", { className: "field" },
              h("span", null, "Frete gratis acima de (R$)"),
              h("input", { value: fGratis, inputMode: "decimal", placeholder: "0 = desligado",
                onChange: (e) => setFGratis(e.target.value) })
            )
          ),
          h("div", { className: "admin-form__row" },
            h("label", { className: "field" },
              h("span", null, "Peso incluso (kg)"),
              h("input", { value: fPesoIncl, inputMode: "decimal", placeholder: "Ex.: 1",
                onChange: (e) => setFPesoIncl(e.target.value) })
            ),
            h("label", { className: "field" },
              h("span", null, "Adicional por kg excedente (R$)"),
              h("input", { value: fPesoExc, inputMode: "decimal", placeholder: "Ex.: 5",
                onChange: (e) => setFPesoExc(e.target.value) })
            )
          ),
          h("label", { className: "field" },
            h("span", null, "Endpoint de cotacao real (Worker)"),
            h("input", { value: fEndpoint, placeholder: "https://spacetek-frete.SUA-CONTA.workers.dev",
              onChange: (e) => setFEndpoint(e.target.value) }),
            h("small", { className: "field__help" },
              fEndpoint.trim()
                ? "Cotacao real ativa. Sem resposta, usa a estimativa da tabela."
                : "Opcional. Preencha apos publicar o Worker para ativar a cotacao real.")
          ),
          h("div", { className: "admin-frete__acoes" },
            h("button", { type: "button", className: "btn btn--primary", onClick: salvar, disabled: salvando },
              salvando ? "Salvando..." : "Salvar configuracoes de frete"),
            h("button", { type: "button", className: "btn btn--ghost", onClick: testarCotacao, disabled: testando },
              testando ? "Testando..." : "Testar cotacao")
          ),
          msg && h("p", { className: "admin__msg" + (msg.erro ? " admin__msg--erro" : "") }, msg.texto)
        )
      ),

      h("section", { className: "admin-card" },
        h("div", { className: "admin-card__head" },
          h("h2", null, "Tabela por regiao"),
          h("span", { className: "admin-card__hint" }, "1o digito do CEP — estimativa usada quando a cotacao real nao responde")
        ),
        h("div", { className: "admin-card__body" },
          h("div", { className: "admin-frete__tab" },
            fTab.map((v, i) => h("label", { key: i, className: "field field--mini" },
              h("span", null, REGIOES_CEP[i]),
              h("input", { value: v, inputMode: "decimal",
                onChange: (e) => { const c = fTab.slice(); c[i] = e.target.value; setFTab(c); } })
            ))
          ),
          h("div", { className: "admin-regioes" },
            fTab.map((v, i) => {
              const n = Number(String(v).replace(",", ".")) || 0;
              return h("div", { className: "admin-regiao", key: i },
                h("div", { className: "admin-regiao__barra" },
                  h("i", { style: { width: Math.max(4, Math.round((n / maxTab) * 100)) + "%" } })),
                h("span", { className: "admin-regiao__nome" }, REGIOES_CEP[i]),
                h("span", { className: "admin-regiao__valor" }, n > 0 ? formatBRL(n) : "-")
              );
            })
          )
        )
      )
    );
  }

  /* ---------- Aba: Resumo ---------- */
  function AbaResumo({ produtos, cfg, irPara }) {
    const [status, setStatus] = React.useState(null);
    const [verificando, setVerificando] = React.useState(false);

    const base = (produtos || []).slice().sort(cmpProd);
    const total = base.length;
    const destaques = base.filter((p) => p.destaque).length;
    const lancamentos = base.filter((p) => (p.secao || "catalogo") === "lancamentos").length;
    const esgotados = base.filter((p) => p.esgotado).length;
    const semMedidas = base.filter((p) => !temMedidasFrete(p)).length;
    const semPreco = base.filter((p) => precoDe(p) == null).length;
    const comPreco = total - semPreco;
    const cotaveis = total - semMedidas;

    const endpoint = (cfg && cfg.frete && cfg.frete.endpoint) || "";

    const verificar = async () => {
      const base2 = String(endpoint || "").trim().replace(/\/+$/, "");
      if (!base2) { setStatus({ texto: "Endpoint do Worker nao configurado.", erro: true }); return; }
      setVerificando(true);
      try {
        const resp = await fetch(base2 + "/health");
        const txt = await resp.text();
        let data = null; try { data = JSON.parse(txt); } catch (e) {}
        if (!resp.ok) {
          setStatus({ texto: "Worker respondeu " + resp.status + ": " + txt.slice(0, 200), erro: true });
          return;
        }
        const st = data && data.servicos ? (" · " + data.servicos) : "";
        setStatus({ texto: "Worker online (provedor " + ((data && data.provedor) || "?") + ")" + st, erro: false });
      } catch (err) {
        setStatus({ texto: "Nao foi possivel falar com o Worker: " + (err && err.message || err), erro: true });
      } finally {
        setVerificando(false);
      }
    };

    const card = (titulo, valor, nota, onClick) =>
      h("button", { type: "button", className: "admin-stat" + (onClick ? " admin-stat--link" : ""), onClick: onClick },
        h("span", { className: "admin-stat__valor" }, String(valor)),
        h("span", { className: "admin-stat__titulo" }, titulo),
        nota && h("span", { className: "admin-stat__nota" }, nota)
      );

    return h("div", { className: "admin-tab" },
      h("section", { className: "admin-card" },
        h("div", { className: "admin-card__head" },
          h("h2", null, "Visao geral"),
          h("span", { className: "admin-card__hint" }, "Atualiza em tempo real a cada alteracao no catalogo")
        ),
        h("div", { className: "admin-card__body" },
          h("div", { className: "admin-stats" },
            card("Pecas no catalogo", total, total ? "Clique para ver" : null, () => irPara({ tipo: "todos" })),
            card("Destaques", destaques, "Aparecem no topo"),
            card("Lancamentos", lancamentos, "Secao de novidades"),
            card("Esgotados", esgotados, "Sem estoque"),
            card("Sem medidas", semMedidas, "Nao entram na cotacao real", () => irPara({ tipo: "semMedidas" })),
            card("Sem preco", semPreco, "Aparecem como 'Sob consulta'", () => irPara({ tipo: "semPreco" }))
          ),
          semMedidas > 0 && h("div", { className: "admin-alert" },
            h("strong", null, semMedidas + " pecas sem peso/medidas"),
            h("span", null, "Sem esses dados o cliente ve 'frete a calcular'. Preencha peso e medidas para ativar a cotacao real."),
            h("button", { type: "button", className: "btn btn--ghost", onClick: () => irPara({ tipo: "semMedidas" }) },
              "Ver pecas")
          ),
          semPreco > 0 && h("div", { className: "admin-alert admin-alert--leve" },
            h("strong", null, semPreco + " pecas sem preco"),
            h("span", null, "O orcamento sai como 'Sob consulta'. Cadastre o preco para o total sair fechado."),
            h("button", { type: "button", className: "btn btn--ghost", onClick: () => irPara({ tipo: "semPreco" }) },
              "Ver pecas")
          )
        )
      ),

      h("section", { className: "admin-card" },
        h("div", { className: "admin-card__head" },
          h("h2", null, "Frete e cotacao"),
          h("div", { className: "admin-card__acoes" },
            h("button", { type: "button", className: "btn btn--ghost", onClick: verificar, disabled: verificando },
              verificando ? "Verificando..." : "Verificar Worker agora")
          )
        ),
        h("div", { className: "admin-card__body" },
          h("div", { className: "admin-info" },
            h("div", { className: "admin-info__linha" },
              h("span", null, "Cotacao real"),
              h("strong", null, endpoint ? "Ativada" : "Desativada")
            ),
            h("div", { className: "admin-info__linha" },
              h("span", null, "Endpoint"),
              h("code", null, endpoint || "nao configurado")
            ),
            h("div", { className: "admin-info__linha" },
              h("span", null, "CEP de origem"),
              h("code", null, ((cfg && cfg.frete && cfg.frete.cepOrigem) || "nao configurado"))
            ),
            h("div", { className: "admin-info__linha" },
              h("span", null, "Pecas prontas para cotar"),
              h("strong", null, cotaveis + " de " + total)
            ),
            h("div", { className: "admin-info__linha" },
              h("span", null, "Pecas com preco"),
              h("strong", null, comPreco + " de " + total)
            )
          ),
          status && h("p", { className: "admin__msg" + (status.erro ? " admin__msg--erro" : "") }, status.texto),
          h("p", { className: "admin-card__nota" }, "Ultima atualizacao da pagina: " + dataHora())
        )
      )
    );
  }

  /* ---------- App ---------- */
  function AdminApp() {
    const [user, setUser] = React.useState(null);
    const [pronto, setPronto] = React.useState(false);
    const [produtos, setProdutos] = React.useState(null);
    const [cfg, setCfg] = React.useState({});
    const [aba, setAba] = React.useState("catalogo");
    const [filtro, setFiltro] = React.useState(null);
    const [logoOk, setLogoOk] = React.useState(true);

    React.useEffect(() => {
      if (!window.fbAuth) { setPronto(true); return; }
      return window.fbAuth.onAuthStateChanged((u) => { setUser(u); setPronto(true); });
    }, []);

    React.useEffect(() => {
      if (!window.fbDb) { setProdutos([]); return; }
      let unsub = null;
      try {
        unsub = window.fbDb.collection("produtos").orderBy("ordem", "asc").onSnapshot(
          (snap) => setProdutos(snap.docs.map((d) => Object.assign({ id: d.id }, d.data()))),
          (err) => { console.warn("Firestore:", err.message); setProdutos([]); }
        );
      } catch (e) { setProdutos([]); }
      return () => { if (unsub) unsub(); };
    }, []);

    React.useEffect(() => {
      if (!window.fbDb) return;
      let unsub = null;
      try {
        unsub = window.fbDb.collection("produtos").doc("_site").onSnapshot(
          (snap) => {
            const d = snap.exists ? snap.data() : {};
            setCfg({ hero: d.hero, frete: d.frete, dadosPadrao: d.dadosPadrao || null });
          },
          (err) => { console.warn("Firestore config:", err.code || err.message); }
        );
      } catch (e) { /* ignora */ }
      return () => { if (unsub) unsub(); };
    }, []);

    const salvarHero = async (v) => {
      if (!window.fbDb) return;
      try {
        /* Config guardada em "_site" (mesma colecao dos produtos, sem "ordem",
           entao fica fora da listagem) para usar as mesmas regras do Firestore. */
        await window.fbDb.collection("produtos").doc("_site").set({ hero: v }, { merge: true });
      } catch (err) {
        console.warn("Falha ao salvar config do Hero:", err.code || err.message);
      }
    };

    const salvarFrete = async (freteObj) => {
      if (!window.fbDb) throw new Error("Banco de dados indisponivel.");
      await window.fbDb.collection("produtos").doc("_site").set({ frete: freteObj }, { merge: true });
    };

    /* Padroes por categoria (usados pelo assistente "Completar dados"). */
    const salvarPadroes = async (padroes) => {
      if (!window.fbDb) return;
      try {
        await window.fbDb.collection("produtos").doc("_site").set({ dadosPadrao: padroes }, { merge: true });
      } catch (err) {
        console.warn("Falha ao salvar os padroes:", err.code || err.message);
      }
    };

      const irPara = (f) => { setFiltro(Object.assign({ seq: Date.now() }, f || {})); setAba("catalogo"); };

      const getIdToken = async () => {
        try {
          if (window.fbAuth && window.fbAuth.currentUser) return await window.fbAuth.currentUser.getIdToken();
        } catch (e) {}
        return "";
      };

      const sair = () => { if (window.fbAuth) window.fbAuth.signOut(); };

    if (!pronto) {
      return h("div", { className: "admin-boot" },
        h("div", { className: "admin-boot__card" }, h("p", null, "Carregando painel..."))
      );
    }
    if (!user) {
      return h(AdminLogin, { onSuccess: () => {} });
    }

      const abas = [
        { id: "catalogo", label: "Catalogo" },
        { id: "frete", label: "Frete" },
        { id: "pedidos", label: "Pedidos" },
        { id: "resumo", label: "Resumo" }
      ];

    return h("div", { className: "admin" },
      h("header", { className: "admin-topbar" },
        h("div", { className: "admin-topbar__left" },
          logoOk
            ? h("img", { className: "admin-topbar__logo", src: "../assets/images/logo.jpg", alt: "SpaceTek",
                onError: () => setLogoOk(false) })
            : h("span", { className: "admin-topbar__marca" }, "SpaceTek"),
          h("span", { className: "admin-topbar__titulo" }, "Painel do administrador")
        ),
        h("nav", { className: "admin-tabs" },
          abas.map((a) => h("button", { key: a.id, type: "button",
            className: "admin-tabs__btn" + (aba === a.id ? " admin-tabs__btn--on" : ""),
            onClick: () => setAba(a.id) }, a.label))
        ),
        h("div", { className: "admin-topbar__right" },
          h("span", { className: "admin-topbar__user" }, user.email),
          h("a", { className: "btn btn--ghost btn--sm", href: "../" }, "Ver site"),
          h("button", { type: "button", className: "btn btn--ghost btn--sm", onClick: sair }, "Sair")
        )
      ),
        h("main", { className: "admin-main" },
          aba === "catalogo"
            ? h(AbaCatalogo, { produtos: produtos || [], hero: cfg.hero, salvarHero: salvarHero,
                filtro: filtro, padroes: cfg.dadosPadrao, salvarPadroes: salvarPadroes })
            : aba === "frete"
              ? h(AbaFrete, { frete: cfg.frete, onSalvar: salvarFrete })
              : aba === "pedidos"
                ? h(AbaPedidos, { getIdToken: getIdToken })
                : h(AbaResumo, { produtos: produtos || [], cfg: cfg, irPara: irPara })
        )
    );
  }

  /* ---------- Aba: Pedidos ---------- */
  function AbaPedidos({ getIdToken }) {
    const worker = window.WORKER_URL || "https://spacetek-frete.spacetek.workers.dev";
    const [pedidos, setPedidos] = React.useState([]);
    const [carregando, setCarregando] = React.useState(false);
    const [erro, setErro] = React.useState("");
    const [filtro, setFiltro] = React.useState("todos");
    const [atualizando, setAtualizando] = React.useState(null);

    const carregar = async () => {
      setCarregando(true);
      setErro("");
      try {
        const token = await getIdToken();
        const resp = await fetch(worker + "/orders", { headers: { "Authorization": token ? "Bearer " + token : "" } });
        const data = await resp.json().catch(() => ({ pedidos: [] }));
        if (resp.status === 403) { setErro("Nao autorizado. Configure ADMIN_EMAILS ou faca login com conta autorizada."); setPedidos([]); }
        else if (data.pedidos) setPedidos(data.pedidos);
        else setPedidos([]);
      } catch (e) {
        setErro("Falha ao carregar pedidos.");
        setPedidos([]);
      }
      setCarregando(false);
    };

    React.useEffect(() => { carregar(); }, []);

    const atualizar = async (id, status) => {
      setAtualizando(id);
      try {
        const token = await getIdToken();
        await fetch(worker + "/orders/" + id, { method: "PATCH", headers: { "Content-Type": "application/json", "Authorization": token ? "Bearer " + token : "" }, body: JSON.stringify({ status: status }) });
        await carregar();
      } catch (e) {}
      setAtualizando(null);
    };

    const lista = pedidos.filter((p) => filtro === "todos" ? true : p.status === filtro);
    const statusLabel = { novo: "Novo", em_andamento: "Em andamento", enviado: "Enviado", entregue: "Entregue", cancelado: "Cancelado" };
    const statusCor = { novo: "badge-destaque", em_andamento: "badge-novo", enviado: "badge-ok", entregue: "badge-ok", cancelado: "badge-esgotado" };

    return h("section", { className: "admin-section" },
      h("div", { className: "admin-section__head" },
        h("div", null,
          h("h2", null, "Pedidos"),
          h("p", null, "Pedidos registrados via site (checkout 'Registrar + abrir WhatsApp').")
        ),
        h("div", { className: "admin-section__actions" },
          h("select", { value: filtro, onChange: (e) => setFiltro(e.target.value), className: "admin-select" },
            h("option", { value: "todos" }, "Todos"),
            h("option", { value: "novo" }, "Novos"),
            h("option", { value: "em_andamento" }, "Em andamento"),
            h("option", { value: "enviado" }, "Enviados"),
            h("option", { value: "entregue" }, "Entregues"),
            h("option", { value: "cancelado" }, "Cancelados")
          ),
          h("button", { type: "button", className: "btn btn--ghost btn--sm", onClick: carregar }, carregando ? "Atualizando..." : "Atualizar")
        )
      ),
      erro && h("p", { className: "admin__msg admin__msg--erro" }, erro),
      lista.length === 0 && !carregando && h("p", { className: "drawer__empty" }, "Nenhum pedido encontrado."),
      lista.length > 0 && h("div", { className: "admin-tablewrap" },
        h("table", { className: "admin-table" },
          h("thead", null,
            h("tr", null,
              h("th", null, "Pedido"),
              h("th", null, "Cliente"),
              h("th", null, "Itens"),
              h("th", null, "Total"),
              h("th", null, "Status"),
              h("th", { className: "admin-table__acoes" }, "Acoes")
            )
          ),
          h("tbody", null,
            lista.map((p) => {
              const total = p.total != null ? formatBRL(p.total) : (p.subtotal != null ? formatBRL(p.subtotal) : "-");
              const itens = Array.isArray(p.itens) ? p.itens : [];
              return h("tr", { key: p.id },
                h("td", null,
                  h("strong", null, p.id ? p.id.slice(0,8) : "-"),
                  h("br", null),
                  h("span", { className: "admin-cell__sub" }, p.criadoEm ? dataHora(p.criadoEm) : "")
                ),
                h("td", null,
                  h("div", null, h("strong", null, p.nome || "-")),
                  p.contato && h("div", { className: "admin-cell__sub" }, p.contato),
                  p.cep && h("div", { className: "admin-cell__sub" }, "CEP: " + p.cep)
                ),
                h("td", null, itens.map((i) => (i.nome || i.id) + " x" + (i.qtd||1)).join(", ")),
                h("td", null, h("strong", null, total)),
                h("td", null, h("span", { className: statusCor[p.status] || "badge-novo" }, statusLabel[p.status] || p.status || "novo")),
                h("td", { className: "admin-table__acoes" },
                  h("select", { value: p.status || "novo", disabled: atualizando === p.id, onChange: (e) => atualizar(p.id, e.target.value), className: "admin-select admin-select--sm" },
                    h("option", { value: "novo" }, "Novo"),
                    h("option", { value: "em_andamento" }, "Em andamento"),
                    h("option", { value: "enviado" }, "Enviado"),
                    h("option", { value: "entregue" }, "Entregue"),
                    h("option", { value: "cancelado" }, "Cancelado")
                  )
                )
              );
            })
          )
        )
      )
    );
  }

  window.AdminApp = AdminApp;
})();
