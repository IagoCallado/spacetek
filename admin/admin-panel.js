/* ============================================================
   SpaceTek — Painel administrativo
   ----------------------------------------------------------
   Carregado por index.html como JSX externo:
     <script type="text/babel" data-presets="react"
             src="admin/admin-panel.js?v=<versao>"></script>

   IMPORTANTE: o Babel busca este arquivo via XHR, entao ele so
   carrega via http(s) (site publicado). Abrindo o index.html
   direto do disco (file://) o painel mostra um aviso.

   Depende dos helpers compartilhados em js/comum.js:
     h, useOverlayClose, REGIOES_CEP, window.FRETE_TABELA, precoDe,
     cmpProd, formatBRL, parseDimensoes, pesoKgDe, medidasDe,
     temMedidasFrete

   Expoe: window.AdminLogin, window.AdminPanel
   ============================================================ */
(function () {

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
  /* Converte a tabela (objeto por dígito ou array) em array de strings [0..9]. */
  function tabelaParaArray(t) {
    const arr = [];
    for (let i = 0; i < 10; i++) arr.push(t && t[i] != null ? String(t[i]) : "");
    return arr;
  }
  /* ---------- Admin: login ---------- */
  function AdminLogin({ onClose, onSuccess }) {
    const [usuario, setUsuario] = React.useState("");
    const [senha, setSenha] = React.useState("");
    const [erro, setErro] = React.useState("");
    const [carregando, setCarregando] = React.useState(false);
    const overlayProps = useOverlayClose(onClose);

    const entrar = async (e) => {
      e.preventDefault();
      setErro("");
      if (!usuario.trim() || !senha) { setErro("Preencha usuário e senha."); return; }
      if (!window.fbAuth) { setErro("Autenticação indisponível. Verifique a conexão."); return; }
      const email = usuario.indexOf("@") >= 0 ? usuario.trim() : usuario.trim().toLowerCase() + "@spacetek.com";
      setCarregando(true);
      try {
        await window.fbAuth.signInWithEmailAndPassword(email, senha);
        onSuccess();
      } catch (err) {
        setErro("Usuário ou senha inválidos.");
      } finally {
        setCarregando(false);
      }
    };

    return h("div", Object.assign({ className: "modal-overlay" }, overlayProps),
      h("form", { className: "modal admin-login", onClick: (e) => e.stopPropagation(), onSubmit: entrar },
        h("button", { type: "button", className: "modal__close", onClick: onClose, "aria-label": "Fechar" }, "×"),
        h("h2", { className: "modal__title" }, "Área do administrador"),
        h("label", { className: "field" },
          h("span", null, "Usuário"),
          h("input", { value: usuario, placeholder: "admin", autoFocus: true,
            onChange: (e) => setUsuario(e.target.value) })
        ),
        h("label", { className: "field" },
          h("span", null, "Senha"),
          h("input", { type: "password", value: senha, placeholder: "••••••••",
            onChange: (e) => setSenha(e.target.value) })
        ),
      erro && h("p", { className: "quote__erro" }, erro),
        h("button", { type: "submit", className: "btn btn--primary btn--block", disabled: carregando },
          carregando ? "Entrando..." : "Entrar")
      )
    );
  }

  /* ---------- Autocomplete de categoria ---------- */
  function CatAutocomplete({ value, onChange, categorias }) {
    const [aberto, setAberto] = React.useState(false);
    const termo = (value || "").toLowerCase();
    const sugestoes = (categorias || []).filter((c) => c.toLowerCase().indexOf(termo) >= 0);
    return h("div", { className: "autocomplete" },
      h("input", { value: value, placeholder: "Ex.: Decoração",
        onChange: (e) => { onChange(e.target.value); setAberto(true); },
        onFocus: () => setAberto(true),
        onBlur: () => setTimeout(() => setAberto(false), 150) }),
      aberto && sugestoes.length > 0 && h("ul", { className: "autocomplete__list" },
        sugestoes.map((c) => h("li", { key: c,
          onMouseDown: (e) => { e.preventDefault(); onChange(c); setAberto(false); } }, c))
      )
    );
  }

  /* ---------- Admin: painel ---------- */
  function AdminPanel({ user, produtos, categorias, onClose, onLogout, hero, frete }) {
    const [nome, setNome] = React.useState("");
    const [categoria, setCategoria] = React.useState("");
    const [secao, setSecao] = React.useState("catalogo");
    const [novo, setNovo] = React.useState(false);
    const [esgotado, setEsgotado] = React.useState(false);
    const [destaque, setDestaque] = React.useState(false);
    const [imagem, setImagem] = React.useState("");
    const [preco, setPreco] = React.useState("");
    const [descricao, setDescricao] = React.useState("");
    const [filamento, setFilamento] = React.useState("");
    const [peso, setPeso] = React.useState("");
    const [comprimento, setComprimento] = React.useState("");
    const [largura, setLargura] = React.useState("");
    const [altura, setAltura] = React.useState("");
    const [editando, setEditando] = React.useState(null);
    const [msg, setMsg] = React.useState("");
    const [msgErro, setMsgErro] = React.useState(false);
    const [erros, setErros] = React.useState({});
    const [saving, setSaving] = React.useState(false);
    const [importando, setImportando] = React.useState(false);
    const [busca, setBusca] = React.useState("");
    const [secFiltro, setSecFiltro] = React.useState("todos");
    const [soDestaque, setSoDestaque] = React.useState(false);
    const [ordenando, setOrdenando] = React.useState(false);
    const formRef = React.useRef(null);
    const [fCep, setFCep] = React.useState("");
    const [fGratis, setFGratis] = React.useState("");
    const [fPesoIncl, setFPesoIncl] = React.useState("");
    const [fPesoExc, setFPesoExc] = React.useState("");
    const [fEndpoint, setFEndpoint] = React.useState("");
    const [fTab, setFTab] = React.useState(() => tabelaParaArray(window.FRETE_TABELA));
    /* Mensagens proprias do bloco de frete (nao usam a msg do form de pecas,
       que fica em outra coluna e nao aparece perto do botao de salvar). */
    const [msgFrete, setMsgFrete] = React.useState("");
    const [msgFreteErro, setMsgFreteErro] = React.useState(false);
    const [salvandoFrete, setSalvandoFrete] = React.useState(false);
    const [testandoFrete, setTestandoFrete] = React.useState(false);

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

    React.useEffect(() => {
      const onKey = (e) => { if (e.key === "Escape") onClose(); };
      document.addEventListener("keydown", onKey);
      return () => document.removeEventListener("keydown", onKey);
    }, [onClose]);

    const mostrarMsg = (texto, erro) => { setMsg(texto); setMsgErro(!!erro); };
    const mostrarMsgFrete = (texto, erro) => { setMsgFrete(texto); setMsgFreteErro(!!erro); };
    const limparErro = (campo) => setErros((e) => (e[campo] ? Object.assign({}, e, { [campo]: "" }) : e));
    const erroCampo = (campo) => erros[campo] && h("small", { className: "field__erro" }, erros[campo]);
    const clsCampo = (campo) => "field" + (erros[campo] ? " field--erro" : "");

    const escolherArquivo = async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      mostrarMsg("Processando imagem...", false);
      try {
        const dataUrl = await comprimirImagem(file);
        setImagem(dataUrl);
        mostrarMsg("", false);
      } catch (err) {
        mostrarMsg("Falha ao processar a imagem.", true);
      }
    };

    const limparForm = () => {
      setNome(""); setCategoria(""); setSecao("catalogo"); setNovo(false); setEsgotado(false);
      setDestaque(false);
      setImagem(""); setPreco(""); setDescricao(""); setFilamento("");
      setPeso(""); setComprimento(""); setLargura(""); setAltura(""); setEditando(null);
      setErros({});
    };

    const salvar = async (ev) => {
      ev.preventDefault();
      mostrarMsg("", false);
      const precoNum = preco === "" ? null : Number(String(preco).replace(",", "."));
      const pesoNum = peso === "" ? null : Number(String(peso).replace(",", "."));
      const compNum = comprimento === "" ? null : Number(String(comprimento).replace(",", "."));
      const largNum = largura === "" ? null : Number(String(largura).replace(",", "."));
      const altNum = altura === "" ? null : Number(String(altura).replace(",", "."));
      const e = {};
      if (!nome.trim()) e.nome = "Informe o nome da peça.";
      if (!categoria.trim()) e.categoria = "Informe a categoria.";
      if (preco !== "" && (!isFinite(precoNum) || precoNum < 0)) {
        e.preco = "Preço inválido. Use apenas números, ex.: 49.90";
      }
      if (pesoNum == null || !isFinite(pesoNum) || pesoNum <= 0) {
        e.peso = "Informe o peso em gramas (ex.: 120).";
      }
      if (compNum == null || !isFinite(compNum) || compNum <= 0) e.comprimento = "Informe em cm (ex.: 10).";
      if (largNum == null || !isFinite(largNum) || largNum <= 0) e.largura = "Informe em cm (ex.: 5).";
      if (altNum == null || !isFinite(altNum) || altNum <= 0) e.altura = "Informe em cm (ex.: 8).";
      setErros(e);
      if (Object.keys(e).some((k) => e[k])) return;
      if (!window.fbDb) { mostrarMsg("Banco de dados indisponível.", true); return; }
      const dados = {
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
        dimensoes: dimTexto(compNum, largNum, altNum)
      };
      dados.imagem = imagem || "assets/images/p1.svg";
      setSaving(true);
      try {
        if (editando) {
          await window.fbDb.collection("produtos").doc(editando).update(dados);
          mostrarMsg("Peça atualizada.", false);
        } else {
          dados.ordem = Date.now();
          await window.fbDb.collection("produtos").add(dados);
          mostrarMsg("Peça adicionada com sucesso.", false);
        }
        limparForm();
      } catch (err) {
        mostrarMsg("Erro ao salvar: " + err.message, true);
      } finally {
        setSaving(false);
      }
    };

    const editar = (p) => {
      setEditando(p.id);
      setNome(p.nome || "");
      setCategoria(p.categoria || "");
      setSecao(p.secao === "lancamentos" ? "lancamentos" : "catalogo");
      setNovo(!!p.novo);
      setEsgotado(!!p.esgotado);
      setDestaque(!!p.destaque);
      setImagem(p.imagem || "");
      setPreco(p.preco == null ? "" : String(p.preco));
      setDescricao(p.descricao || "");
      setFilamento(p.filamento || "");
      setPeso(p.peso == null ? "" : String(p.peso));
      const dm = (p.comprimento || p.largura || p.altura)
        ? { comprimento: p.comprimento, largura: p.largura, altura: p.altura }
        : parseDimensoes(p.dimensoes);
      setComprimento(dm.comprimento == null ? "" : String(dm.comprimento));
      setLargura(dm.largura == null ? "" : String(dm.largura));
      setAltura(dm.altura == null ? "" : String(dm.altura));
      setErros({});
      mostrarMsg("Editando: " + (p.nome || ""), false);
      setTimeout(() => {
        if (formRef.current) formRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 30);
    };

    const remover = async (id) => {
      if (!window.fbDb) return;
      if (!window.confirm("Remover esta peça do catálogo?")) return;
      try { await window.fbDb.collection("produtos").doc(id).delete(); }
      catch (err) { mostrarMsg("Erro ao remover: " + err.message, true); }
    };

    const alternarDestaque = async (p) => {
      if (!window.fbDb) return;
      try {
        await window.fbDb.collection("produtos").doc(p.id)
          .update({ destaque: !p.destaque });
        mostrarMsg(p.destaque ? "\"" + p.nome + "\" saiu do destaque." : "\"" + p.nome + "\" está em destaque no topo.", false);
      } catch (err) {
        mostrarMsg("Erro ao alterar destaque: " + err.message, true);
      }
    };

    const duplicar = async (p) => {
      if (!window.fbDb) return;
      setSaving(true);
      try {
        await window.fbDb.collection("produtos").add({
          nome: (p.nome || "") + " (cópia)",
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
        mostrarMsg("Cópia de \"" + (p.nome || "") + "\" adicionada.", false);
      } catch (err) {
        mostrarMsg("Erro ao duplicar: " + err.message, true);
      } finally {
        setSaving(false);
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

    const salvarHero = async (v) => {
      if (!window.fbDb) { mostrarMsg("Banco de dados indisponível.", true); return; }
      try {
        /* Config guardada em "_site" (mesma colecao dos produtos, sem "ordem",
           entao fica fora da listagem) para usar as mesmas regras do Firestore. */
        await window.fbDb.collection("produtos").doc("_site").set({ hero: v }, { merge: true });
        mostrarMsg(v === "destaques" ? "Hero usará os produtos em destaque." : "Hero mostrará os Lançamentos.", false);
      } catch (err) {
        console.warn("Falha ao salvar config do Hero:", err.code || err.message);
        mostrarMsg("Erro ao salvar: " + err.message, true);
      }
    };

    const salvarFrete = async () => {
      if (!window.fbDb) { mostrarMsgFrete("Banco de dados indisponível.", true); return; }
      const num = (v) => { const n = Number(String(v).replace(",", ".")); return isFinite(n) ? n : 0; };
      const freteObj = {
        cepOrigem: String(fCep).replace(/\D/g, "").slice(0, 8),
        freteGratis: String(fGratis).trim() === "" ? 0 : num(fGratis),
        pesoIncluidoKg: String(fPesoIncl).trim() === "" ? 0 : num(fPesoIncl),
        valorKgExcedente: String(fPesoExc).trim() === "" ? 0 : num(fPesoExc),
        endpoint: String(fEndpoint).trim(),
        tabelaFrete: fTab.map((v) => num(v))
      };
      setSalvandoFrete(true);
      try {
        await window.fbDb.collection("produtos").doc("_site").set({ frete: freteObj }, { merge: true });
        mostrarMsgFrete("Configurações de frete salvas.", false);
      } catch (err) {
        console.warn("Falha ao salvar config de frete:", err.code || err.message);
        mostrarMsgFrete("Erro ao salvar frete: " + err.message, true);
      } finally {
        setSalvandoFrete(false);
      }
    };

    /* Testa o endpoint do Worker com o CEP de origem informado, para validar
       a cotacao real antes de o cliente final usa-la. */
    const testarCotacao = async () => {
      const base = String(fEndpoint || "").trim().replace(/\/+$/, "");
      const cepOrigem = String(fCep || "").replace(/\D/g, "").slice(0, 8);
      if (!base) { mostrarMsgFrete("Informe o endpoint do Worker antes de testar.", true); return; }
      if (cepOrigem.length !== 8) { mostrarMsgFrete("Informe um CEP de origem com 8 dígitos.", true); return; }
      setTestandoFrete(true);
      mostrarMsgFrete("Testando cotação...", false);
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
          mostrarMsgFrete("Falha na cotação (" + resp.status + "): " + det, true);
          return;
        }
        const ops = (data && data.opcoes) || [];
        if (!ops.length) { mostrarMsgFrete("O Worker respondeu sem opções de frete.", true); return; }
        const resumo = ops.map((o) =>
          ([o.empresa, o.servico].filter(Boolean).join(" ") + " " + formatBRL(o.preco) + (o.prazo != null ? " (" + o.prazo + "d)" : ""))
        ).join(" · ");
        mostrarMsgFrete("Cotação OK — " + resumo, false);
      } catch (err) {
        mostrarMsgFrete("Não foi possível falar com o Worker: " + (err && err.message || err), true);
      } finally {
        setTestandoFrete(false);
      }
    };

    const importar = async () => {
      if (!window.fbDb) return;
      if (!window.confirm("Importar o catálogo atual para o banco de dados?")) return;
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
        mostrarMsg("Catálogo importado.", false);
      } catch (err) {
        mostrarMsg("Erro ao importar: " + err.message, true);
      } finally {
        setImportando(false);
      }
    };

    const listaBase = (produtos || []).slice().sort(cmpProd);
    const termo = busca.trim().toLowerCase();
    const filtrosAtivos = termo !== "" || secFiltro !== "todos" || soDestaque;
    const lista = listaBase.filter((p) => {
      if (secFiltro === "catalogo" && (p.secao || "catalogo") === "lancamentos") return false;
      if (secFiltro === "lancamentos" && (p.secao || "catalogo") !== "lancamentos") return false;
      if (soDestaque && !p.destaque) return false;
      if (termo !== "" && !(((p.nome || "") + " " + (p.categoria || "")).toLowerCase().indexOf(termo) >= 0)) return false;
      return true;
    });
    const nDestaques = listaBase.filter((p) => p.destaque).length;
    const semMedidas = listaBase.filter((p) => !temMedidasFrete(p)).length;

    return h("div", { className: "modal-overlay" },
      h("div", { className: "modal admin", onClick: (e) => e.stopPropagation() },
        h("button", { type: "button", className: "modal__close", onClick: onClose, "aria-label": "Fechar" }, "×"),
        h("div", { className: "admin__head" },
          h("h2", { className: "modal__title" }, "Painel do administrador"),
          h("button", { type: "button", className: "btn btn--ghost", onClick: onLogout }, "Sair")
        ),
        h("p", { className: "admin__user" }, "Conectado como ", h("strong", null, user && user.email)),
        h("div", { className: "admin__grid" },
          h("form", { className: "admin__form", onSubmit: salvar, ref: formRef },
            h("h3", null, editando ? "Editar peça" : "Adicionar peça"),
            h("label", { className: "field" },
              h("span", null, "O que mostrar no topo da página inicial (Hero)"),
              h("select", { value: hero === "destaques" ? "destaques" : "lancamentos",
                onChange: (e) => salvarHero(e.target.value) },
                h("option", { value: "lancamentos" }, "Lançamentos"),
                h("option", { value: "destaques" }, "Produtos em destaque")
              ),
              h("small", { className: "field__help" }, nDestaques > 0
                ? (hero === "destaques" ? "Mostrando os destacados. Use a ★ para trocar." : "Os " + nDestaques + " destacados aparecem no topo do catálogo.")
                : "Marque produtos com ★ para vê-los aqui.")
            ),
            h("label", { className: clsCampo("nome") },
              h("span", null, "Nome *"),
              h("input", { value: nome, placeholder: "Ex.: Vaso Geométrico",
                onChange: (e) => { setNome(e.target.value); limparErro("nome"); } }),
              erroCampo("nome")
            ),
            h("label", { className: clsCampo("categoria") },
              h("span", null, "Categoria *"),
              h(CatAutocomplete, { value: categoria,
                onChange: (v) => { setCategoria(v); limparErro("categoria"); }, categorias: categorias }),
              erroCampo("categoria")
            ),
            h("label", { className: "field" },
              h("span", null, "Seção"),
              h("select", { value: secao, onChange: (e) => setSecao(e.target.value) },
                h("option", { value: "catalogo" }, "Catálogo"),
                h("option", { value: "lancamentos" }, "Lançamentos")
              )
            ),
            h("div", { className: "admin__row" },
              h("label", { className: clsCampo("preco") },
                h("span", null, "Preço (R$)"),
                h("input", { value: preco, inputMode: "decimal", placeholder: "Ex.: 49.90",
                  onChange: (e) => { setPreco(e.target.value); limparErro("preco"); } }),
                erroCampo("preco")
              ),
              h("label", { className: "field" },
                h("span", null, "Filamento"),
                h("select", { value: filamento, onChange: (e) => setFilamento(e.target.value) },
                  h("option", { value: "" }, "—"),
                  h("option", { value: "PLA" }, "PLA"),
                  h("option", { value: "PETG" }, "PETG")
                )
              )
            ),
            h("label", { className: "field" },
              h("span", null, "Descrição"),
              h("textarea", { value: descricao, rows: 3, placeholder: "Detalhes da peça...",
                onChange: (e) => setDescricao(e.target.value) })
            ),
            h("div", { className: "admin__row" },
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
            h("div", { className: "admin__row" },
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
            h("small", { className: "field__help" }, "Peso e medidas (cm) são obrigatórios: usados no cálculo do frete."),
            h("div", { className: "admin__checks" },
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
                h("span", null, "Destacar no topo do catálogo")
              )
            ),
            h("label", { className: "field" },
              h("span", null, "Imagem (comprimida automaticamente)"),
              h("input", { type: "file", accept: "image/*", onChange: escolherArquivo })
            ),
            imagem && h("img", { className: "admin__preview", src: imagem, alt: "Prévia" }),
            msg && h("p", { className: "admin__msg" + (msgErro ? " admin__msg--erro" : "") }, msg),
            h("button", { type: "submit", className: "btn btn--primary btn--block", disabled: saving },
              saving ? "Salvando..." : (editando ? "Salvar alterações" : "Adicionar ao catálogo")),
            editando && h("button", { type: "button", className: "btn btn--ghost btn--block",
              onClick: () => { limparForm(); mostrarMsg("", false); } }, "Cancelar edição")
          ),
          h("div", { className: "admin__list" },
            h("details", { className: "admin__frete", open: true },
              h("summary", null, "Configurações de frete"),
              h("div", { className: "admin__row" },
                h("label", { className: "field" },
                  h("span", null, "CEP de origem"),
                  h("input", { value: fCep, inputMode: "numeric", placeholder: "00000000",
                    onChange: (e) => setFCep(e.target.value.replace(/\D/g, "").slice(0, 8)) })
                ),
                h("label", { className: "field" },
                  h("span", null, "Frete grátis acima de (R$)"),
                  h("input", { value: fGratis, inputMode: "decimal", placeholder: "0 = desligado",
                    onChange: (e) => setFGratis(e.target.value) })
                )
              ),
              h("div", { className: "admin__row" },
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
              h("p", { className: "field__help" },
                "Tabela por região (1º dígito do CEP). Usada como estimativa de frete."),
              h("label", { className: "field" },
                h("span", null, "Endpoint de cotação real (Worker)"),
                h("input", { value: fEndpoint, placeholder: "https://spacetek-frete.SUA-CONTA.workers.dev",
                  onChange: (e) => setFEndpoint(e.target.value) }),
                h("small", { className: "field__help" },
                  fEndpoint.trim()
                    ? "Cotação real ativa. Sem resposta, usa a estimativa da tabela."
                    : "Opcional. Preencha após publicar o Worker para ativar a cotação real.")
              ),
              h("div", { className: "admin__frete-tab" },
                fTab.map((v, i) => h("label", { key: i, className: "field field--mini" },
                  h("span", null, REGIOES_CEP[i]),
                  h("input", { value: v, inputMode: "decimal",
                    onChange: (e) => { const c = fTab.slice(); c[i] = e.target.value; setFTab(c); } })
                ))
              ),
              h("div", { className: "admin__frete-acoes" },
                h("button", { type: "button", className: "btn btn--primary", onClick: salvarFrete, disabled: salvandoFrete },
                  salvandoFrete ? "Salvando..." : "Salvar configurações de frete"),
                h("button", { type: "button", className: "btn btn--ghost", onClick: testarCotacao, disabled: testandoFrete },
                  testandoFrete ? "Testando..." : "Testar cotação")
              ),
              msgFrete && h("p", { className: "admin__frete-msg" + (msgFreteErro ? " admin__frete-msg--erro" : "") }, msgFrete)
            ),
            h("div", { className: "admin__list-head" },
              h("h3", null, "Itens (" + produtos.length + ")",
                semMedidas > 0 ? h("span", { className: "admin__hint-medidas", title: "Sem peso e medidas: nao sao cotados no frete real" },
                  " · " + semMedidas + " sem medidas") : null),
              h("button", { type: "button", className: "btn btn--ghost", onClick: importar,
                disabled: importando }, importando ? "Importando..." : "Importar catálogo atual")
            ),
            h("div", { className: "admin__tools" },
              h("input", { className: "admin__busca", type: "search", value: busca,
                placeholder: "Buscar por nome ou categoria...",
                onChange: (e) => setBusca(e.target.value) }),
              h("select", { className: "admin__sec", value: secFiltro,
                onChange: (e) => setSecFiltro(e.target.value) },
                h("option", { value: "todos" }, "Todos"),
                h("option", { value: "catalogo" }, "Catálogo"),
                h("option", { value: "lancamentos" }, "Lançamentos")
              ),
              h("label", { className: "check check--compact" },
                h("input", { type: "checkbox", checked: soDestaque,
                  onChange: (e) => setSoDestaque(e.target.checked) }),
                h("span", null, "★ só destaques (" + nDestaques + ")")
              )
            ),
            filtrosAtivos && h("p", { className: "admin__tools-hint" },
              h("button", { type: "button", className: "link", onClick: () => {
                setBusca(""); setSecFiltro("todos"); setSoDestaque(false);
              } }, "Limpar filtros")),
            produtos.length === 0
              ? h("p", { className: "drawer__empty" }, "Nenhuma peça no banco. Use \"Importar catálogo atual\" para começar.")
              : lista.length === 0
                ? h("p", { className: "drawer__empty" }, "Nenhuma peça corresponde à busca.")
                : h("ul", { className: "admin__items" },
                    lista.map((p, i) => h("li", { className: "admin__item", key: p.id },
                      h("img", { src: p.imagem, alt: p.nome }),
                      h("div", { className: "admin__item-info" },
                        h("div", { className: "admin__item-nome" },
                          h("strong", null, p.nome),
                          p.destaque && h("span", { className: "badge-destaque" }, "★ Destaque"),
                          !temMedidasFrete(p) && h("span", { className: "badge-medidas" }, "⚠ Sem medidas")
                        ),
                        h("span", null, (p.categoria || "-") + " • " +
                          (p.secao === "lancamentos" ? "Lançamentos" : "Catálogo") + " • " +
                          (precoDe(p) != null ? formatBRL(precoDe(p)) : "Sob consulta") +
                          (p.esgotado ? " • Esgotado" : "")),
                        h("div", { className: "admin__item-reorder" },
                          h("button", { type: "button", className: "btn-setinha", title: "Mover para cima",
                            disabled: filtrosAtivos || i === 0, onClick: () => mover(p.id, -1),
                            "aria-label": "Mover para cima" }, "▲"),
                          h("button", { type: "button", className: "btn-setinha", title: "Mover para baixo",
                            disabled: filtrosAtivos || i === lista.length - 1, onClick: () => mover(p.id, 1),
                            "aria-label": "Mover para baixo" }, "▼")
                        )
                      ),
                      h("div", { className: "admin__item-actions" },
                        h("button", { type: "button", className: "btn-star" + (p.destaque ? " btn-star--on" : ""),
                          title: p.destaque ? "Remover do destaque" : "Destacar no topo",
                          onClick: () => alternarDestaque(p), "aria-label": "Alternar destaque" }, "★"),
                        h("button", { type: "button", className: "btn-dup",
                          title: "Duplicar peça", onClick: () => duplicar(p), "aria-label": "Duplicar" }, "⧉"),
                        h("button", { type: "button", className: "btn-editar",
                          onClick: () => editar(p), "aria-label": "Editar" }, "Editar"),
                        h("button", { type: "button", className: "cart-item__remove",
                          onClick: () => remover(p.id), "aria-label": "Remover" }, "🗑")
                      )
                    ))
                  )
          )
        )
      )
    );
  }

  window.AdminLogin = AdminLogin;
  window.AdminPanel = AdminPanel;
})();
