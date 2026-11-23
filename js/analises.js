const Analises = {
  POR_PAGINA: 25,
  DURACAO_CONTAGEM: 700,
  CIRCUNFERENCIA: 2 * Math.PI * 52,
  MESES: Object.freeze(["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]),
  estado: null,
  modelo: null,
  maximizada: false,

  ICONES_JANELA: Object.freeze({
    maximizar: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M16 3h3a2 2 0 0 1 2 2v3"/><path d="M8 21H5a2 2 0 0 1-2-2v-3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>',
    restaurar: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/></svg>'
  }),
  desatualizado: false,
  quadroContagem: 0,
  quadroLuz: 0,
  ponteiro: null,

  CORES_ESTADO: Object.freeze({
    concluido: "#22C55E",
    em_andamento: "#F97316",
    nao_iniciado: "#64748B",
    inconsistente: "#EF4444",
    pendente: "#FBBF24",
    entregue: "#22C55E",
    em_producao: "#4F8EF7",
    validacao: "#EAB308"
  }),

  CORES_COLECAO: Object.freeze({
    BASIS: "#4F8EF7",
    LUDUS: "#C026D3",
    MUNDUS: "#0D9488"
  }),

  COLUNAS_DATA: Object.freeze({
    montagem: "K",
    bonecaSolicitada: "M",
    bonecaRecebida: "N",
    qrCodes: "O",
    ajustes: "R",
    grafica: "T",
    separatas: "V",
    gabaritos: "X"
  }),

  ROTULOS_REGISTRO: Object.freeze({
    bonecaSolicitada: ["Solicitadas", "Sem confirmação"],
    bonecaRecebida: ["Recebidas", "Sem recebimento confirmado"],
    qrCodes: ["Verificados", "Sem confirmação"],
    grafica: ["Enviados", "Sem envio confirmado"],
    separatas: ["Confirmadas", "Sem confirmação"],
    gabaritos: ["Enviados", "Sem confirmação"]
  }),

  TITULOS: Object.freeze({
    programadas: "Entregas Programadas",
    enviados: "Livros Enviados para impressão",
    taxa: "Taxa de entrega"
  }),

  init() {
    this.dialogo = Utils.qs("#analiseIndicador");
    this.conteudo = Utils.qs("#analiseConteudo");
    this.dica = document.createElement("div");
    this.dica.className = "analise-dica";
    this.dica.setAttribute("aria-hidden", "true");
    this.dica.hidden = true;
    this.dialogo.appendChild(this.dica);
    this.movimentoReduzido = window.matchMedia("(prefers-reduced-motion: reduce)");

    this.dialogo.addEventListener("click", (evento) => {
      if (evento.target === this.dialogo || evento.target.closest("[data-fechar-analise]")) {
        EntregasView.fecharDialogo(this.dialogo);
        return;
      }
      if (evento.target.closest("[data-maximizar-analise]")) {
        this.alternarMaximizacao();
        return;
      }
      const colecaoLocal = evento.target.closest("[data-colecao-local]");
      if (colecaoLocal) {
        if (!colecaoLocal.disabled) this.alternarColecaoLocal(colecaoLocal.dataset.colecaoLocal);
        return;
      }
      if (evento.target.closest("[data-limpar-colecao-local]")) {
        this.removerFiltroLocal("todos");
        return;
      }
      const anoLocal = evento.target.closest("[data-ano-local]");
      if (anoLocal) {
        this.alternarAnoLocal(anoLocal.dataset.anoLocal);
        return;
      }
      const situacaoLocal = evento.target.closest("[data-situacao-local]");
      if (situacaoLocal) {
        if (!situacaoLocal.disabled) this.alternarSituacaoLocal(situacaoLocal.dataset.situacaoLocal);
        return;
      }
      const remover = evento.target.closest("[data-remover-filtro]");
      if (remover) {
        this.removerFiltroLocal(remover.dataset.removerFiltro);
        return;
      }
      const material = evento.target.closest("[data-material]");
      if (material) {
        if (this.estado && this.estado.id === "montagem") EntregasView.abrirDetalheMontagem(material.dataset.material, material);
        else if (this.estado && this.estado.id === "boneca") EntregasView.abrirDetalheBoneca(material.dataset.material, material);
        else if (this.estado && this.estado.id === "enviados") EntregasView.abrirDetalheEtapa(material.dataset.material, "grafica", material);
        else if (this.estado && this.ETAPAS_PADRAO[this.estado.id]) EntregasView.abrirDetalheEtapa(material.dataset.material, this.estado.id, material);
        else EntregasView.abrirDetalhe(material.dataset.material, material);
        return;
      }
      const lista = evento.target.closest("[data-lista]");
      if (lista) {
        EntregasView.abrirIndicador(lista.dataset.lista, lista);
        return;
      }
      const ordenar = evento.target.closest("[data-ordenar]");
      if (ordenar) {
        const indice = Number(ordenar.dataset.ordenar);
        const o = this.estado.ordem;
        this.estado.ordem = { indice, direcao: o.indice === indice && o.direcao === "asc" ? "desc" : "asc" };
        this.renderizarTabela();
        const alvo = Utils.qs(`[data-ordenar="${indice}"]`, this.conteudo);
        if (alvo) alvo.focus();
        return;
      }
      const pagina = evento.target.closest("[data-pagina]");
      if (pagina && !pagina.disabled) {
        const direcao = pagina.dataset.direcao;
        this.estado.pagina = Number(pagina.dataset.pagina);
        this.renderizarTabela();
        const alvo = Utils.qs(`[data-direcao="${direcao}"]:not(:disabled)`, this.conteudo) || Utils.qs(".analise-tabela__paginas button:not(:disabled)", this.conteudo);
        if (alvo) alvo.focus();
      }
    });

    this.dialogo.addEventListener("input", (evento) => {
      if (!evento.target.matches("[data-busca]")) return;
      this.estado.busca = evento.target.value;
      this.estado.pagina = 1;
      this.renderizarTabela();
    });

    this.dialogo.addEventListener("change", (evento) => {
      if (evento.target.matches("[data-modulo-analise]")) {
        this.alternarModuloLocal(evento.target.value);
        return;
      }
      if (!evento.target.matches("[data-recorte-analise]")) return;
      this.estado.recorte = evento.target.value;
      this.estado.pagina = 1;
      this.renderizarTabela();
    });

    this.dialogo.addEventListener("pointermove", (evento) => {
      if (evento.pointerType === "touch") return;
      this.ponteiro = evento;
      if (!this.movimentoReduzido.matches && !this.quadroLuz) {
        this.quadroLuz = requestAnimationFrame(() => {
          this.quadroLuz = 0;
          this.iluminar(this.ponteiro);
        });
      }
      this.moverDica(evento);
    });

    this.dialogo.addEventListener("pointerover", (evento) => {
      const alvo = evento.target.closest("[data-dica]");
      if (!alvo || evento.pointerType === "touch") return;
      this.dica.textContent = alvo.dataset.dica;
      this.dica.hidden = false;
      this.moverDica(evento);
    });

    this.dialogo.addEventListener("pointerout", (evento) => {
      const alvo = evento.target.closest("[data-dica]");
      if (alvo && !alvo.contains(evento.relatedTarget)) this.dica.hidden = true;
    });

    this.dialogo.addEventListener("error", (evento) => {
      const img = evento.target;
      if (img && img.tagName === "IMG" && img.closest(".analise-colecao")) img.closest(".analise-colecao").classList.add("is-sem-imagem");
    }, true);

    const painelGeral = Utils.qs("#indicadores");
    if (painelGeral) {
      painelGeral.addEventListener("click", (evento) => {
        const card = evento.target.closest("[data-analise]");
        if (card) this.abrirConsolidado(card.dataset.analise, card);
      });
      painelGeral.addEventListener("keydown", (evento) => {
        const card = evento.target.closest("[data-analise]");
        if (card && (evento.key === "Enter" || evento.key === " ")) {
          evento.preventDefault();
          this.abrirConsolidado(card.dataset.analise, card);
        }
      });
    }

    this.dialogo.addEventListener("close", () => {
      this.consolidado = false;
      this.pararAnimacoes();
      EntregasView.devolverFoco(this.estado && this.estado.origem);
    });
  },

  e(valor) {
    return Utils.escaparHtml(valor);
  },

  n(valor) {
    return Utils.formatarNumero(valor);
  },

  pct(parte, total) {
    return CiclosEntrega.formatarTaxa(CiclosEntrega.taxaEntrega(parte, total));
  },

  q(rotulo, num, extra) {
    return { rotulo, tipo: "n", num, ...extra };
  },

  t(rotulo, parte, total, extra) {
    return { rotulo, tipo: "pct", parte, total, ...extra };
  },

  formatar(item) {
    return item.tipo === "pct" ? this.pct(item.parte, item.total) : this.n(item.num);
  },

  normalizar(texto) {
    return Materiais.semAcento(texto).toLowerCase();
  },

  chaveOrdenacao(valor) {
    if (typeof valor === "number") return valor;
    const texto = String(valor ?? "").trim();
    const data = texto.match(/^(\d{2})\/(\d{2})(?:\/(\d{4}))?(?:\s+(\d{2}):(\d{2}))?$/);
    if (data) return `${data[3] || "0000"}${data[2]}${data[1]}${data[4] || "00"}${data[5] || "00"}`;
    return this.normalizar(texto);
  },

  lerData(texto) {
    const datas = [];
    const padrao = /(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?/g;
    let m;
    while ((m = padrao.exec(String(texto ?? ""))) !== null) {
      const dia = Number(m[1]);
      const mes = Number(m[2]);
      if (dia >= 1 && dia <= 31 && mes >= 1 && mes <= 12) datas.push({ dia, mes, ano: m[3] ? Number(m[3]) : null });
    }
    return datas;
  },

  dataMaterial(b, campo) {
    const datas = EntregasView.valoresUnicos(EntregasView.registrosPorMaterial.get(b.id) || [], campo).flatMap((v) => this.lerData(v));
    if (!datas.length) return null;
    return datas.reduce((a, d) => (d.mes * 100 + d.dia > a.mes * 100 + a.dia ? d : a));
  },

  serieTemporal(datas, titulo, coluna) {
    const validas = datas.filter(Boolean);
    if (validas.length < 3) return null;
    const anos = new Set(validas.filter((d) => d.ano).map((d) => d.ano));
    if (anos.size > 1) return null;
    const meses = validas.map((d) => d.mes);
    const inicio = Math.min(...meses);
    const fim = Math.max(...meses);
    if (fim === inicio || fim - inicio > 6) return null;
    const ano = anos.size ? [...anos][0] : null;
    let acumulado = 0;
    const itens = [];
    for (let mes = inicio; mes <= fim; mes += 1) {
      const valor = validas.filter((d) => d.mes === mes).length;
      acumulado += valor;
      itens.push({ rotulo: `${this.MESES[mes - 1]}${ano ? `/${ano}` : ""}`, valor, acumulado });
    }
    return {
      titulo,
      coluna,
      itens,
      total: validas.length,
      semData: datas.length - validas.length,
      semAno: validas.some((d) => !d.ano)
    };
  },

  ROTULO_CONSOLIDADO: "Todas as entregas",

  ORDEM_MODULOS: Object.freeze(["M1", "M2", "M3", "M4", "M1/M2", "M3/M4", "ANUAL"]),

  alternarModuloLocal(valor) {
    if (!this.aberta()) return;
    this.atualizarFiltrosLocais((e) => { e.moduloLocal = valor || null; }, "[data-modulo-analise]");
  },

  abrirConsolidado(id, origem) {
    this.consolidado = true;
    this.abrir(id, origem, true);
  },

  abrir(id, origem, consolidado = false) {
    if (!EntregasView.proc) return;
    this.consolidado = consolidado;
    this.estado = { id, origem, busca: "", recorte: "", ordem: { indice: -1, direcao: "asc" }, pagina: 1, colecaoLocal: null, anoLocal: null, situacaoLocal: null };
    this.desatualizado = false;
    this.maximizada = false;
    this.dialogo.classList.remove("is-maximizada");
    this.modelo = this.construir(id);
    this.renderizar(true);
    EntregasView.abrirDialogo(this.dialogo);
    this.conteudo.scrollTop = 0;
    this.dialogo.scrollTop = 0;
    const fechar = Utils.qs("[data-fechar-analise]", this.dialogo);
    if (fechar) fechar.focus();
    this.animarNumeros();
  },

  rotuloMaximizacao() {
    return this.maximizada ? "Restaurar tamanho da análise" : "Maximizar análise";
  },

  botaoMaximizacao() {
    const rotulo = this.rotuloMaximizacao();
    return `<button type="button" class="analise__fechar analise__maximizar" data-maximizar-analise aria-pressed="${this.maximizada}" aria-label="${rotulo}" title="${rotulo}">${this.maximizada ? this.ICONES_JANELA.restaurar : this.ICONES_JANELA.maximizar}</button>`;
  },

  alternarMaximizacao() {
    if (!this.aberta()) return;
    const cabecalho = Utils.qs(".analise__cabecalho", this.dialogo);
    const limite = cabecalho ? cabecalho.getBoundingClientRect().bottom : this.dialogo.getBoundingClientRect().top;
    const ancora = this.dialogo.scrollTop > 0
      ? Utils.qsa(".bento > *, .bento__stats > *, #analiseTabela tbody tr, .analise-tabela__paginas", this.dialogo).find((el) => el.getBoundingClientRect().bottom > limite + 1)
      : null;
    const distancia = ancora ? ancora.getBoundingClientRect().top - limite : 0;
    this.maximizada = !this.maximizada;
    this.dialogo.classList.toggle("is-maximizada", this.maximizada);
    const botao = Utils.qs("[data-maximizar-analise]", this.dialogo);
    if (botao) {
      const rotulo = this.rotuloMaximizacao();
      botao.setAttribute("aria-pressed", String(this.maximizada));
      botao.setAttribute("aria-label", rotulo);
      botao.title = rotulo;
      botao.innerHTML = this.maximizada ? this.ICONES_JANELA.restaurar : this.ICONES_JANELA.maximizar;
    }
    if (ancora) {
      const novoLimite = cabecalho ? cabecalho.getBoundingClientRect().bottom : this.dialogo.getBoundingClientRect().top;
      this.dialogo.scrollTop += ancora.getBoundingClientRect().top - novoLimite - distancia;
    }
  },

  atualizarFiltrosLocais(mutar, seletorFoco) {
    if (!this.aberta()) return;
    mutar(this.estado);
    this.estado.pagina = 1;
    this.modelo = this.construir(this.estado.id);
    if (this.estado.recorte && !this.modelo.recortes.some((x) => x.id === this.estado.recorte)) this.estado.recorte = "";
    const rolagem = this.dialogo.scrollTop;
    this.pararAnimacoes();
    this.renderizar(false);
    this.dialogo.scrollTop = rolagem;
    const alvo = (seletorFoco && Utils.qs(seletorFoco, this.conteudo)) || Utils.qs("[data-colecao-local]", this.conteudo);
    if (alvo) alvo.focus({ preventScroll: true });
  },

  alternarColecaoLocal(chave) {
    if (!this.aberta()) return;
    const anterior = this.estado.colecaoLocal;
    this.atualizarFiltrosLocais((e) => {
      e.colecaoLocal = !chave || anterior === chave ? null : chave;
      if (!e.colecaoLocal) e.anoLocal = null;
      if (e.colecaoLocal && e.anoLocal && !e.anoLocal.startsWith(`${e.colecaoLocal}|`)) e.anoLocal = null;
    }, `[data-colecao-local="${chave || anterior}"]`);
  },

  alternarAnoLocal(chave) {
    if (!this.aberta()) return;
    this.atualizarFiltrosLocais((e) => {
      e.anoLocal = e.anoLocal === chave ? null : chave;
      if (e.anoLocal) e.colecaoLocal = e.anoLocal.split("|")[0];
    }, `[data-ano-local="${chave}"]`);
  },

  alternarSituacaoLocal(valor) {
    if (!this.aberta()) return;
    const situacao = valor || STATUS.EM_ANDAMENTO;
    this.atualizarFiltrosLocais((e) => { e.situacaoLocal = e.situacaoLocal === situacao ? null : situacao; }, `[data-situacao-local="${situacao}"]`);
  },

  removerFiltroLocal(tipo) {
    if (!this.aberta()) return;
    this.atualizarFiltrosLocais((e) => {
      if (tipo === "colecao" || tipo === "todos") {
        e.colecaoLocal = null;
        e.anoLocal = null;
      }
      if (tipo === "ano" || tipo === "todos") e.anoLocal = null;
      if (tipo === "situacao" || tipo === "todos") e.situacaoLocal = null;
      if (tipo === "modulo" || tipo === "todos") e.moduloLocal = null;
    }, "[data-remover-filtro]");
  },

  aberta() {
    return Boolean(this.dialogo && this.dialogo.open && this.estado);
  },

  atualizar() {
    if (!this.aberta() || !EntregasView.proc) return;
    this.desatualizado = false;
    this.modelo = this.construir(this.estado.id);
    const paginas = Math.max(1, Math.ceil(this.linhasVisiveis().length / this.POR_PAGINA));
    if (this.estado.pagina > paginas) this.estado.pagina = paginas;
    this.renderizarPreservandoFoco();
  },

  marcarDesatualizado() {
    if (!this.aberta()) return;
    this.desatualizado = true;
    this.renderizarPreservandoFoco();
  },

  renderizarPreservandoFoco() {
    const ativo = document.activeElement;
    const dentro = Boolean(ativo && this.conteudo.contains(ativo));
    const busca = dentro && ativo.matches("[data-busca]");
    const rolagem = this.dialogo.scrollTop;
    this.pararAnimacoes();
    this.renderizar(false);
    this.dialogo.scrollTop = rolagem;
    if (!dentro) return;
    const alvo = busca ? Utils.qs("[data-busca]", this.conteudo) : Utils.qs("[data-fechar-analise]", this.conteudo);
    if (alvo) alvo.focus();
  },

  pararAnimacoes() {
    if (this.quadroContagem) cancelAnimationFrame(this.quadroContagem);
    if (this.quadroLuz) cancelAnimationFrame(this.quadroLuz);
    this.quadroContagem = 0;
    this.quadroLuz = 0;
    Utils.qsa("[data-contar]", this.conteudo).forEach((el) => {
      el.textContent = el.dataset.final;
    });
    if (this.dica) this.dica.hidden = true;
  },

  animarNumeros() {
    if (this.movimentoReduzido.matches) return;
    const alvos = Utils.qsa("[data-contar]", this.conteudo)
      .map((el) => ({ el, fim: Number(el.dataset.fim), tipo: el.dataset.contar }))
      .filter((a) => a.el.dataset.fim !== "" && Number.isFinite(a.fim) && a.fim > 0);
    if (!alvos.length) return;
    const inicio = performance.now();
    const passo = (agora) => {
      const p = Math.min(1, (agora - inicio) / this.DURACAO_CONTAGEM);
      const f = 1 - Math.pow(1 - p, 3);
      alvos.forEach((a) => {
        a.el.textContent = p >= 1 ? a.el.dataset.final : a.tipo === "pct" ? CiclosEntrega.formatarTaxa(a.fim * f) : this.n(Math.round(a.fim * f));
      });
      this.quadroContagem = p < 1 && this.aberta() ? requestAnimationFrame(passo) : 0;
      if (!this.quadroContagem) alvos.forEach((a) => { a.el.textContent = a.el.dataset.final; });
    };
    alvos.forEach((a) => {
      a.el.textContent = a.tipo === "pct" ? CiclosEntrega.formatarTaxa(0) : this.n(0);
    });
    this.quadroContagem = requestAnimationFrame(passo);
  },

  iluminar(evento) {
    if (!evento || !this.aberta()) return;
    const card = evento.target.closest && evento.target.closest(".glow");
    if (!card) return;
    const r = card.getBoundingClientRect();
    card.style.setProperty("--x", `${(evento.clientX - r.left).toFixed(0)}px`);
    card.style.setProperty("--y", `${(evento.clientY - r.top).toFixed(0)}px`);
  },

  moverDica(evento) {
    if (this.dica.hidden) return;
    const largura = this.dica.offsetWidth;
    const altura = this.dica.offsetHeight;
    const x = Math.min(window.innerWidth - largura - 8, Math.max(8, evento.clientX + 14));
    const y = evento.clientY - altura - 12 < 8 ? evento.clientY + 18 : evento.clientY - altura - 12;
    this.dica.style.transform = `translate(${x.toFixed(0)}px, ${y.toFixed(0)}px)`;
  },

  contexto() {
    if (this.consolidado) {
      const procVisao = EntregasView.procVisao(EntregasView.proc);
      const materiais = Dashboard.materiaisConsolidados(procVisao);
      const presentes = new Set(materiais.map((b) => Materiais.semAcento(b.colecao)));
      const naoAgrupados = [...new Map(CiclosEntrega.ENTREGAS.flatMap((e) => CiclosEntrega.selecionar(procVisao, e).naoAgrupados).map((r) => [r.linhaBase, r])).values()];
      return {
        materiais,
        confirmados: materiais.filter((b) => !b.provisorio),
        provisorios: materiais.filter((b) => b.provisorio),
        naoAgrupados,
        colecoes: CiclosEntrega.COLECOES_PROJETO.filter((c) => presentes.has(c.chave))
      };
    }
    const materiais = EntregasView.conjuntoAtual || [];
    const sel = CiclosEntrega.selecionar(EntregasView.proc, EntregasView.entrega);
    return {
      materiais,
      confirmados: materiais.filter((b) => !b.provisorio),
      provisorios: materiais.filter((b) => b.provisorio),
      naoAgrupados: EntregasView.aplicarFiltrosBrutos(sel.naoAgrupados),
      colecoes: CiclosEntrega.COLECOES_PROJETO.filter((c) => EntregasView.colecoesVisiveis().includes(c.chave))
    };
  },

  contar(lista, chave) {
    const mapa = new Map();
    lista.forEach((item) => {
      const k = chave(item);
      mapa.set(k, (mapa.get(k) || 0) + 1);
    });
    return mapa;
  },

  agrupar(lista, chave, concluido, ordenar) {
    const grupos = new Map();
    lista.forEach((item) => {
      const k = chave(item);
      if (!grupos.has(k)) grupos.set(k, { rotulo: k, total: 0, valor: 0 });
      const g = grupos.get(k);
      g.total += 1;
      if (concluido(item)) g.valor += 1;
    });
    const itens = [...grupos.values()];
    return ordenar ? itens.sort(ordenar) : itens.sort((a, b) => b.total - a.total || String(a.rotulo).localeCompare(String(b.rotulo), "pt-BR"));
  },

  ordemAno(a, b) {
    return Number(Materiais.canonAno(a.rotulo)) - Number(Materiais.canonAno(b.rotulo));
  },

  ORDEM_COLECOES: Object.freeze(["LUDUS", "BASIS", "MUNDUS"]),

  blocoAnoPorColecao(frentes, concluida, selecionado, materialDe = (f) => f.material) {
    const itens = this.agrupar(frentes, (f) => `${materialDe(f).ano} — ${materialDe(f).colecao}`, concluida, (a, b) => this.ordemColecaoAno(a, b));
    const grupos = [];
    itens.forEach((i) => {
      const [ano, colecao = ""] = String(i.rotulo).split(" — ");
      let grupo = grupos[grupos.length - 1];
      if (!grupo || grupo.colecao !== colecao) {
        grupo = { colecao, itens: [] };
        grupos.push(grupo);
      }
      grupo.itens.push({ ...i, rotulo: ano, dica: `${ano} ano — ${colecao}`, chave: `${Materiais.semAcento(colecao)}|${ano}` });
    });
    return { titulo: "Por ano escolar", tipo: "progresso", livre: true, itens, grupos, interativo: true, selecionado: selecionado || null };
  },

  ordemColecaoAno(a, b) {
    const [anoA, colA = ""] = String(a.rotulo).split(" — ");
    const [anoB, colB = ""] = String(b.rotulo).split(" — ");
    const posicao = (c) => {
      const p = this.ORDEM_COLECOES.indexOf(Materiais.semAcento(c).toUpperCase());
      return p < 0 ? this.ORDEM_COLECOES.length : p;
    };
    return posicao(colA) - posicao(colB) || Number(Materiais.canonAno(anoB)) - Number(Materiais.canonAno(anoA)) || colA.localeCompare(colB, "pt-BR");
  },

  porColecao(lista, colecoes, colecaoDe, concluido) {
    return colecoes.map((c) => {
      const doGrupo = lista.filter((x) => Materiais.semAcento(colecaoDe(x)) === c.chave);
      return { rotulo: c.nome, colecao: c, cor: this.CORES_COLECAO[c.chave] || c.cor, total: doGrupo.length, valor: doGrupo.filter(concluido).length };
    });
  },

  celulaColecao(nome) {
    const c = CiclosEntrega.COLECOES_PROJETO.find((x) => x.chave === Materiais.semAcento(nome));
    if (!c) return this.e(nome);
    return `<span class="analise-colecao"><span class="projetos__marca analise-colecao__marca" style="--recorte-escala: ${c.recorte.escala}; --recorte-x: ${c.recorte.x}; --recorte-y: ${c.recorte.y}"><img src="${c.imagem}" alt="${this.e(`Logo da coleção ${c.nome}`)}" width="${c.largura}" height="${c.altura}" decoding="async"></span><span class="analise-colecao__texto">${this.e(c.nome)}</span></span>`;
  },

  celulaMaterialProgresso(b, progresso, mostrarAndamento) {
    const { total, concluidas, emAndamento = 0 } = progresso || { total: 0, concluidas: 0 };
    const taxa = total ? (concluidas / total) * 100 : 0;
    const texto = `${this.n(concluidas)} de ${this.n(total)} · ${CiclosEntrega.formatarTaxa(taxa)}`;
    return `<div class="analise-material">${this.celulaMaterial(b)}<div class="analise-progresso" title="${this.e(`Frentes concluídas: ${texto}`)}"><span class="analise-progresso__trilho" aria-hidden="true"><span style="width:${Math.min(100, taxa).toFixed(2)}%"></span></span><span class="analise-progresso__texto">${texto}</span>${mostrarAndamento ? `<span class="analise-progresso__andamento">${this.n(emAndamento)} em andamento</span>` : ""}</div></div>`;
  },

  celulaMaterialEtapa(b, status, rotulos) {
    const concluido = status === STATUS.CONCLUIDO;
    const texto = concluido ? `Concluído · ${CiclosEntrega.formatarTaxa(100)}` : status === STATUS.NAO_INICIADO ? `Não iniciado · ${CiclosEntrega.formatarTaxa(0)}` : "";
    return `<div class="analise-material">${this.celulaMaterial(b)}<div class="analise-progresso" title="${this.e(`Montagem: ${rotulos[status]}`)}"><span class="analise-progresso__trilho" aria-hidden="true"><span style="width:${concluido ? 100 : 0}%"></span></span>${texto ? `<span class="analise-progresso__texto">${texto}</span>` : this.chipEstado(status, rotulos[status])}</div></div>`;
  },

  celulaMaterial(b) {
    return `<button type="button" class="link-material" data-material="${this.e(b.id)}">${this.e(b.nome)}</button>${b.provisorio ? '<span class="tag tag--alerta">Provisório</span>' : ""}`;
  },

  celulaValor(b, campo) {
    return EntregasView.valorEtapa(b, campo);
  },

  primeiroValor(b, campo) {
    const valores = EntregasView.valoresUnicos(EntregasView.registrosPorMaterial.get(b.id) || [], campo);
    return valores.length === 1 ? valores[0] : valores.join(" ");
  },

  chipEstado(estado, rotulo) {
    return `<span class="chip chip--${estado}">${this.e(rotulo)}</span>`;
  },

  linhaMaterial(b, extras, estado, rotuloEstado) {
    const colunasBase = [
      { html: this.e(b.colecao), chave: b.colecao },
      { html: this.e(b.ano), chave: Number(Materiais.canonAno(b.ano)) },
      { html: this.celulaMaterial(b), chave: b.nome },
      { html: this.e(b.modulo), chave: b.modulo }
    ];
    const celulas = [...colunasBase, ...extras];
    return {
      estado,
      celulas,
      busca: this.normalizar([b.colecao, b.ano, b.nome, b.modulo, b.tipoMaterial, b.id, rotuloEstado, ...extras.map((x) => x.texto || "")].join(" "))
    };
  },

  construir(id) {
    const ctx = this.contexto();
    if (id === "programadas") return this.modeloProgramadas(ctx);
    if (id === "enviados" || id === "taxa") return this.modeloEnvio(ctx, id);
    if (id === "checklist") return this.modeloChecklist(ctx);
    if (id === "montagem") return this.modeloMontagem(ctx);
    if (id === "boneca") return this.modeloBoneca(ctx);
    if (this.ETAPAS_PADRAO[id]) return this.modeloEtapaPadrao(ctx, id);
    return this.modeloEtapa(ctx, id);
  },

  modeloProgramadas(ctx) {
    const todas = ctx.confirmados;
    const chaveAno = (b) => `${Materiais.semAcento(b.colecao)}|${b.ano}`;
    const estado = this.estado || {};
    const disponiveis = ctx.colecoes.filter((c) => todas.some((b) => Materiais.semAcento(b.colecao) === c.chave)).map((c) => c.chave);
    if (estado.colecaoLocal && !disponiveis.includes(estado.colecaoLocal)) estado.colecaoLocal = null;
    const local = estado.colecaoLocal || null;
    const daColecao = (b) => !local || Materiais.semAcento(b.colecao) === local;
    if (estado.anoLocal && !todas.some((b) => daColecao(b) && chaveAno(b) === estado.anoLocal)) estado.anoLocal = null;
    const anoLocal = estado.anoLocal || null;
    estado.situacaoLocal = null;
    const doRecorte = (b) => daColecao(b) && (!anoLocal || chaveAno(b) === anoLocal);
    const base = todas.filter(doRecorte);
    const situacoes = Object.values(SITUACAO_BOOK).map((s) => ({ id: s, rotulo: SITUACAO_ROTULO[s], valor: base.filter((b) => b.situacao === s).length }));
    const entregues = base.filter((b) => b.situacao === SITUACAO_BOOK.ENTREGUE).length;
    const colecaoAtiva = local || (anoLocal ? anoLocal.split("|")[0] : null);
    const colecoes = colecaoAtiva ? ctx.colecoes.filter((c) => c.chave === colecaoAtiva) : ctx.colecoes;
    const colecaoLocal = local ? CiclosEntrega.COLECOES_PROJETO.find((c) => c.chave === local) : null;
    const [anoColecao, anoNome] = anoLocal ? anoLocal.split("|") : [];
    const ordemModulo = (m) => { const p = this.ORDEM_MODULOS.indexOf(m); return p < 0 ? this.ORDEM_MODULOS.length : p; };
    const modulos = [...this.contar(base, (b) => b.modulo).entries()].filter(([m]) => m).map(([id, n]) => ({ id, n })).sort((x, y) => ordemModulo(x.id) - ordemModulo(y.id) || x.id.localeCompare(y.id, "pt-BR"));
    if (estado.moduloLocal && !modulos.some((m) => m.id === estado.moduloLocal)) estado.moduloLocal = null;
    const moduloLocal = estado.moduloLocal || null;
    const materiaisTabela = moduloLocal ? base.filter((b) => b.modulo === moduloLocal) : base;
    const filtrosLocais = [
      ...(colecaoLocal ? [{ tipo: "colecao", rotulo: colecaoLocal.nome }] : []),
      ...(anoLocal ? [{ tipo: "ano", rotulo: colecaoLocal ? `${anoNome} ano` : `${anoNome} ano · ${anoColecao}` }] : []),
      ...(moduloLocal ? [{ tipo: "modulo", rotulo: `Módulo: ${moduloLocal}` }] : [])
    ];
    const anos = this.blocoAnoPorColecao(base, () => true, anoLocal, (b) => b);
    const comTotal = (i) => ({ ...i, valor: i.total, total: base.length });
    const blocoAnos = { ...anos, itens: anos.itens.map(comTotal), grupos: anos.grupos.map((g) => ({ ...g, itens: g.itens.map(comTotal) })) };
    const pareto = this.porColecao(base, colecoes, (b) => b.colecao, () => true)
      .map((x, i) => ({ ...x, valor: x.total, ordem: i }))
      .filter((x) => x.total > 0)
      .sort((x, y) => y.total - x.total || x.ordem - y.ordem);
    let acumulado = 0;
    pareto.forEach((x) => {
      acumulado += x.total;
      x.percentual = base.length ? (x.total / base.length) * 100 : 0;
      x.acumulado = base.length ? (acumulado / base.length) * 100 : 0;
    });
    return {
      titulo: this.TITULOS.programadas,
      unidade: "materiais",
      valorCard: todas.length,
      filtrosLocais,
      resumoFiltros: `Recorte: ${this.n(base.length)} de ${this.n(todas.length)} materiais da análise${moduloLocal ? ` · ${this.n(materiaisTabela.length)} no módulo ${moduloLocal}` : ""}`,
      filtroModulo: { opcoes: modulos, valor: moduloLocal, total: base.length },
      hero: {
        valor: this.q("materiais programados", base.length),
        anel: { parte: entregues, total: base.length, rotulo: "entregues" },
        apoio: `${this.n(entregues)} de ${this.n(base.length)} materiais com situação geral entregue.`
      },
      resumo: [
        ...ctx.colecoes.filter((c) => disponiveis.includes(c.chave)).map((c) => this.q(c.nome, todas.filter((b) => Materiais.semAcento(b.colecao) === c.chave).length, { cor: this.CORES_COLECAO[c.chave], colecaoFiltro: c.chave, ativo: colecaoAtiva === c.chave, totalRef: todas.length }))
      ],
      pilha: { titulo: "Situação geral dos materiais", itens: situacoes, total: base.length },
      ocultarSituacao: true,
      projetos: { titulo: "Materiais programados por projeto", subtitulo: "Distribuição dos materiais programados e percentual acumulado por coleção", tipo: "pareto", interativo: true, selecionada: local, itens: pareto, soma: base.length },
      tempo: null,
      blocos: [
        blocoAnos,
        { titulo: "Por tipo de material", tipo: "contagem", itens: this.agrupar(base, (b) => b.tipoMaterial, () => true).map((x) => ({ ...x, valor: x.total })) }
      ],
      tabelaClasse: "analise-tabela--materiais",
      colunas: ["Coleção", "Ano", "Material"],
      linhas: materiaisTabela.map((b) => ({
        estado: b.situacao,
        celulas: [
          { html: this.celulaColecao(b.colecao), chave: b.colecao },
          { html: this.e(`${b.ano} ano`), chave: Number(Materiais.canonAno(b.ano)) },
          { html: `<span class="analise-material__texto">${this.e(b.nome)}</span>${b.provisorio ? '<span class="tag tag--alerta">Provisório</span>' : ""}`, chave: b.nome }
        ],
        busca: this.normalizar([b.colecao, b.ano, `${b.ano} ano`, b.nome].join(" "))
      })),
      recortes: [],
      provisorios: ctx.provisorios.filter(doRecorte),
      avisos: ctx.naoAgrupados.length ? [`${this.n(ctx.naoAgrupados.length)} registros deste recorte ainda não pertencem a um material e não entram na contagem.`] : []
    };
  },

  modeloEnvio(ctx, id) {
    const todas = ctx.confirmados;
    const chaveAno = (b) => `${Materiais.semAcento(b.colecao)}|${b.ano}`;
    const estadoLocal = this.estado || {};
    const disponiveis = ctx.colecoes.filter((c) => todas.some((b) => Materiais.semAcento(b.colecao) === c.chave)).map((c) => c.chave);
    if (estadoLocal.colecaoLocal && !disponiveis.includes(estadoLocal.colecaoLocal)) estadoLocal.colecaoLocal = null;
    const local = estadoLocal.colecaoLocal || null;
    const daColecao = (b) => !local || Materiais.semAcento(b.colecao) === local;
    if (estadoLocal.anoLocal && !todas.some((b) => daColecao(b) && chaveAno(b) === estadoLocal.anoLocal)) estadoLocal.anoLocal = null;
    const anoLocal = estadoLocal.anoLocal || null;
    estadoLocal.situacaoLocal = null;
    const doRecorte = (b) => daColecao(b) && (!anoLocal || chaveAno(b) === anoLocal);
    const base = todas.filter(doRecorte);
    const enviado = (b) => b.etapas.grafica.status === STATUS.CONCLUIDO;
    const env = base.filter(enviado).length;
    const colecaoAtiva = local || (anoLocal ? anoLocal.split("|")[0] : null);
    const colecaoLocal = local ? CiclosEntrega.COLECOES_PROJETO.find((c) => c.chave === local) : null;
    const [anoColecao, anoNome] = anoLocal ? anoLocal.split("|") : [];
    const filtrosLocais = [
      ...(colecaoLocal ? [{ tipo: "colecao", rotulo: colecaoLocal.nome }] : []),
      ...(anoLocal ? [{ tipo: "ano", rotulo: colecaoLocal ? `${anoNome} ano` : `${anoNome} ano · ${anoColecao}` }] : [])
    ];
    const porColecao = this.porColecao(base, colecaoAtiva ? ctx.colecoes.filter((c) => c.chave === colecaoAtiva) : ctx.colecoes, (b) => b.colecao, enviado);
    const estados = [
      { id: "concluido", rotulo: "Enviados", valor: env },
      { id: "nao_iniciado", rotulo: "Sem envio confirmado", valor: base.filter((b) => b.etapas.grafica.status === STATUS.NAO_INICIADO).length },
      { id: "inconsistente", rotulo: "Inconsistentes", valor: base.filter((b) => b.etapas.grafica.status === STATUS.INCONSISTENTE).length }
    ].filter((x) => x.valor || x.id !== "inconsistente");
    const rotulo = (b) => (enviado(b) ? "Enviado" : b.etapas.grafica.status === STATUS.INCONSISTENTE ? "Inconsistente" : "Sem envio confirmado");
    const taxa = id === "taxa";
    return {
      titulo: this.TITULOS[id],
      unidade: "materiais",
      valorCard: taxa ? this.pct(env, base.length) : env,
      filtrosLocais,
      resumoFiltros: `Recorte: ${this.n(base.length)} de ${this.n(todas.length)} materiais da análise`,
      hero: {
        valor: taxa ? this.t("taxa de envio à gráfica", env, base.length) : this.q("livros enviados para impressão", env),
        anel: { parte: env, total: base.length, rotulo: taxa ? "enviados" : "taxa de envio" },
        apoio: `${this.n(env)} enviados de ${this.n(base.length)} programados · ${this.n(base.length - env)} sem envio confirmado.`
      },
      resumo: [
        this.q("Total programado", base.length),
        this.q("Enviados para impressão", env, { destaque: !taxa, estado: "concluido" }),
        this.q("Sem envio confirmado", base.length - env, { estado: "nao_iniciado" }),
        this.t("Taxa de envio", env, base.length, { destaque: taxa })
      ],
      pilha: { titulo: "Envio à gráfica", itens: estados, total: base.length },
      projetos: { titulo: taxa ? "Taxa de envio por projeto" : "Enviados por projeto", tipo: "progresso", interativo: true, unidadeAria: "materiais enviados para impressão", selecionada: local, itens: porColecao },
      tempo: null,
      blocos: [
        { ...this.blocoAnoPorColecao(base, enviado, anoLocal, (b) => b), titulo: taxa ? "Taxa por ano escolar" : "Enviados por ano escolar" }
      ],
      nota: taxa ? "Taxa geral = total enviado ÷ total programado × 100 (não é a média das taxas). Representa o envio à gráfica, não a conclusão integral: separatas e gabaritos continuam obrigatórios." : "",
      lista: { tipo: "grafica", rotulo: "Abrir lista de livros enviados" },
      tabelaClasse: "analise-tabela--materiais",
      colunas: ["Coleção", "Ano", "Material", "Envio"],
      linhas: base.map((b) => ({
        estado: b.etapas.grafica.status,
        celulas: [
          { html: this.celulaColecao(b.colecao), chave: b.colecao },
          { html: this.e(`${b.ano} ano`), chave: Number(Materiais.canonAno(b.ano)) },
          { html: this.celulaMaterial(b), chave: b.nome },
          { html: this.chipEstado(b.etapas.grafica.status, rotulo(b)), chave: rotulo(b) }
        ],
        busca: this.normalizar([b.colecao, b.ano, `${b.ano} ano`, b.nome, rotulo(b)].join(" "))
      })),
      recortes: estados.filter((s) => s.valor).map((s) => ({ id: s.id, rotulo: `${s.rotulo} (${this.n(s.valor)})` })),
      provisorios: ctx.provisorios.filter(doRecorte),
      avisos: []
    };
  },

  modeloEtapa(ctx, id) {
    const etapa = ETAPAS_BOOK.find((e) => e.id === id);
    const base = ctx.confirmados;
    const estadoDe = (b) => b.etapas[id].status;
    const intervalo = etapa.tipo === "intervalo";
    const [rotConcluido, rotPendente] = this.ROTULOS_REGISTRO[id] || ["Concluídos", "Não iniciados"];
    const rotulos = intervalo
      ? { nao_iniciado: "Não iniciado", em_andamento: "Em andamento", concluido: "Concluído", inconsistente: "Inconsistente" }
      : { concluido: rotConcluido, nao_iniciado: rotPendente, inconsistente: "Inconsistente" };
    const contagem = this.contar(base, estadoDe);
    const ordemEstados = intervalo ? ["nao_iniciado", "em_andamento", "concluido", "inconsistente"] : ["concluido", "nao_iniciado", "inconsistente"];
    const estados = ordemEstados.map((s) => ({ id: s, rotulo: rotulos[s], valor: contagem.get(s) || 0 }))
      .filter((s) => s.valor || s.id !== "inconsistente");
    const concluidos = contagem.get(STATUS.CONCLUIDO) || 0;
    const concluido = (b) => estadoDe(b) === STATUS.CONCLUIDO;
    const resumo = [
      this.q("Total de materiais", base.length),
      ...estados.map((s) => this.q(s.rotulo, s.valor, { estado: s.id, alerta: s.id === "inconsistente" && s.valor > 0 })),
      this.t("Percentual de conclusão", concluidos, base.length, { destaque: true })
    ];
    const avisos = [];
    let marcador = () => false;
    if (id === "bonecaSolicitada") {
      const recebidas = base.filter((b) => concluido(b) && b.etapas.bonecaRecebida.status === STATUS.CONCLUIDO).length;
      resumo.splice(resumo.length - 1, 0, this.q("Já recebidas (entre as solicitadas)", recebidas));
    }
    if (id === "bonecaRecebida") {
      const aguardando = base.filter((b) => b.etapas.bonecaSolicitada.status === STATUS.CONCLUIDO && !concluido(b));
      const semSolicitacao = base.filter((b) => concluido(b) && b.etapas.bonecaSolicitada.status !== STATUS.CONCLUIDO);
      resumo.splice(resumo.length - 1, 0, this.q("Solicitadas sem recebimento", aguardando.length));
      resumo.splice(resumo.length - 1, 0, this.q("Recebidas sem solicitação", semSolicitacao.length, { alerta: semSolicitacao.length > 0 }));
      if (semSolicitacao.length) avisos.push(`${this.n(semSolicitacao.length)} materiais têm recebimento (coluna N) sem solicitação confirmada (coluna M). Sinalizados na tabela.`);
      const ids = new Set(semSolicitacao.map((b) => b.id));
      marcador = (b) => ids.has(b.id);
    }
    if (id === "ajustes") {
      resumo.splice(resumo.length - 1, 0, this.q("Iniciados e não concluídos", contagem.get(STATUS.EM_ANDAMENTO) || 0));
    }
    const extrasColunas = [];
    const extrasCelulas = (b) => {
      const celulas = [];
      if (etapa.responsavel) celulas.push({ html: this.celulaValor(b, etapa.responsavel), chave: this.primeiroValor(b, etapa.responsavel), texto: this.primeiroValor(b, etapa.responsavel) });
      if (intervalo) {
        celulas.push({ html: this.celulaValor(b, etapa.inicio), chave: this.chaveOrdenacao(this.primeiroValor(b, etapa.inicio)), texto: this.primeiroValor(b, etapa.inicio) });
        celulas.push({ html: this.celulaValor(b, etapa.fim), chave: this.chaveOrdenacao(this.primeiroValor(b, etapa.fim)), texto: this.primeiroValor(b, etapa.fim) });
      } else {
        celulas.push({ html: this.celulaValor(b, etapa.campo), chave: this.chaveOrdenacao(this.primeiroValor(b, etapa.campo)), texto: this.primeiroValor(b, etapa.campo) });
        if (etapa.data) celulas.push({ html: this.celulaValor(b, etapa.data), chave: this.chaveOrdenacao(this.primeiroValor(b, etapa.data)), texto: this.primeiroValor(b, etapa.data) });
      }
      if (id === "grafica") celulas.push({ html: EntregasView.chipSituacao(b.situacao), chave: SITUACAO_ROTULO[b.situacao], texto: SITUACAO_ROTULO[b.situacao] });
      const st = estadoDe(b);
      const extraAlerta = marcador(b) ? ' <span class="tag tag--alerta">Sem solicitação</span>' : "";
      celulas.push({ html: this.chipEstado(st, rotulos[st]) + extraAlerta, chave: rotulos[st], texto: rotulos[st] });
      return celulas;
    };
    if (etapa.responsavel) extrasColunas.push("Responsável");
    if (intervalo) extrasColunas.push("Início", "Conclusão");
    else {
      extrasColunas.push({ bonecaSolicitada: "Data da solicitação", bonecaRecebida: "Recebimento", qrCodes: "Verificação", grafica: "Data do envio", separatas: "Separatas (U)", gabaritos: "Gabarito (W)" }[id]);
      if (etapa.data) extrasColunas.push("Data");
    }
    if (id === "grafica") extrasColunas.push("Situação geral");
    extrasColunas.push("Situação da etapa");
    const listas = { bonecaSolicitada: { tipo: "bonecas", rotulo: "Abrir lista de bonecas solicitadas" }, grafica: { tipo: "grafica", rotulo: "Abrir lista de livros enviados" } };
    const campoData = intervalo ? etapa.fim : (etapa.data || etapa.campo);
    const titulo = id === "separatas" ? "Separatas V4" : id === "gabaritos" ? "Gabaritos enviados" : etapa.nome;
    return {
      titulo,
      unidade: "materiais",
      valorCard: concluidos,
      hero: {
        valor: this.q(intervalo ? "materiais concluídos" : `materiais · ${rotConcluido.toLowerCase()}`, concluidos),
        anel: { parte: concluidos, total: base.length, rotulo: "de conclusão" },
        apoio: `${this.n(concluidos)} de ${this.n(base.length)} materiais consolidados com a etapa confirmada.`
      },
      resumo,
      pilha: { titulo: "Situação da etapa", itens: estados, total: base.length },
      projetos: { titulo: "Conclusão por projeto", tipo: "progresso", itens: this.porColecao(base, ctx.colecoes, (b) => b.colecao, concluido) },
      tempo: this.serieTemporal(base.filter(concluido).map((b) => this.dataMaterial(b, campoData)), `${intervalo ? "Conclusões" : "Confirmações"} por mês`, this.COLUNAS_DATA[id]),
      blocos: [
        { titulo: "Por ano escolar", tipo: "progresso", itens: this.agrupar(base, (b) => b.ano, concluido, (a, b) => this.ordemAno(a, b)) }
      ],
      nota: intervalo
        ? `Início pela coluna ${id === "montagem" ? "J" : "Q"} e conclusão pela coluna ${id === "montagem" ? "K" : "R"}. Conclusão sem início é inconsistência.`
        : "Etapa confirmada por registro. Ausência de registro não é tratada como atraso.",
      lista: listas[id] || null,
      colunas: ["Coleção", "Ano", "Material", "Módulo", ...extrasColunas],
      linhas: base.map((b) => this.linhaMaterial(b, extrasCelulas(b), estadoDe(b), rotulos[estadoDe(b)])),
      recortes: estados.filter((s) => s.valor).map((s) => ({ id: s.id, rotulo: `${s.rotulo} (${this.n(s.valor)})` })),
      provisorios: ctx.provisorios,
      avisos
    };
  },

  modeloMontagem(ctx) {
    const etapa = ETAPAS_BOOK.find((e) => e.id === "montagem");
    const todas = ctx.confirmados;
    const estadoDe = (b) => b.etapas.montagem.status;
    const concluido = (b) => estadoDe(b) === STATUS.CONCLUIDO;
    const chaveAno = (b) => `${Materiais.semAcento(b.colecao)}|${b.ano}`;
    const estado = this.estado || {};
    const disponiveis = ctx.colecoes.filter((c) => todas.some((b) => Materiais.semAcento(b.colecao) === c.chave)).map((c) => c.chave);
    if (estado.colecaoLocal && !disponiveis.includes(estado.colecaoLocal)) estado.colecaoLocal = null;
    const local = estado.colecaoLocal || null;
    const daColecao = (b) => !local || Materiais.semAcento(b.colecao) === local;
    if (estado.anoLocal && !todas.some((b) => daColecao(b) && chaveAno(b) === estado.anoLocal)) estado.anoLocal = null;
    const anoLocal = estado.anoLocal || null;
    if (estado.situacaoLocal && ![Pendencias.ESTADO, STATUS.EM_ANDAMENTO, STATUS.CONCLUIDO].includes(estado.situacaoLocal)) estado.situacaoLocal = null;
    const situacaoLocal = estado.situacaoLocal || null;
    const doRecorte = (b) => daColecao(b) && (!anoLocal || chaveAno(b) === anoLocal);
    const base = todas.filter(doRecorte);
    const estadoVisual = (b) => Pendencias.etapa(b, "montagem").estado;
    const materiaisTabela = situacaoLocal ? base.filter((b) => estadoVisual(b) === situacaoLocal) : base;
    const rotulos = { nao_iniciado: "Não iniciado", pendente: "Pendentes", em_andamento: "Em andamento", concluido: "Concluído", inconsistente: "Inconsistente" };
    const rotulosEstado = { ...rotulos, pendente: "Pendente" };
    const contagem = this.contar(base, estadoVisual);
    const nPendentes = base.filter((b) => estadoVisual(b) === Pendencias.ESTADO).length;
    const textoSituacao = { concluido: "concluída", em_andamento: "em andamento", pendente: "pendente" };
    const estados = ["nao_iniciado", "em_andamento", "concluido", "inconsistente"].map((s) => ({ id: s, rotulo: rotulos[s], valor: contagem.get(s) || 0 }))
      .filter((s) => s.valor || s.id !== "inconsistente");
    const concluidos = contagem.get(STATUS.CONCLUIDO) || 0;
    const colecaoAtiva = local || (anoLocal ? anoLocal.split("|")[0] : null);
    const colecaoLocal = local ? CiclosEntrega.COLECOES_PROJETO.find((c) => c.chave === local) : null;
    const [anoColecao, anoNome] = anoLocal ? anoLocal.split("|") : [];
    const filtrosLocais = [
      ...(colecaoLocal ? [{ tipo: "colecao", rotulo: colecaoLocal.nome }] : []),
      ...(anoLocal ? [{ tipo: "ano", rotulo: colecaoLocal ? `${anoNome} ano` : `${anoNome} ano · ${anoColecao}` }] : []),
      ...(situacaoLocal ? [{ tipo: "situacao", rotulo: rotulos[situacaoLocal] }] : [])
    ];
    const resumoSituacao = situacaoLocal ? ` · ${this.n(materiaisTabela.length)} ${materiaisTabela.length === 1 ? "material" : "materiais"} com montagem ${textoSituacao[situacaoLocal]}` : "";
    return {
      titulo: etapa.nome,
      unidade: "materiais",
      valorCard: todas.filter(concluido).length,
      filtrosLocais,
      resumoFiltros: `Recorte: ${this.n(base.length)} de ${this.n(todas.length)} materiais da análise${resumoSituacao}`,
      ocultarGraficos: Boolean(situacaoLocal),
      ocultarSituacao: true,
      hero: {
        valor: this.q("materiais concluídos", concluidos),
        anel: { parte: concluidos, total: base.length, rotulo: "de conclusão" },
        apoio: `${this.n(concluidos)} de ${this.n(base.length)} materiais concluídos.`
      },
      resumo: [
        this.q("Total de materiais", base.length),
        ...estados.filter((s) => s.id !== "inconsistente").map((s) => this.q(s.rotulo, s.valor, [STATUS.EM_ANDAMENTO, STATUS.CONCLUIDO].includes(s.id) ? { estado: s.id, filtro: s.id, ativo: situacaoLocal === s.id, unidade: "materiais" } : { estado: s.id })),
        this.q("Pendentes", nPendentes, { estado: Pendencias.ESTADO, filtro: Pendencias.ESTADO, ativo: situacaoLocal === Pendencias.ESTADO, unidade: "materiais" }),
        this.t("Percentual de conclusão", concluidos, base.length, { destaque: true })
      ],
      pilha: { titulo: "Situação da etapa", itens: estados, total: base.length },
      projetos: { titulo: "Conclusão por projeto", tipo: "progresso", interativo: true, selecionada: local, itens: this.porColecao(base, colecaoAtiva ? ctx.colecoes.filter((c) => c.chave === colecaoAtiva) : ctx.colecoes, (b) => b.colecao, concluido) },
      tempo: null,
      blocos: [
        this.blocoAnoPorColecao(base, concluido, anoLocal, (b) => b)
      ],
      nota: null,
      lista: null,
      unidadeTabela: situacaoLocal ? `materiais com montagem ${textoSituacao[situacaoLocal]}` : "materiais",
      tabelaClasse: "analise-tabela--materiais",
      colunas: ["Coleção", "Ano", "Material"],
      linhas: materiaisTabela.map((b) => ({
        estado: estadoDe(b),
        celulas: [
          { html: this.celulaColecao(b.colecao), chave: b.colecao },
          { html: this.e(`${b.ano} ano`), chave: Number(Materiais.canonAno(b.ano)) },
          { html: this.celulaMaterialEtapa(b, estadoVisual(b), rotulosEstado), chave: b.nome }
        ],
        busca: this.normalizar([b.colecao, b.ano, `${b.ano} ano`, b.nome, rotulosEstado[estadoVisual(b)]].join(" "))
      })),
      recortes: situacaoLocal ? [] : estados.filter((s) => s.valor).map((s) => ({ id: s.id, rotulo: `${s.rotulo} (${this.n(s.valor)})` })),
      provisorios: ctx.provisorios.filter(doRecorte),
      avisos: []
    };
  },

  ROTULOS_BONECA: Object.freeze({ nao_iniciado: "Sem solicitação registrada", em_andamento: "Solicitada, sem recebimento confirmado", concluido: "Recebida", inconsistente: "Inconsistente" }),

  situacaoBoneca(b) {
    const s = b.etapas.bonecaSolicitada.status, r = b.etapas.bonecaRecebida.status;
    if (s === STATUS.INCONSISTENTE || r === STATUS.INCONSISTENTE) return STATUS.INCONSISTENTE;
    if (r === STATUS.CONCLUIDO) return s === STATUS.CONCLUIDO ? STATUS.CONCLUIDO : STATUS.INCONSISTENTE;
    return s === STATUS.CONCLUIDO ? STATUS.EM_ANDAMENTO : STATUS.NAO_INICIADO;
  },

  celulaMaterialBoneca(b, situacao) {
    const rotulos = { nao_iniciado: "Sem solicitação", em_andamento: "Solicitada", concluido: "Recebida", inconsistente: "Inconsistente" };
    return `<div class="analise-material">${this.celulaMaterial(b)}<div class="analise-progresso" title="${this.e(`Boneca: ${this.ROTULOS_BONECA[situacao]}`)}">${this.chipEstado(situacao, rotulos[situacao])}</div></div>`;
  },

  ETAPAS_PADRAO: Object.freeze({
    qrCodes: {
      titulo: "Verificação dos QR Codes",
      rotulos: { concluido: "Verificados", nao_iniciado: "Sem verificação confirmada", inconsistente: "Inconsistente" },
      estado: { concluido: "Verificado", nao_iniciado: "Sem verificação", inconsistente: "Inconsistente" },
      projetos: "QR Codes verificados por projeto",
      hero: "materiais verificados",
      campos: [["Registro da verificação (O)", "verificacaoQr"]]
    },
    ajustes: {
      titulo: "Ajustes finais",
      rotulos: { nao_iniciado: "Não iniciado", em_andamento: "Em andamento", concluido: "Concluído", inconsistente: "Inconsistente" },
      estado: { nao_iniciado: "Não iniciado", em_andamento: "Em andamento", concluido: "Concluído", inconsistente: "Inconsistente" },
      projetos: "Ajustes finais concluídos por projeto",
      hero: "materiais concluídos",
      campos: [["Responsável pelos ajustes (P)", "ajusteFinal"], ["Início dos ajustes (Q)", "inicioAjusteFinal"], ["Conclusão dos ajustes (R)", "fimAjusteFinal"]]
    },
    grafica: {
      titulo: "Enviado para impressão",
      rotulos: { concluido: "Enviados", nao_iniciado: "Sem envio confirmado", inconsistente: "Inconsistente" },
      estado: { concluido: "Enviado", nao_iniciado: "Sem envio", inconsistente: "Inconsistente" },
      projetos: "Livros enviados à gráfica por projeto",
      hero: "livros enviados",
      campos: [["Responsável pelo envio (S)", "envioGrafica"], ["Data de envio (T)", "dataEnvioGrafica"]]
    },
    separatas: {
      titulo: "Separatas V4",
      rotulos: { concluido: "Concluídas", nao_iniciado: "Sem confirmação", inconsistente: "Inconsistente" },
      estado: { concluido: "Concluída", nao_iniciado: "Sem confirmação", inconsistente: "Inconsistente" },
      projetos: "Separatas concluídas por projeto",
      hero: "separatas concluídas",
      campos: [["Registro da separata (U)", "separatas"], ["Data correspondente (V)", "dataSeparatas"]]
    },
    gabaritos: {
      titulo: "Gabaritos enviados",
      rotulos: { concluido: "Enviados", nao_iniciado: "Sem confirmação", inconsistente: "Inconsistente" },
      estado: { concluido: "Enviado", nao_iniciado: "Sem confirmação", inconsistente: "Inconsistente" },
      projetos: "Gabaritos enviados por projeto",
      hero: "gabaritos enviados",
      campos: [["Registro do gabarito (W)", "gabarito"], ["Data (X)", "dataGabarito"]]
    }
  }),

  celulaMaterialSituacao(b, status, rotulo, nomeEtapa) {
    return `<div class="analise-material">${this.celulaMaterial(b)}<div class="analise-progresso" title="${this.e(`${nomeEtapa}: ${rotulo}`)}">${this.chipEstado(status, rotulo)}</div></div>`;
  },

  modeloEtapaPadrao(ctx, id) {
    const cfg = this.ETAPAS_PADRAO[id];
    const etapa = ETAPAS_BOOK.find((e) => e.id === id);
    const intervalo = etapa.tipo === "intervalo";
    const todas = ctx.confirmados;
    const estadoDe = (b) => b.etapas[id].status;
    const concluido = (b) => estadoDe(b) === STATUS.CONCLUIDO;
    const filtraveis = intervalo ? [STATUS.NAO_INICIADO, Pendencias.ESTADO, STATUS.EM_ANDAMENTO, STATUS.CONCLUIDO] : [STATUS.CONCLUIDO, Pendencias.ESTADO, STATUS.NAO_INICIADO];
    const estadoVisual = (b) => Pendencias.etapa(b, id).estado;
    const chaveAno = (b) => `${Materiais.semAcento(b.colecao)}|${b.ano}`;
    const estado = this.estado || {};
    const disponiveis = ctx.colecoes.filter((c) => todas.some((b) => Materiais.semAcento(b.colecao) === c.chave)).map((c) => c.chave);
    if (estado.colecaoLocal && !disponiveis.includes(estado.colecaoLocal)) estado.colecaoLocal = null;
    const local = estado.colecaoLocal || null;
    const daColecao = (b) => !local || Materiais.semAcento(b.colecao) === local;
    if (estado.anoLocal && !todas.some((b) => daColecao(b) && chaveAno(b) === estado.anoLocal)) estado.anoLocal = null;
    const anoLocal = estado.anoLocal || null;
    if (estado.situacaoLocal && !filtraveis.includes(estado.situacaoLocal)) estado.situacaoLocal = null;
    const situacaoLocal = estado.situacaoLocal || null;
    const doRecorte = (b) => daColecao(b) && (!anoLocal || chaveAno(b) === anoLocal);
    const base = todas.filter(doRecorte);
    const materiaisTabela = situacaoLocal ? base.filter((b) => estadoVisual(b) === situacaoLocal) : base;
    const rotulos = { ...cfg.rotulos, pendente: "Pendentes" };
    const rotulosEstado = { ...cfg.estado, pendente: "Pendente" };
    const contagem = this.contar(base, estadoVisual);
    const concluidos = contagem.get(STATUS.CONCLUIDO) || 0;
    const inconsistentes = contagem.get(STATUS.INCONSISTENTE) || 0;
    const avisos = inconsistentes ? [`${this.n(inconsistentes)} ${inconsistentes === 1 ? "material tem" : "materiais têm"} registros inconsistentes nesta etapa e não ${inconsistentes === 1 ? "é contado" : "são contados"} como ${rotulos.concluido.toLowerCase()}. Consulte o detalhe do material.`] : [];
    const colecaoAtiva = local || (anoLocal ? anoLocal.split("|")[0] : null);
    const colecaoLocal = local ? CiclosEntrega.COLECOES_PROJETO.find((c) => c.chave === local) : null;
    const [anoColecao, anoNome] = anoLocal ? anoLocal.split("|") : [];
    const filtrosLocais = [
      ...(colecaoLocal ? [{ tipo: "colecao", rotulo: colecaoLocal.nome }] : []),
      ...(anoLocal ? [{ tipo: "ano", rotulo: colecaoLocal ? `${anoNome} ano` : `${anoNome} ano · ${anoColecao}` }] : []),
      ...(situacaoLocal ? [{ tipo: "situacao", rotulo: rotulos[situacaoLocal] }] : [])
    ];
    const unidadeFiltro = situacaoLocal ? `materiais · ${rotulos[situacaoLocal].toLowerCase()}` : "materiais";
    const resumoSituacao = situacaoLocal ? ` · ${this.n(materiaisTabela.length)} ${unidadeFiltro}` : "";
    return {
      titulo: cfg.titulo,
      unidade: "materiais",
      valorCard: todas.filter(concluido).length,
      filtrosLocais,
      resumoFiltros: `Recorte: ${this.n(base.length)} de ${this.n(todas.length)} materiais da análise${resumoSituacao}`,
      ocultarGraficos: Boolean(situacaoLocal),
      ocultarSituacao: true,
      hero: {
        valor: this.q(cfg.hero, concluidos),
        anel: { parte: concluidos, total: base.length, rotulo: "de conclusão" },
        apoio: `${this.n(concluidos)} de ${this.n(base.length)} materiais com a etapa confirmada.`
      },
      resumo: [
        this.q("Total de materiais", base.length),
        ...filtraveis.map((s) => this.q(rotulos[s], contagem.get(s) || 0, { estado: s, filtro: s, ativo: situacaoLocal === s, unidade: "materiais" })),
        this.t("Percentual de conclusão", concluidos, base.length, { destaque: true })
      ],
      pilha: null,
      projetos: { titulo: cfg.projetos, tipo: "progresso", interativo: true, unidadeAria: `materiais · ${rotulos.concluido.toLowerCase()}`, selecionada: local, itens: this.porColecao(base, colecaoAtiva ? ctx.colecoes.filter((c) => c.chave === colecaoAtiva) : ctx.colecoes, (b) => b.colecao, concluido) },
      tempo: null,
      blocos: [
        this.blocoAnoPorColecao(base, concluido, anoLocal, (b) => b)
      ],
      nota: null,
      lista: null,
      unidadeTabela: unidadeFiltro,
      tabelaClasse: "analise-tabela--materiais",
      colunas: ["Coleção", "Ano", "Material"],
      linhas: materiaisTabela.map((b) => ({
        estado: estadoDe(b),
        celulas: [
          { html: this.celulaColecao(b.colecao), chave: b.colecao },
          { html: this.e(`${b.ano} ano`), chave: Number(Materiais.canonAno(b.ano)) },
          { html: this.celulaMaterialSituacao(b, estadoVisual(b), rotulosEstado[estadoVisual(b)], cfg.titulo), chave: b.nome }
        ],
        busca: this.normalizar([b.colecao, b.ano, `${b.ano} ano`, b.nome, rotulosEstado[estadoVisual(b)]].join(" "))
      })),
      recortes: [],
      provisorios: ctx.provisorios.filter(doRecorte),
      avisos
    };
  },

  modeloBoneca(ctx) {
    const todas = ctx.confirmados;
    const solicitada = (b) => b.etapas.bonecaSolicitada.status === STATUS.CONCLUIDO;
    const recebida = (b) => b.etapas.bonecaRecebida.status === STATUS.CONCLUIDO;
    const filtros = {
      solicitadas: { rotulo: "Solicitadas", teste: solicitada, unidade: "materiais com solicitação confirmada" },
      recebidas: { rotulo: "Recebidas", teste: (b) => recebida(b) && solicitada(b), unidade: "materiais com boneca recebida" },
      aguardando: { rotulo: "Recebimento pendente", teste: (b) => Pendencias.pendente(b, "bonecaRecebida"), unidade: "materiais com recebimento pendente" },
      pendSolicitacao: { rotulo: "Solicitação pendente", teste: (b) => Pendencias.pendente(b, "bonecaSolicitada"), unidade: "materiais com solicitação pendente" }
    };
    const chaveAno = (b) => `${Materiais.semAcento(b.colecao)}|${b.ano}`;
    const estado = this.estado || {};
    const disponiveis = ctx.colecoes.filter((c) => todas.some((b) => Materiais.semAcento(b.colecao) === c.chave)).map((c) => c.chave);
    if (estado.colecaoLocal && !disponiveis.includes(estado.colecaoLocal)) estado.colecaoLocal = null;
    const local = estado.colecaoLocal || null;
    const daColecao = (b) => !local || Materiais.semAcento(b.colecao) === local;
    if (estado.anoLocal && !todas.some((b) => daColecao(b) && chaveAno(b) === estado.anoLocal)) estado.anoLocal = null;
    const anoLocal = estado.anoLocal || null;
    if (estado.situacaoLocal && !filtros[estado.situacaoLocal]) estado.situacaoLocal = null;
    const situacaoLocal = estado.situacaoLocal || null;
    const doRecorte = (b) => daColecao(b) && (!anoLocal || chaveAno(b) === anoLocal);
    const base = todas.filter(doRecorte);
    const materiaisTabela = situacaoLocal ? base.filter(filtros[situacaoLocal].teste) : base;
    const rotulos = this.ROTULOS_BONECA;
    const situacao = (b) => this.situacaoBoneca(b);
    const nSolicitadas = base.filter(solicitada).length;
    const nRecebidas = base.filter(recebida).length;
    const nAguardando = base.filter(filtros.aguardando.teste).length;
    const recebidasSemSolicitacao = base.filter((b) => recebida(b) && !solicitada(b)).length;
    const divergentes = base.filter((b) => b.etapas.bonecaSolicitada.status === STATUS.INCONSISTENTE || b.etapas.bonecaRecebida.status === STATUS.INCONSISTENTE).length;
    const avisos = [];
    if (recebidasSemSolicitacao) avisos.push(`${this.n(recebidasSemSolicitacao)} materiais têm recebimento (coluna N) sem solicitação confirmada (coluna M). Classificados como inconsistentes na tabela.`);
    if (divergentes) avisos.push(`${this.n(divergentes)} materiais têm registros divergentes entre frentes nas colunas M ou N.`);
    const colecaoAtiva = local || (anoLocal ? anoLocal.split("|")[0] : null);
    const colecaoLocal = local ? CiclosEntrega.COLECOES_PROJETO.find((c) => c.chave === local) : null;
    const [anoColecao, anoNome] = anoLocal ? anoLocal.split("|") : [];
    const filtrosLocais = [
      ...(colecaoLocal ? [{ tipo: "colecao", rotulo: colecaoLocal.nome }] : []),
      ...(anoLocal ? [{ tipo: "ano", rotulo: colecaoLocal ? `${anoNome} ano` : `${anoNome} ano · ${anoColecao}` }] : []),
      ...(situacaoLocal ? [{ tipo: "situacao", rotulo: filtros[situacaoLocal].rotulo }] : [])
    ];
    const resumoSituacao = situacaoLocal ? ` · ${this.n(materiaisTabela.length)} ${filtros[situacaoLocal].unidade}` : "";
    const cardFiltro = (id, valor, cor) => this.q(filtros[id].rotulo, valor, { estado: cor, filtro: id, ativo: situacaoLocal === id, unidade: "materiais" });
    return {
      titulo: "Boneca",
      unidade: "materiais",
      valorCard: todas.filter(recebida).length,
      filtrosLocais,
      resumoFiltros: `Recorte: ${this.n(base.length)} de ${this.n(todas.length)} materiais da análise${resumoSituacao}`,
      ocultarGraficos: Boolean(situacaoLocal),
      ocultarSituacao: true,
      hero: {
        valor: this.q("bonecas recebidas", nRecebidas),
        anel: { parte: nRecebidas, total: base.length, rotulo: "recebidas" },
        apoio: `${this.n(nRecebidas)} de ${this.n(base.length)} materiais com recebimento confirmado · ${this.n(nSolicitadas)} solicitadas.`
      },
      resumo: [
        this.q("Total de materiais", base.length),
        cardFiltro("solicitadas", nSolicitadas, STATUS.EM_ANDAMENTO),
        cardFiltro("recebidas", nRecebidas, STATUS.CONCLUIDO),
        cardFiltro("pendSolicitacao", base.filter(filtros.pendSolicitacao.teste).length, Pendencias.ESTADO),
        cardFiltro("aguardando", base.filter(filtros.aguardando.teste).length, Pendencias.ESTADO),
        this.t("Percentual de recebimento", nRecebidas, base.length, { destaque: true })
      ],
      pilha: null,
      projetos: { titulo: "Bonecas recebidas por projeto", tipo: "progresso", interativo: true, unidadeAria: "materiais com boneca recebida", selecionada: local, itens: this.porColecao(base, colecaoAtiva ? ctx.colecoes.filter((c) => c.chave === colecaoAtiva) : ctx.colecoes, (b) => b.colecao, recebida) },
      tempo: null,
      blocos: [
        this.blocoAnoPorColecao(base, recebida, anoLocal, (b) => b)
      ],
      nota: null,
      lista: null,
      unidadeTabela: situacaoLocal ? filtros[situacaoLocal].unidade : "materiais",
      tabelaClasse: "analise-tabela--materiais",
      colunas: ["Coleção", "Ano", "Material"],
      linhas: materiaisTabela.map((b) => ({
        estado: situacao(b),
        celulas: [
          { html: this.celulaColecao(b.colecao), chave: b.colecao },
          { html: this.e(`${b.ano} ano`), chave: Number(Materiais.canonAno(b.ano)) },
          { html: this.celulaMaterialBoneca(b, situacao(b)), chave: b.nome }
        ],
        busca: this.normalizar([b.colecao, b.ano, `${b.ano} ano`, b.nome, rotulos[situacao(b)]].join(" "))
      })),
      recortes: [],
      provisorios: ctx.provisorios.filter(doRecorte),
      avisos
    };
  },

  modeloChecklist(ctx) {
    const statusPorRegistro = new Map(EntregasView.proc.checklists.map((c) => [c.id, c.status]));
    const todas = [];
    ctx.confirmados.forEach((b) => {
      (EntregasView.registrosPorMaterial.get(b.id) || []).forEach((r) => {
        todas.push({ registro: r, material: b, status: statusPorRegistro.get(r.id) || STATUS.NAO_INICIADO });
      });
    });
    const disponiveis = ctx.colecoes.filter((c) => todas.some((f) => Materiais.semAcento(f.material.colecao) === c.chave)).map((c) => c.chave);
    if (this.estado && this.estado.colecaoLocal && !disponiveis.includes(this.estado.colecaoLocal)) this.estado.colecaoLocal = null;
    const local = this.estado ? this.estado.colecaoLocal : null;
    const daColecao = (colecao) => !local || Materiais.semAcento(colecao) === local;
    const frentesColecao = todas.filter((f) => daColecao(f.material.colecao));
    const chaveAno = (colecao, ano) => `${Materiais.semAcento(colecao)}|${ano}`;
    if (this.estado && this.estado.anoLocal && !frentesColecao.some((f) => chaveAno(f.material.colecao, f.material.ano) === this.estado.anoLocal)) this.estado.anoLocal = null;
    const anoLocal = this.estado ? this.estado.anoLocal : null;
    const situacaoLocal = this.estado ? this.estado.situacaoLocal : null;
    const doAno = (colecao, ano) => !anoLocal || chaveAno(colecao, ano) === anoLocal;
    const frentes = frentesColecao.filter((f) => doAno(f.material.colecao, f.material.ano));
    const pendDados = Pendencias.dados(EntregasView.proc);
    const pendDisponivel = Boolean(pendDados && pendDados.disponivel);
    frentes.forEach((f) => { f.pendente = pendDisponivel && Pendencias.frente(f.registro, f.status).estado === Pendencias.ESTADO; });
    if (situacaoLocal === Pendencias.ESTADO && !pendDisponivel && this.estado) this.estado.situacaoLocal = null;
    const naoAgrupados = ctx.naoAgrupados.filter((r) => daColecao(r.colecao) && doAno(r.colecao, r.ano));
    const progressoMaterial = new Map();
    frentes.forEach((f) => {
      const p = progressoMaterial.get(f.material.id) || { total: 0, concluidas: 0, emAndamento: 0 };
      p.total += 1;
      if (f.status === STATUS.CONCLUIDO) p.concluidas += 1;
      if (f.status === STATUS.EM_ANDAMENTO) p.emAndamento += 1;
      if (f.pendente) (p.pendentes = p.pendentes || []).push(f.registro);
      progressoMaterial.set(f.material.id, p);
    });
    const materiaisTabela = ctx.confirmados.filter((b) => daColecao(b.colecao) && doAno(b.colecao, b.ano) && (!situacaoLocal || (situacaoLocal === Pendencias.ESTADO ? ((progressoMaterial.get(b.id) || {}).pendentes || []).length > 0 : ((progressoMaterial.get(b.id) || {}).emAndamento || 0) > 0)));
    const nPendentesCk = frentes.filter((f) => f.pendente).length;
    const rotulos = { nao_iniciado: "Não iniciado", em_andamento: "Em andamento", concluido: "Concluído", inconsistente: "Inconsistente" };
    const plurais = { nao_iniciado: "Não iniciadas", em_andamento: "Em andamento", concluido: "Concluídas", inconsistente: "Inconsistentes" };
    const contagem = this.contar(frentes, (f) => (f.pendente ? Pendencias.ESTADO : f.status));
    const estados = ["nao_iniciado", "em_andamento", "concluido", "inconsistente"].map((s) => ({ id: s, rotulo: rotulos[s], valor: contagem.get(s) || 0 }));
    const concluidos = contagem.get(STATUS.CONCLUIDO) || 0;
    const concluida = (f) => f.status === STATUS.CONCLUIDO;
    const colecaoLocal = local ? CiclosEntrega.COLECOES_PROJETO.find((c) => c.chave === local) : null;
    const emAndamento = contagem.get(STATUS.EM_ANDAMENTO) || 0;
    const colecaoAtiva = local || (anoLocal ? anoLocal.split("|")[0] : null);
    const [anoColecao, anoNome] = anoLocal ? anoLocal.split("|") : [];
    const filtrosLocais = [
      ...(colecaoLocal ? [{ tipo: "colecao", rotulo: colecaoLocal.nome }] : []),
      ...(anoLocal ? [{ tipo: "ano", rotulo: colecaoLocal ? `${anoNome} ano` : `${anoNome} ano · ${anoColecao}` }] : []),
      ...(situacaoLocal ? [{ tipo: "situacao", rotulo: situacaoLocal === Pendencias.ESTADO ? "Pendentes" : "Em andamento" }] : [])
    ];
    const resumoFiltros = [
      `Recorte: ${this.n(frentes.length)} de ${this.n(todas.length)} frentes da análise`,
      ...(situacaoLocal ? [`${this.n(situacaoLocal === Pendencias.ESTADO ? nPendentesCk : emAndamento)} ${situacaoLocal === Pendencias.ESTADO ? "pendentes" : "em andamento"} em ${this.n(materiaisTabela.length)} ${materiaisTabela.length === 1 ? "material" : "materiais"}`] : [])
    ].join(" · ");
    return {
      titulo: ETAPA_CHECKLIST.nome,
      unidade: "frentes",
      valorCard: todas.filter(concluida).length,
      filtrosLocais,
      resumoFiltros,
      hero: {
        valor: this.q("frentes concluídas", concluidos),
        anel: { parte: concluidos, total: frentes.length, rotulo: "de conclusão" },
        apoio: `${this.n(concluidos)} de ${this.n(frentes.length)} frentes.`
      },
      resumo: [
        this.q("Total de frentes", frentes.length),
        ...estados.filter((s) => s.id !== "inconsistente").map((s) => this.q(plurais[s.id], s.valor, s.id === STATUS.EM_ANDAMENTO ? { estado: s.id, filtro: STATUS.EM_ANDAMENTO, ativo: situacaoLocal === STATUS.EM_ANDAMENTO } : { estado: s.id })),
        ...(pendDisponivel ? [this.q("Pendentes", nPendentesCk, { estado: Pendencias.ESTADO, filtro: Pendencias.ESTADO, ativo: situacaoLocal === Pendencias.ESTADO })] : []),
        this.t("Percentual de conclusão", concluidos, frentes.length, { destaque: true })
      ],
      pilha: { titulo: "Situação das frentes", itens: estados, total: frentes.length },
      projetos: { titulo: "Frentes concluídas por projeto", tipo: "progresso", interativo: true, selecionada: local, itens: this.porColecao(frentes, colecaoAtiva ? ctx.colecoes.filter((c) => c.chave === colecaoAtiva) : ctx.colecoes, (f) => f.material.colecao, concluida) },
      ocultarGraficos: Boolean(situacaoLocal),
      tempo: null,
      ocultarSituacao: true,
      blocos: [
        this.blocoAnoPorColecao(frentes, concluida, anoLocal)
      ],
      sobretitulo: "Análise · frentes",
      nota: null,
      lista: null,
      unidadeTabela: situacaoLocal ? (situacaoLocal === Pendencias.ESTADO ? "materiais com frentes pendentes" : "materiais com frentes em andamento") : "materiais",
      tabelaClasse: "analise-tabela--materiais",
      colunas: ["Coleção", "Ano", "Material"],
      linhas: materiaisTabela.map((b) => ({
        estado: "",
        celulas: [
          { html: this.celulaColecao(b.colecao), chave: b.colecao },
          { html: this.e(`${b.ano} ano`), chave: Number(Materiais.canonAno(b.ano)) },
          { html: this.celulaMaterialProgresso(b, progressoMaterial.get(b.id), situacaoLocal === STATUS.EM_ANDAMENTO) + (situacaoLocal === Pendencias.ESTADO ? this.listaFrentesPendentes((progressoMaterial.get(b.id) || {}).pendentes || []) : ""), chave: b.nome }
        ],
        busca: this.normalizar([b.colecao, b.ano, `${b.ano} ano`, b.nome].join(" "))
      })),
      recortes: [],
      provisorios: ctx.provisorios.filter((b) => daColecao(b.colecao) && doAno(b.colecao, b.ano)),
      avisos: [
        ...(naoAgrupados.length ? [`${this.n(naoAgrupados.length)} frentes deste recorte ainda não pertencem a um material e não entram nesta análise.`] : []),
        ...(pendDisponivel ? [] : ["Pendências do checklist indisponíveis: a API não informou o campo statusMaterial (coluna Y — STATUS DO MATERIAL)."])
      ]
    };
  },

  listaFrentesPendentes(registros) {
    if (!registros.length) return "";
    const itens = registros.map((r) => `<li>${this.e(r.campos.frente)}${Processamento.preenchido(r.campos.responsavel) ? ` <span>· ${this.e(r.campos.responsavel)}</span>` : ""}</li>`).join("");
    return `<ul class="analise-frentes-pendentes" aria-label="Frentes pendentes">${itens}</ul>`;
  },

  numero(item, classe) {
    const final = this.formatar(item);
    const fim = item.tipo === "pct" ? CiclosEntrega.taxaEntrega(item.parte, item.total) : item.num;
    return `<span class="${classe}" aria-hidden="true" data-contar="${item.tipo}" data-fim="${fim === null || fim === undefined ? "" : fim}" data-final="${this.e(final)}">${this.e(final)}</span><span class="visualmente-oculto">${this.e(final)}</span>`;
  },

  card(classes, conteudo, atributos) {
    return `<section class="glow bento__card ${classes}"${atributos || ""}>${conteudo}</section>`;
  },

  renderizarHero(m) {
    const h = m.hero;
    const taxa = CiclosEntrega.taxaEntrega(h.anel.parte, h.anel.total);
    const proporcao = taxa === null ? 0 : Math.min(100, Math.max(0, taxa)) / 100;
    const deslocamento = (this.CIRCUNFERENCIA * (1 - proporcao)).toFixed(2);
    const textoAnel = `${this.pct(h.anel.parte, h.anel.total)} ${h.anel.rotulo}: ${this.n(h.anel.parte)} de ${this.n(h.anel.total)}`;
    return this.card("bento__hero", `
      <span class="bento__eyebrow">Indicador · ${this.e(this.consolidado ? this.ROTULO_CONSOLIDADO : CiclosEntrega.nomeCiclo(EntregasView.entrega))}</span>
      <h3 class="bento__hero-titulo">${this.e(m.titulo)}</h3>
      <div class="bento__hero-corpo">
        <div class="bento__hero-valor">
          ${this.numero(h.valor, "bento__numero")}
          <span class="bento__unidade">${this.e(h.valor.rotulo)}</span>
          <p class="bento__apoio">${this.e(h.apoio)}</p>
        </div>
        <div class="anel" role="img" aria-label="${this.e(textoAnel)}" data-dica="${this.e(textoAnel)}">
          <svg viewBox="0 0 120 120" aria-hidden="true">
            <circle class="anel__trilho" cx="60" cy="60" r="52"></circle>
            <circle class="anel__arco" cx="60" cy="60" r="52" stroke-dasharray="${this.CIRCUNFERENCIA.toFixed(2)}" stroke-dashoffset="${deslocamento}" style="--anel-cheio:${this.CIRCUNFERENCIA.toFixed(2)}"></circle>
          </svg>
          <span class="anel__centro" aria-hidden="true"><strong>${this.e(this.pct(h.anel.parte, h.anel.total))}</strong><span>${this.e(h.anel.rotulo)}</span></span>
        </div>
      </div>
      ${m.nota ? `<p class="bento__nota">${this.e(m.nota)}</p>` : ""}
      ${m.lista ? `<button type="button" class="analise-botao" data-lista="${this.e(m.lista.tipo)}">${this.e(m.lista.rotulo)}</button>` : ""}`, ' aria-labelledby="analiseTitulo"');
  },

  renderizarStats(m) {
    const itens = m.resumo.filter((r) => !r.destaque);
    const total = m.hero.anel.total;
    const colunas = itens.length <= 2 ? itens.length : itens.length <= 4 ? 2 : itens.length <= 6 ? 3 : 4;
    const sobra = itens.length % colunas;
    return `<div class="bento__stats" style="--colunas:${Math.max(1, colunas)}">${itens.map((r, i) => {
      const cor = r.cor || (r.estado ? this.CORES_ESTADO[r.estado] : "");
      const fatia = Boolean(cor) && r.tipo === "n";
      const ultima = sobra && i === itens.length - 1 ? ` style="--ocupa:${colunas - sobra + 1}"` : "";
      const proporcao = fatia && total ? Math.min(100, (r.num / total) * 100) : 0;
      if (r.colecaoFiltro) {
        const base = r.totalRef || total;
        const prop = base ? Math.min(100, (r.num / base) * 100) : 0;
        const acao = r.ativo ? "filtro ativo; acione para remover" : "acione para filtrar a análise por esta coleção";
        return `<button type="button" class="glow bento__card bento__stat bento__stat--botao${r.ativo ? " is-selecionado" : ""}" data-colecao-local="${this.e(r.colecaoFiltro)}" aria-pressed="${Boolean(r.ativo)}" aria-label="${this.e(`${r.rotulo}: ${this.formatar(r)} materiais programados, ${this.pct(r.num, base)} do total. ${acao}`)}"${!r.num ? " disabled" : ""}${ultima}>
        <span class="bento__stat-rotulo">${cor ? `<i class="bento__marca" style="background:${cor}" aria-hidden="true"></i>` : ""}${this.e(r.rotulo)}${r.ativo ? '<span class="bento-projeto__selo">Filtrando</span>' : ""}</span>
        <span class="bento__stat-base">
          ${this.numero(r, "bento__stat-valor")}
          <span class="bento__stat-fatia">${this.e(this.pct(r.num, base))} do total</span>
          <span class="bento__stat-trilho" aria-hidden="true"><span class="analise-cresce" style="width:${prop.toFixed(2)}%;background:${cor}"></span></span>
        </span></button>`;
      }
      if (r.filtro) {
        const indisponivel = !r.ativo && !r.num;
        const acao = r.ativo ? "filtro ativo; acione para remover" : indisponivel ? "nenhuma frente nesta situação" : "acione para filtrar a tabela";
        return `<button type="button" class="glow bento__card bento__stat bento__stat--botao${r.ativo ? " is-selecionado" : ""}" data-situacao-local="${this.e(r.filtro)}" aria-pressed="${Boolean(r.ativo)}" aria-label="${this.e(`${r.rotulo}: ${this.formatar(r)} ${r.unidade || "frentes"}, ${this.pct(r.num, total)} do total. ${acao}`)}"${indisponivel ? " disabled" : ""}${ultima}>
        <span class="bento__stat-rotulo">${cor ? `<i class="bento__marca" style="background:${cor}" aria-hidden="true"></i>` : ""}${this.e(r.rotulo)}${r.ativo ? '<span class="bento-projeto__selo">Filtrando</span>' : ""}</span>
        <span class="bento__stat-base">
          ${this.numero(r, "bento__stat-valor")}
          <span class="bento__stat-fatia">${this.e(this.pct(r.num, total))} do total</span>
          <span class="bento__stat-trilho" aria-hidden="true"><span class="analise-cresce" style="width:${proporcao.toFixed(2)}%;background:${cor}"></span></span>
        </span></button>`;
      }
      return this.card(`bento__stat${r.alerta ? " is-alerta" : ""}`, `
        <span class="bento__stat-rotulo">${cor ? `<i class="bento__marca" style="background:${cor}" aria-hidden="true"></i>` : ""}${this.e(r.rotulo)}</span>
        <div class="bento__stat-base">
          ${this.numero(r, "bento__stat-valor")}
          ${fatia ? `
            <span class="bento__stat-fatia">${this.e(this.pct(r.num, total))} do total</span>
            <span class="bento__stat-trilho" aria-hidden="true"><span class="analise-cresce" style="width:${proporcao.toFixed(2)}%;background:${cor}"></span></span>` : ""}
        </div>`, ultima);
    }).join("")}</div>`;
  },

  renderizarSituacao(pilha) {
    const total = pilha.total;
    const segmentos = pilha.itens.filter((i) => i.valor > 0).map((i) => {
      const dica = `${i.rotulo}: ${this.n(i.valor)} (${this.pct(i.valor, total)})`;
      return `<span class="analise-pilha__seg" style="flex-grow:${i.valor};background:${this.CORES_ESTADO[i.id]}" data-dica="${this.e(dica)}"></span>`;
    }).join("");
    const legenda = pilha.itens.map((i) => `
      <li data-dica="${this.e(`${i.rotulo}: ${this.n(i.valor)} de ${this.n(total)} (${this.pct(i.valor, total)})`)}">
        <span class="analise-pilha__marca" style="background:${this.CORES_ESTADO[i.id]}" aria-hidden="true"></span>
        <span class="analise-pilha__nome">${this.e(i.rotulo)}</span>
        <strong>${this.n(i.valor)}</strong>
        <span class="analise-pilha__pct">${this.pct(i.valor, total)}</span>
      </li>`).join("");
    return this.card("bento__meio", `
      <h3 class="bento__titulo">${this.e(pilha.titulo)}</h3>
      <div class="analise-pilha" role="img" aria-label="${this.e(pilha.itens.map((i) => `${i.rotulo}: ${i.valor}`).join(", "))}">${segmentos || '<span class="analise-pilha__seg analise-pilha__seg--vazio" style="flex-grow:1"></span>'}</div>
      <ul class="analise-pilha__legenda">${legenda}</ul>`);
  },

  renderizarPareto(p) {
    const n = p.itens.length;
    const maximo = Math.max(1, ...p.itens.map((i) => i.total));
    const passo = Math.max(1, Math.ceil(maximo / 4));
    const teto = passo * 4;
    const x = (i) => ((i + 0.5) / n) * 100;
    const pontos = p.itens.map((i, k) => `${x(k).toFixed(2)},${(100 - i.acumulado).toFixed(2)}`).join(" ");
    const pct = (v) => CiclosEntrega.formatarTaxa(v);
    const acao = (i) => (p.selecionada === i.colecao.chave ? "Filtro ativo; acione para remover" : "Acione para filtrar a análise por esta coleção");
    const dica = (i) => `${i.rotulo}: ${this.n(i.total)} materiais · ${pct(i.percentual)} do total · ${pct(i.acumulado)} acumulado`;
    const colunas = p.itens.map((i) => `
          <button type="button" class="pareto__coluna${p.selecionada === i.colecao.chave ? " is-selecionado" : ""}" data-colecao-local="${this.e(i.colecao.chave)}" aria-pressed="${p.selecionada === i.colecao.chave}" aria-label="${this.e(`${dica(i)}. ${acao(i)}`)}" data-dica="${this.e(dica(i))}">
            <span class="pareto__barra analise-sobe" style="height:${((i.total / teto) * 100).toFixed(2)}%"><span class="pareto__qtd">${this.n(i.total)}</span></span>
          </button>`).join("");
    const marcadores = p.itens.map((i, k) => `<span class="pareto__ponto" style="left:${x(k).toFixed(2)}%;bottom:${i.acumulado.toFixed(2)}%"><span class="pareto__ponto-rotulo">${pct(i.acumulado)}</span></span>`).join("");
    const rotulos = p.itens.map((i) => {
      const c = i.colecao;
      return `
          <button type="button" class="pareto__rotulo${p.selecionada === c.chave ? " is-selecionado" : ""}" data-colecao-local="${this.e(c.chave)}" aria-pressed="${p.selecionada === c.chave}" aria-label="${this.e(`${dica(i)}. ${acao(i)}`)}" data-dica="${this.e(dica(i))}">
            <span class="projetos__marca pareto__marca" style="--recorte-escala: ${c.recorte.escala}; --recorte-x: ${c.recorte.x}; --recorte-y: ${c.recorte.y}"><img src="${c.imagem}" alt="" width="${c.largura}" height="${c.altura}" decoding="async"></span>
            <span class="pareto__nome">${this.e(i.rotulo)}${p.selecionada === c.chave ? '<span class="bento-projeto__selo">Filtrando</span>' : ""}</span>
            <span class="pareto__detalhe">${this.n(i.total)} · ${pct(i.percentual)}</span>
          </button>`;
    }).join("");
    const eixoQ = [4, 3, 2, 1, 0].map((k) => `<span>${this.n(passo * k)}</span>`).join("");
    const eixoP = [100, 75, 50, 25, 0].map((v) => `<span>${v}%</span>`).join("");
    const tabela = p.itens.map((i) => `<tr><th scope="row">${this.e(i.rotulo)}</th><td>${this.n(i.total)}</td><td>${pct(i.percentual)}</td><td>${pct(i.acumulado)}</td></tr>`).join("");
    return this.card("bento__meio", `
      <h3 class="bento__titulo">${this.e(p.titulo)}</h3>
      <p class="bento__rodape">${this.e(p.subtitulo)}</p>
      <div class="pareto" style="--colunas:${n}">
        <div class="pareto__eixo pareto__eixo--q" aria-hidden="true">${eixoQ}</div>
        <div class="pareto__plot">
          <div class="pareto__grade" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span></div>
          <div class="pareto__colunas" role="group" aria-label="Filtrar a análise por coleção">${colunas}</div>
          <svg class="pareto__linha" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polyline points="${pontos}" vector-effect="non-scaling-stroke"/></svg>
          <div class="pareto__pontos" aria-hidden="true">${marcadores}</div>
        </div>
        <div class="pareto__eixo pareto__eixo--p" aria-hidden="true">${eixoP}</div>
        <div class="pareto__rotulos" role="group" aria-label="Coleções">${rotulos}</div>
      </div>
      <div class="pareto__legenda" aria-hidden="true"><span><i class="pareto__amostra pareto__amostra--barra"></i>Materiais programados</span><span><i class="pareto__amostra pareto__amostra--linha"></i>Percentual acumulado</span></div>
      <table class="visualmente-oculto"><caption>Materiais programados por coleção, percentual e acumulado</caption><thead><tr><th scope="col">Coleção</th><th scope="col">Materiais</th><th scope="col">Percentual</th><th scope="col">Acumulado</th></tr></thead><tbody>${tabela}</tbody></table>`);
  },

  renderizarProjetos(p) {
    if (p.tipo === "pareto" && p.itens.length) return this.renderizarPareto(p);
    if (!p.itens.length) {
      return this.card("bento__meio", `<h3 class="bento__titulo">${this.e(p.titulo)}</h3><p class="analise__vazio">Nenhuma coleção no recorte.</p>`);
    }
    const maximo = Math.max(1, ...p.itens.map((i) => i.total));
    const linhas = p.itens.map((i) => {
      const progresso = p.tipo === "progresso";
      const largura = progresso ? (i.total ? (i.valor / i.total) * 100 : 0) : (i.valor / maximo) * 100;
      const texto = progresso ? `${this.n(i.valor)} de ${this.n(i.total)}` : this.n(i.valor);
      const pct = progresso ? this.pct(i.valor, i.total) : `${this.pct(i.valor, p.soma)} do total`;
      const c = i.colecao;
      const conteudo = `
          <span class="projetos__marca bento-projeto__marca" style="--recorte-escala: ${c.recorte.escala}; --recorte-x: ${c.recorte.x}; --recorte-y: ${c.recorte.y}"><img src="${c.imagem}" alt="" width="${c.largura}" height="${c.altura}" decoding="async"></span>
          <span class="bento-projeto__nome">${this.e(i.rotulo)}${p.interativo && p.selecionada === c.chave ? '<span class="bento-projeto__selo">Filtrando</span>' : ""}</span>
          <span class="bento-projeto__valor"><strong>${texto}</strong> <span>${this.e(pct)}</span></span>
          <span class="bento-projeto__trilho" aria-hidden="true"><span class="analise-cresce" style="width:${largura.toFixed(2)}%;background:${i.cor}"></span></span>`;
      if (!p.interativo) {
        return `
        <li class="bento-projeto" data-dica="${this.e(`${i.rotulo}: ${texto} · ${pct}`)}">${conteudo}
        </li>`;
      }
      const selecionada = p.selecionada === c.chave;
      const vazia = !i.total;
      const acao = vazia ? "sem frentes no recorte" : selecionada ? "filtro ativo; acione para remover" : "acione para filtrar a análise";
      const classes = ["bento-projeto", "bento-projeto--botao", selecionada ? "is-selecionado" : "", p.selecionada && !selecionada ? "is-atenuado" : ""].filter(Boolean).join(" ");
      return `
        <li>
          <button type="button" class="${classes}" data-colecao-local="${this.e(c.chave)}" aria-pressed="${selecionada}"${vazia ? " disabled" : ""} aria-label="${this.e(`${i.rotulo}: ${texto} ${p.unidadeAria || "frentes concluídas"}, ${pct}. ${acao}`)}" data-dica="${this.e(`${i.rotulo}: ${texto} · ${pct}`)}">${conteudo}
          </button>
        </li>`;
    }).join("");
    return this.card("bento__meio", `
      <h3 class="bento__titulo">${this.e(p.titulo)}</h3>${p.interativo ? `
      <p class="bento__rodape">Selecione uma coleção para filtrar esta análise.</p>` : ""}
      <ul class="bento-projetos${p.interativo ? " bento-projetos--amplo" : ""}">${linhas}</ul>`);
  },

  renderizarTempo(t) {
    const maximo = Math.max(1, ...t.itens.map((i) => i.valor));
    const colunas = t.itens.map((i) => `
      <li class="bento-tempo__coluna" data-dica="${this.e(`${i.rotulo}: ${this.n(i.valor)} no mês · ${this.n(i.acumulado)} acumulado`)}">
        <span class="bento-tempo__valor">${this.n(i.valor)}</span>
        <span class="bento-tempo__trilho" aria-hidden="true"><span class="analise-sobe" style="height:${((i.valor / maximo) * 100).toFixed(2)}%"></span></span>
        <span class="bento-tempo__mes">${this.e(i.rotulo)}</span>
        <span class="bento-tempo__acumulado">${this.n(i.acumulado)} acum.</span>
      </li>`).join("");
    const notas = [
      `Mês extraído da coluna ${t.coluna}.`,
      t.semAno ? "A planilha não informa o ano em todas as datas; os meses foram ordenados dentro do mesmo ciclo." : "",
      t.semData ? `${this.n(t.semData)} registros confirmados sem data válida não aparecem no gráfico.` : ""
    ].filter(Boolean).join(" ");
    return this.card("bento__meio", `
      <h3 class="bento__titulo">${this.e(t.titulo)}</h3>
      <ol class="bento-tempo" role="img" aria-label="${this.e(t.itens.map((i) => `${i.rotulo}: ${i.valor}`).join(", "))}">${colunas}</ol>
      <p class="bento__rodape">${this.e(notas)}</p>`);
  },

  renderizarBloco(bloco) {
    if (!bloco.itens.length) {
      return this.card("bento__meio", `<h3 class="bento__titulo">${this.e(bloco.titulo)}</h3><p class="analise__vazio">Sem dados no recorte.</p>`);
    }
    const maximo = Math.max(1, ...bloco.itens.map((i) => i.total));
    const linha = (i) => {
      const progresso = bloco.tipo === "progresso";
      const largura = progresso ? (i.total ? (i.valor / i.total) * 100 : 0) : (i.valor / maximo) * 100;
      const texto = progresso ? `${this.n(i.valor)} de ${this.n(i.total)} · ${this.pct(i.valor, i.total)}` : this.n(i.valor);
      if (bloco.interativo && i.chave) {
        const ativo = bloco.selecionado === i.chave;
        const classes = ["analise-barra", "analise-barra--botao", ativo ? "is-selecionado" : "", bloco.selecionado && !ativo ? "is-atenuado" : ""].filter(Boolean).join(" ");
        return `
        <li><button type="button" class="${classes}" data-ano-local="${this.e(i.chave)}" aria-pressed="${ativo}" aria-label="${this.e(`${i.dica}: ${texto}. ${ativo ? "Filtro ativo; acione para remover" : "Acione para filtrar a análise"}`)}" data-dica="${this.e(`${i.dica}: ${texto}`)}">
          <span class="analise-barra__rotulo">${ativo ? '<span class="analise-barra__marca" aria-hidden="true">✓</span>' : ""}${this.e(i.rotulo)}</span>
          <span class="analise-barra__trilho" aria-hidden="true"><span class="analise-cresce" style="width:${largura.toFixed(2)}%"></span></span>
          <span class="analise-barra__valor">${texto}</span>
        </button></li>`;
      }
      return `
        <li class="analise-barra${i.atual ? " is-atual" : ""}" data-dica="${this.e(`${i.dica || i.rotulo}: ${texto}`)}">
          <span class="analise-barra__rotulo">${this.e(i.rotulo)}</span>
          <span class="analise-barra__trilho" aria-hidden="true"><span class="analise-cresce" style="width:${largura.toFixed(2)}%"></span></span>
          <span class="analise-barra__valor">${texto}</span>
        </li>`;
    };
    if (bloco.grupos) {
      return this.card("bento__meio", `
      <h3 class="bento__titulo">${this.e(bloco.titulo)}</h3>${bloco.grupos.map((g) => `
      <section class="analise-grupo" aria-label="${this.e(`Anos escolares da coleção ${g.colecao}`)}">
        <p class="bento__colecao">${this.e(g.colecao)}</p>
        <ul class="analise-barras analise-barras--livre analise-barras--colecao">${g.itens.map(linha).join("")}</ul>
      </section>`).join("")}`);
    }
    const linhas = bloco.itens.map(linha).join("");
    return this.card("bento__meio", `
      <h3 class="bento__titulo">${this.e(bloco.titulo)}</h3>
      <ul class="analise-barras${bloco.livre ? " analise-barras--livre" : ""}">${linhas}</ul>`);
  },

  linhasVisiveis() {
    const { busca, recorte, ordem } = this.estado;
    const termo = this.normalizar(busca.trim());
    let linhas = this.modelo.linhas.filter((l) => (!recorte || l.estado === recorte) && (!termo || l.busca.includes(termo)));
    if (ordem.indice >= 0) {
      const fator = ordem.direcao === "asc" ? 1 : -1;
      linhas = linhas.slice().sort((a, b) => {
        const x = a.celulas[ordem.indice].chave;
        const y = b.celulas[ordem.indice].chave;
        const xv = typeof x === "number" ? x : this.chaveOrdenacao(x);
        const yv = typeof y === "number" ? y : this.chaveOrdenacao(y);
        return (xv > yv ? 1 : xv < yv ? -1 : 0) * fator;
      });
    }
    return linhas;
  },

  renderizarTabela() {
    const alvo = Utils.qs("#analiseTabela", this.conteudo);
    if (!alvo) return;
    const linhas = this.linhasVisiveis();
    const paginas = Math.max(1, Math.ceil(linhas.length / this.POR_PAGINA));
    this.estado.pagina = Math.min(Math.max(1, this.estado.pagina), paginas);
    const inicio = (this.estado.pagina - 1) * this.POR_PAGINA;
    const pagina = linhas.slice(inicio, inicio + this.POR_PAGINA);
    const { ordem } = this.estado;
    const cabecalho = this.modelo.colunas.map((c, i) => {
      const ativo = ordem.indice === i;
      const sort = ativo ? (ordem.direcao === "asc" ? "ascending" : "descending") : "none";
      return `<th scope="col" aria-sort="${sort}"><button type="button" class="analise-ordenar" data-ordenar="${i}">${this.e(c)}<span aria-hidden="true">${ativo ? (ordem.direcao === "asc" ? " ▲" : " ▼") : ""}</span></button></th>`;
    }).join("");
    const corpo = pagina.length
      ? pagina.map((l) => `<tr${l.estado === STATUS.INCONSISTENTE ? ' class="is-inconsistente"' : ""}>${l.celulas.map((c) => `<td>${c.html}</td>`).join("")}</tr>`).join("")
      : `<tr><td colspan="${this.modelo.colunas.length}" class="tabela__vazia">Nenhum registro para a busca ou o recorte selecionado.</td></tr>`;
    alvo.innerHTML = `
      <p class="analise-tabela__contagem" role="status">${linhas.length ? `Mostrando ${this.n(inicio + 1)}–${this.n(inicio + pagina.length)} de ${this.n(linhas.length)} ${this.modelo.unidadeTabela || this.modelo.unidade}` : `0 ${this.modelo.unidadeTabela || this.modelo.unidade}`}${linhas.length !== this.modelo.linhas.length ? ` (de ${this.n(this.modelo.linhas.length)} no total)` : ""}</p>
      <div class="tabela__rolagem" tabindex="0" role="region" aria-label="Detalhamento de ${this.e(this.modelo.titulo)}">
        <table class="tabela tabela--compacta analise-tabela${this.modelo.tabelaClasse ? " " + this.modelo.tabelaClasse : ""}">
          <thead><tr>${cabecalho}</tr></thead>
          <tbody>${corpo}</tbody>
        </table>
      </div>
      <nav class="analise-tabela__paginas" aria-label="Paginação">
        <button type="button" data-direcao="anterior" data-pagina="${this.estado.pagina - 1}"${this.estado.pagina <= 1 ? " disabled" : ""}>Anterior</button>
        <span>Página ${this.n(this.estado.pagina)} de ${this.n(paginas)}</span>
        <button type="button" data-direcao="proxima" data-pagina="${this.estado.pagina + 1}"${this.estado.pagina >= paginas ? " disabled" : ""}>Próxima</button>
      </nav>`;
  },

  renderizar(entrada) {
    const m = this.modelo;
    const avisos = [
      ...(this.desatualizado ? ["A atualização dos dados falhou. As informações exibidas são da última atualização válida."] : []),
      ...m.avisos
    ].map((a) => `<div class="aviso" role="note">${ICONES.alerta}<p>${this.e(a)}</p></div>`).join("");
    const meios = m.ocultarGraficos ? [] : [
      this.renderizarProjetos(m.projetos),
      ...(m.ocultarSituacao ? [] : [this.renderizarSituacao(m.pilha)]),
      ...(m.tempo ? [this.renderizarTempo(m.tempo)] : []),
      ...m.blocos.map((b) => this.renderizarBloco(b))
    ];
    if (meios.length % 2) meios[meios.length - 1] = meios[meios.length - 1].replace("bento__meio", "bento__meio bento__largo");
    const provisorios = m.provisorios.length ? this.card("bento__largo", `
      <details class="recolhivel">
        <summary><span class="bento__titulo">Agrupamentos provisórios (fora dos totais)</span><span class="contador">${this.n(m.provisorios.length)}</span></summary>
        <ul class="analise__provisorios">${m.provisorios.map((b) => `<li>${this.celulaMaterial(b)} · ${this.e(b.colecao)} ${this.e(b.ano)} · ${this.e(b.pendencias.filter((p) => p.provisorio).map((p) => p.descricao).join(" "))}</li>`).join("")}</ul>
      </details>`) : "";
    const recortes = m.recortes.length > 1 ? `
      <label class="analise-ferramentas__campo">
        <span>Situação</span>
        <select class="filtro__select" data-recorte-analise>
          <option value="">Todas (${this.n(m.linhas.length)})</option>
          ${m.recortes.map((r) => `<option value="${this.e(r.id)}"${this.estado.recorte === r.id ? " selected" : ""}>${this.e(r.rotulo)}</option>`).join("")}
        </select>
      </label>` : "";
    this.conteudo.innerHTML = `
      <header class="analise__cabecalho">
        <div>
          <span class="analise__eyebrow">${this.e(m.sobretitulo || `Análise gerencial · ${m.unidade}`)}</span>
          <h2 class="analise__titulo" id="analiseTitulo">${this.e(m.titulo)}</h2>
          <div class="lista-indicador__filtros">${this.consolidado ? `<span class="tag tag--primaria">${this.e(this.ROTULO_CONSOLIDADO)}</span>` : EntregasView.descricaoFiltros()}</div>
        </div>
        <div class="analise__controles">
          ${this.botaoMaximizacao()}
          <button type="button" class="analise__fechar" data-fechar-analise aria-label="Fechar análise" title="Fechar análise">${ICONES_ENTREGA.fechar}</button>
        </div>
      </header>
      <div class="analise__corpo${entrada ? " is-entrando" : ""}">
        ${m.filtrosLocais && m.filtrosLocais.length ? `<div class="analise-filtro-local" role="status"><div class="analise-filtro-local__lista"><span>Filtros da análise:</span>${m.filtrosLocais.map((f) => `<button type="button" class="analise-filtro-chip" data-remover-filtro="${this.e(f.tipo)}" aria-label="${this.e(`Remover filtro ${f.rotulo}`)}">${this.e(f.rotulo)}<span aria-hidden="true">×</span></button>`).join("")}</div><span class="analise-filtro-local__resumo">${this.e(m.resumoFiltros)}</span><button type="button" class="analise-filtro-local__limpar" data-limpar-colecao-local>Limpar filtros da análise</button></div>` : ""}${avisos}
        <div class="bento">
          ${this.renderizarHero(m)}
          ${this.renderizarStats(m)}
          ${meios.join("")}
          ${provisorios}
          ${this.card("bento__largo bento__detalhe", `
            <div class="analise-detalhe__cabecalho">
              <h3 class="bento__titulo" id="analiseDetalheTitulo">Detalhamento</h3>
              ${m.lista ? `<button type="button" class="analise-botao" data-lista="${this.e(m.lista.tipo)}">${this.e(m.lista.rotulo)}</button>` : ""}
            </div>
            <div class="analise-ferramentas">
              <label class="analise-ferramentas__campo analise-ferramentas__busca">
                <span>Buscar</span>
                <input type="search" class="analise-busca" data-busca value="${this.e(this.estado.busca)}" placeholder="Coleção, ano, material, disciplina…" autocomplete="off">
              </label>
              ${m.filtroModulo ? `
              <label class="analise-ferramentas__campo">
                <span>Módulo</span>
                <select class="filtro__select" data-modulo-analise aria-label="Filtrar o detalhamento por módulo">
                  <option value="">Todos (${this.n(m.filtroModulo.total)})</option>
                  ${m.filtroModulo.opcoes.map((o) => `<option value="${this.e(o.id)}"${m.filtroModulo.valor === o.id ? " selected" : ""}>${this.e(o.id)} (${this.n(o.n)})</option>`).join("")}
                </select>
              </label>` : ""}${recortes}
            </div>
            <div id="analiseTabela"></div>`, ' aria-labelledby="analiseDetalheTitulo"')}
        </div>
      </div>`;
    this.renderizarTabela();
  }
};
