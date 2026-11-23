const CiclosEntrega = {
  ENTREGAS: Object.freeze([1, 2, 3, 4]),

  classificarModulo(colecao, modulo) {
    const c = Materiais.semAcento(colecao);
    const m = Materiais.canonModulo(modulo).replace(/^(BOOK|MANUAL|CMA)-/, "");
    if (m === "ANUAL") return { entrega: 1, pendente: false };
    if (c === "LUDUS") {
      if (m === "M1/M2") return { entrega: 1, pendente: false };
      if (m === "M3/M4") return { entrega: 3, pendente: false };
    }
    if (c === "BASIS" || c === "MUNDUS") {
      const n = m.match(/^M([1-4])$/);
      if (n) return { entrega: Number(n[1]), pendente: false };
    }
    return { entrega: null, pendente: false, motivo: "Módulo sem regra de entrega definida." };
  },

  classificar(material) {
    return this.classificarModulo(material.colecao, material.modulo);
  },

  rotulo(classificacao) {
    if (classificacao.entrega) return this.nomeCiclo(classificacao.entrega);
    if (classificacao.pendente) return "Classificação de entrega pendente";
    return "Sem regra de entrega";
  },

  TITULOS_CABECALHO: Object.freeze({ 1: "1º ENTREGA - LIVRO 1", 2: "2º ENTREGA - LIVRO 2", 3: "3º ENTREGA - LIVRO 3", 4: "4º ENTREGA - LIVRO 4" }),

  tituloCabecalho(entrega) {
    return this.TITULOS_CABECALHO[Number(entrega)] || this.nomeCiclo(entrega).toUpperCase();
  },

  nomeCiclo(entrega) {
    return `${entrega}º Entrega`;
  },

  pertence(classificacao, entrega) {
    return classificacao.entrega === entrega;
  },

  pendenteEm(classificacao, entrega) {
    return classificacao.pendente && classificacao.possiveis.includes(entrega);
  },

  selecionar(proc, entrega) {
    const materiais = [];
    const pendentes = [];
    const semRegra = [];
    proc.books.forEach((b) => {
      const c = this.classificar(b);
      if (this.pertence(c, entrega)) materiais.push(b);
      else if (this.pendenteEm(c, entrega)) pendentes.push(b);
      else if (!c.entrega && !c.pendente) semRegra.push(b);
    });
    const naoAgrupados = proc.naoClassificados.filter((nc) => {
      const c = this.classificarModulo(nc.colecao, nc.modulo);
      return this.pertence(c, entrega) || this.pendenteEm(c, entrega);
    });
    return { entrega, materiais, pendentes, semRegra, naoAgrupados };
  },

  statusChecklist(checklist) {
    if (!checklist.total) return STATUS.NAO_INICIADO;
    if (checklist.inconsistente) return STATUS.INCONSISTENTE;
    if (checklist.concluido === checklist.total) return STATUS.CONCLUIDO;
    if (checklist.nao_iniciado === checklist.total) return STATUS.NAO_INICIADO;
    return STATUS.EM_ANDAMENTO;
  },

  temInconsistenciaEtapa(material) {
    return material.checklist.inconsistente > 0 ||
      ETAPAS_BOOK.some((e) => material.etapas[e.id].status === STATUS.INCONSISTENTE);
  },

  resumir(lista) {
    const base = IndicadoresCalculo.contarBooks(lista);
    const frentes = lista.reduce((t, b) => t + b.checklist.total, 0);
    const checklistsConcluidos = lista.reduce((t, b) => t + b.checklist.concluido, 0);
    return {
      ...base,
      emMontagem: base.montagemIniciada - base.montagemConcluida,
      frentes,
      checklistsConcluidos,
      inconsistenciasEtapa: lista.filter((b) => this.temInconsistenciaEtapa(b)).length
    };
  },

  indicadores(materiais) {
    return {
      confirmados: this.resumir(materiais.filter((b) => !b.provisorio)),
      provisorios: this.resumir(materiais.filter((b) => b.provisorio))
    };
  },

  COLECOES_PROJETO: Object.freeze([
    Object.freeze({ chave: "BASIS", nome: "BASIS", imagem: "assets/Basis.png", largura: 1254, altura: 1254, cor: "var(--cor-basis)", recorte: Object.freeze({ escala: "103.21%", x: "-1.235%", y: "-2.058%" }) }),
    Object.freeze({ chave: "LUDUS", nome: "LUDUS", imagem: "assets/Ludus.png", largura: 1254, altura: 1254, cor: "var(--cor-ludus)", recorte: Object.freeze({ escala: "113.07%", x: "-5.636%", y: "-6.808%" }) }),
    Object.freeze({ chave: "MUNDUS", nome: "MUNDUS", imagem: "assets/Mundus.png", largura: 1536, altura: 1024, cor: "var(--cor-mundus)", recorte: Object.freeze({ escala: "155.31%", x: "-27.4%", y: "-2.123%" }) })
  ]),

  enviosPorColecao(materiais) {
    const confirmados = materiais.filter((b) => !b.provisorio);
    const geral = IndicadoresCalculo.contarBooks(confirmados);
    const itens = this.COLECOES_PROJETO.map((colecao) => {
      const contagem = IndicadoresCalculo.contarBooks(
        confirmados.filter((b) => Materiais.semAcento(b.colecao) === colecao.chave)
      );
      const programados = contagem.total;
      const enviados = contagem.enviadosGrafica;
      return {
        ...colecao,
        programados,
        enviados,
        faltam: programados - enviados,
        taxa: this.taxaEntrega(enviados, programados),
        proporcao: programados ? Math.min(1, enviados / programados) : 0,
        inconsistente: enviados > programados
      };
    });
    const somaProgramados = itens.reduce((t, i) => t + i.programados, 0);
    const somaEnviados = itens.reduce((t, i) => t + i.enviados, 0);
    return {
      itens,
      programados: geral.total,
      enviados: geral.enviadosGrafica,
      somaProgramados,
      somaEnviados,
      taxaGeral: this.taxaEntrega(somaEnviados, somaProgramados),
      semColecao: geral.total - somaProgramados,
      enviosSemColecao: geral.enviadosGrafica - somaEnviados
    };
  },

  TITULOS_RESUMO: Object.freeze({ grafica: "Enviado para impressão", separatas: "Separatas V4", gabaritos: "Gabaritos enviados" }),

  SEM_ANDAMENTO: Object.freeze(["grafica", "separatas", "gabaritos"]),

  resumoEtapas(materiais) {
    const confirmados = materiais.filter((b) => !b.provisorio);
    const pendencias = Pendencias.resumo(EntregasView.proc, confirmados);
    const percentual = (concluidos, total) => (total ? (concluidos / total) * 100 : null);
    const checklist = confirmados.reduce((t, b) => ({
      total: t.total + b.checklist.total,
      emAndamento: t.emAndamento + b.checklist.em_andamento,
      concluidos: t.concluidos + b.checklist.concluido
    }), { total: 0, emAndamento: 0, concluidos: 0 });
    const etapas = ETAPAS_BOOK.map((etapa) => {
      const status = confirmados.map((b) => b.etapas[etapa.id].status);
      const concluidos = status.filter((s) => s === STATUS.CONCLUIDO).length;
      return {
        id: etapa.id,
        nome: this.TITULOS_RESUMO[etapa.id] || etapa.nome,
        exibirAndamento: !this.SEM_ANDAMENTO.includes(etapa.id),
        unidade: "materiais",
        total: confirmados.length,
        emAndamento: status.filter((s) => s === STATUS.EM_ANDAMENTO).length,
        pendentes: pendencias.etapas[etapa.id],
        concluidos,
        percentual: percentual(concluidos, confirmados.length),
        analise: etapa.id
      };
    });
    const solicitadas = confirmados.filter((b) => b.etapas.bonecaSolicitada.status === STATUS.CONCLUIDO).length;
    const recebidas = confirmados.filter((b) => b.etapas.bonecaRecebida.status === STATUS.CONCLUIDO).length;
    const boneca = { id: "boneca", nome: "Boneca", unidade: "materiais", total: confirmados.length, solicitadas, emAndamento: 0, pendentes: pendencias.etapas.bonecaSolicitada + pendencias.etapas.bonecaRecebida, concluidos: recebidas, percentual: percentual(recebidas, confirmados.length), analise: "boneca", linhas: "boneca" };
    const posicao = etapas.findIndex((e) => e.id === "bonecaSolicitada");
    const unificadas = etapas.filter((e) => e.id !== "bonecaSolicitada" && e.id !== "bonecaRecebida");
    unificadas.splice(posicao, 0, boneca);
    return [
      { id: ETAPA_CHECKLIST.id, nome: ETAPA_CHECKLIST.nome, unidade: "frentes", ...checklist, pendentes: pendencias.checklist, pendentesIndisponivel: !pendencias.disponivel, percentual: percentual(checklist.concluidos, checklist.total), analise: "checklist" },
      ...unificadas
    ];
  },

  taxaEntrega(enviados, programados) {
    if (!programados) return null;
    return (enviados / programados) * 100;
  },

  formatarTaxa(taxa) {
    if (taxa === null || !Number.isFinite(taxa)) return "—";
    return `${taxa.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
  }
};

const ICONES_ENTREGA = Object.freeze({
  montagem: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/></svg>',
  boneca: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="M3 8l9 5 9-5"/><path d="M12 13v8"/></svg>',
  grafica: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M6 14h12v7H6z"/></svg>',
  entregue: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m8.5 12.5 2.5 2.5 4.5-5"/></svg>',
  taxa: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 5 5 19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>',
  fechar: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>'
});

const EntregasView = {
  entrega: 1,
  proc: null,
  estado: { carregando: false, erro: null },
  filtros: { colecao: [], ano: [], tipo: [], situacao: [] },
  filtrosEdicao: { colecao: [], ano: [], tipo: [], situacao: [] },
  filtrosVisao: { colecao: [], entrega: [], ano: [], modulo: [], tipo: [] },
  escopo: "entregas",
  registrosPorMaterial: new Map(),

  init() {
    this.conteudo = Utils.qs("#entregasConteudo");
    this.titulo = Utils.qs("#topbarTitulo");
    this.secao = Utils.qs("#entregas");
    this.dialogo = Utils.qs("#detalheMaterial");
    this.detalhe = Utils.qs("#detalheConteudo");

    this.configurarPainelFiltros();

    this.listaDialogo = Utils.qs("#listaIndicador");
    this.listaConteudo = Utils.qs("#listaIndicadorConteudo");

    Analises.init();

    this.conteudo.addEventListener("keydown", (evento) => {
      const card = evento.target.closest("[data-analise]");
      if (card && (evento.key === "Enter" || evento.key === " ")) {
        evento.preventDefault();
        Analises.abrir(card.dataset.analise, card);
      }
    });

    this.listaDialogo.addEventListener("click", (evento) => {
      const material = evento.target.closest("[data-material]");
      if (material) {
        this.abrirDetalhe(material.dataset.material, material);
        return;
      }
      const recorte = evento.target.closest("[data-recorte]");
      if (recorte) {
        this.indicadorAtivo.recorte = recorte.dataset.recorte;
        this.renderizarIndicador();
        const ativo = Utils.qs(`[data-recorte="${recorte.dataset.recorte}"]`, this.listaDialogo);
        if (ativo) ativo.focus();
        return;
      }
      const salvar = evento.target.closest("[data-salvar-enviados]");
      if (salvar) {
        this.salvarEnviados(salvar);
        return;
      }
      if (evento.target === this.listaDialogo || evento.target.closest("[data-fechar-lista]")) this.fecharDialogo(this.listaDialogo);
    });
    this.listaDialogo.addEventListener("close", () => this.devolverFoco(this.origemLista));

    this.conteudo.addEventListener("error", (evento) => {
      const img = evento.target;
      if (img && img.tagName === "IMG" && img.closest(".tabela-colecao")) img.closest(".tabela-colecao").classList.add("is-sem-imagem");
    }, true);

    this.conteudo.addEventListener("click", (evento) => {
      const projeto = evento.target.closest("[data-filtro-colecao]");
      if (projeto) {
        this.alternarColecaoGrafico(projeto.dataset.filtroColecao);
        return;
      }
      const removerColecao = evento.target.closest("[data-remover-colecao]");
      if (removerColecao) {
        this.removerColecaoGrafico(removerColecao.dataset.removerColecao);
        return;
      }
      const card = evento.target.closest("[data-analise]");
      if (card) {
        Analises.abrir(card.dataset.analise, card);
        return;
      }
      const botao = evento.target.closest("[data-material]");
      if (botao) {
        if (botao.closest(".tabela--entregas")) this.abrirAcompanhamento(botao.dataset.material, botao);
        else this.abrirDetalhe(botao.dataset.material, botao);
      }
    });

    this.dialogo.addEventListener("close", () => this.dialogo.classList.remove("detalhe--acompanhamento"));

    this.dialogo.addEventListener("click", (evento) => {
      if (evento.target === this.dialogo || evento.target.closest("[data-fechar]")) this.fecharDetalhe();
    });
    this.dialogo.addEventListener("close", () => this.devolverFoco(this.origemFoco));
  },

  selecionar(entrega) {
    this.entrega = Number(entrega) || 1;
    this.renderizar();
  },

  atualizar(proc, estado) {
    this.estado = estado;
    this.conteudo.setAttribute("aria-busy", String(Boolean(estado.carregando)));
    if (estado.carregando) {
      if (!this.proc) this.renderizar();
      return;
    }
    if (estado.erro) Analises.marcarDesatualizado();
    this.proc = estado.erro ? null : proc;
    this.registrosPorMaterial = new Map();
    if (this.proc) {
      this.proc.registros.forEach((r) => {
        if (!r.materialId) return;
        if (!this.registrosPorMaterial.has(r.materialId)) this.registrosPorMaterial.set(r.materialId, []);
        this.registrosPorMaterial.get(r.materialId).push(r);
      });
    }
    this.renderizar();
  },

  e(valor) {
    return Utils.escaparHtml(valor);
  },

  n(valor) {
    return Utils.formatarNumero(valor);
  },

  chip(status) {
    return `<span class="chip chip--${status}">${STATUS_ROTULO[status]}</span>`;
  },

  chipSituacao(situacao) {
    return `<span class="chip chip-sit--${situacao}">${SITUACAO_ROTULO[situacao]}</span>`;
  },

  ordenar(lista) {
    return lista.slice().sort((a, b) =>
      a.colecao.localeCompare(b.colecao, "pt-BR") ||
      Number(Materiais.canonAno(a.ano)) - Number(Materiais.canonAno(b.ano)) ||
      a.nome.localeCompare(b.nome, "pt-BR", { numeric: true })
    );
  },

  PRIORIDADE_COLECAO: Object.freeze({ MUNDUS: 0, BASIS: 1, LUDUS: 2 }),

  ordenarAcompanhamento(lista) {
    const prioridade = (b) => this.PRIORIDADE_COLECAO[Materiais.semAcento(b.colecao)] ?? 99;
    const ano = (b) => { const d = Materiais.canonAno(b.ano); return d ? Number(d) : -1; };
    return this.ordenar(lista).sort((a, b) => prioridade(a) - prioridade(b) || ano(b) - ano(a));
  },

  GRUPOS_FILTRO: Object.freeze([
    Object.freeze({ id: "colecao", titulo: "Coleção" }),
    Object.freeze({ id: "tipo", titulo: "Tipo de material" }),
    Object.freeze({ id: "ano", titulo: "Ano escolar" }),
    Object.freeze({ id: "situacao", titulo: "Situação" })
  ]),

  GRUPOS_FILTRO_VISAO: Object.freeze([
    Object.freeze({ id: "colecao", titulo: "Coleção" }),
    Object.freeze({ id: "entrega", titulo: "Entrega" }),
    Object.freeze({ id: "ano", titulo: "Ano escolar" }),
    Object.freeze({ id: "modulo", titulo: "Módulo" }),
    Object.freeze({ id: "tipo", titulo: "Tipo de material" })
  ]),

  filtrosVazios(escopo = "entregas") {
    return escopo === "visao" ? { colecao: [], entrega: [], ano: [], modulo: [], tipo: [] } : { colecao: [], ano: [], tipo: [], situacao: [] };
  },

  escopoDe(filtros) {
    return "entrega" in filtros ? "visao" : "entregas";
  },

  gruposPainel() {
    return this.escopo === "visao" ? this.GRUPOS_FILTRO_VISAO : this.GRUPOS_FILTRO;
  },

  filtrosAtivos() {
    return this.escopo === "visao" ? this.filtrosVisao : this.filtros;
  },

  moduloCurto(modulo) {
    return Materiais.canonModulo(modulo).replace(/^(BOOK|MANUAL|CMA)-/, "");
  },

  copiarFiltros(filtros) {
    return Object.fromEntries(Object.entries(filtros).map(([k, v]) => [k, [...v]]));
  },

  valorDoGrupo(grupo, material) {
    if (grupo === "colecao") return Materiais.semAcento(material.colecao);
    if (grupo === "ano") return material.ano;
    if (grupo === "tipo") return material.tipoMaterial;
    if (grupo === "modulo") return this.moduloCurto(material.modulo);
    if (grupo === "entrega") { const e = CiclosEntrega.classificar(material).entrega; return e ? String(e) : ""; }
    return material.situacao;
  },

  atendeFiltros(material, filtros, ignorar) {
    return Object.keys(filtros).every((id) =>
      id === ignorar || !filtros[id].length || filtros[id].includes(this.valorDoGrupo(id, material)));
  },

  baseFiltros(escopo = "entregas") {
    if (!this.proc) return [];
    if (escopo === "visao") return this.proc.books.filter((b) => !b.provisorio);
    return CiclosEntrega.selecionar(this.proc, this.entrega).materiais.filter((b) => !b.provisorio);
  },

  opcoesFiltros(base) {
    const unicos = (fn) => [...new Set(base.map(fn).filter(Boolean))];
    const presentes = unicos((b) => Materiais.semAcento(b.colecao));
    return {
      colecao: CiclosEntrega.COLECOES_PROJETO.map((c) => c.chave).filter((c) => presentes.includes(c)),
      ano: unicos((b) => b.ano).sort((a, b) => Number(Materiais.canonAno(a)) - Number(Materiais.canonAno(b))),
      tipo: unicos((b) => b.tipoMaterial).sort(),
      entrega: unicos((b) => this.valorDoGrupo("entrega", b)).sort(),
      modulo: unicos((b) => this.moduloCurto(b.modulo)).sort((a, b) => this.ordemModulo(a) - this.ordemModulo(b) || a.localeCompare(b)),
      situacao: Object.values(SITUACAO_BOOK)
    };
  },

  rotuloOpcao(grupo, valor) {
    if (grupo === "situacao") return SITUACAO_ROTULO[valor];
    if (grupo === "ano") return `${valor} ano`;
    if (grupo === "entrega") return CiclosEntrega.nomeCiclo(valor);
    return valor;
  },

  ordemModulo(modulo) {
    const ordem = ["M1", "M2", "M3", "M4", "M1/M2", "M3/M4", "ANUAL"];
    const i = ordem.indexOf(modulo);
    return i < 0 ? ordem.length : i;
  },

  validarFiltros(filtros) {
    const opcoes = this.opcoesFiltros(this.baseFiltros(this.escopoDe(filtros)));
    Object.keys(filtros).forEach((id) => {
      filtros[id] = filtros[id].filter((v) => opcoes[id].includes(v));
    });
    return filtros;
  },

  contarFacetas(base, filtros) {
    const contagem = {};
    Object.keys(filtros).forEach((id) => {
      contagem[id] = {};
      base.filter((b) => this.atendeFiltros(b, filtros, id)).forEach((b) => {
        const v = this.valorDoGrupo(id, b);
        contagem[id][v] = (contagem[id][v] || 0) + 1;
      });
    });
    return contagem;
  },

  totalSelecionado(filtros) {
    return Object.values(filtros).reduce((t, v) => t + v.length, 0);
  },

  mesmosFiltros(a, b) {
    return Object.keys(a).every((id) => b[id] && a[id].length === b[id].length && a[id].every((v) => b[id].includes(v)));
  },

  configurarPainelFiltros() {
    this.filtros = this.filtrosVazios();
    this.filtrosEdicao = this.filtrosVazios();
    this.areaFiltros = Utils.qs("#filtrosTopo");
    this.botaoFiltros = Utils.qs("#btnFiltros");
    this.painelFiltros = Utils.qs("#painelFiltros");
    this.painelFiltrosCorpo = Utils.qs("#painelFiltrosCorpo");
    this.resumoFiltros = Utils.qs("#painelFiltrosResumo");
    this.botaoLimparFiltros = Utils.qs("#btnLimparFiltros");
    this.contagemFiltros = Utils.qs("#filtrosContagem");

    this.botaoFiltros.addEventListener("click", () => this.abrirPainelFiltros());

    this.painelFiltrosCorpo.addEventListener("change", (evento) => {
      const caixa = evento.target.closest("input[data-grupo]");
      if (!caixa) return;
      const lista = this.filtrosEdicao[caixa.dataset.grupo];
      const posicao = lista.indexOf(caixa.value);
      if (caixa.checked && posicao < 0) lista.push(caixa.value);
      if (!caixa.checked && posicao >= 0) lista.splice(posicao, 1);
      this.atualizarPreviaFiltros();
    });

    Utils.qs("#btnAplicarFiltros").addEventListener("click", () => this.aplicarFiltrosEdicao());
    this.botaoLimparFiltros.addEventListener("click", () => {
      this.filtrosEdicao = this.filtrosVazios(this.escopo);
      Utils.qsa("input[data-grupo]", this.painelFiltrosCorpo).forEach((c) => { c.checked = false; });
      this.atualizarPreviaFiltros();
      const primeiro = Utils.qs("input[data-grupo]", this.painelFiltrosCorpo);
      if (primeiro) primeiro.focus();
    });
    Utils.qsa("[data-fechar-filtros]", this.painelFiltros).forEach((b) => b.addEventListener("click", () => this.fecharPainelFiltros()));

    this.painelFiltros.addEventListener("click", (evento) => {
      if (evento.target === this.painelFiltros) this.fecharPainelFiltros();
    });
    this.painelFiltros.addEventListener("keydown", (evento) => {
      if (evento.key !== "Tab") return;
      const focaveis = Utils.qsa("button:not(:disabled), input:not(:disabled)", this.painelFiltros)
        .filter((el) => el.getClientRects().length > 0);
      if (!focaveis.length) return;
      const primeiro = focaveis[0];
      const ultimo = focaveis[focaveis.length - 1];
      if (evento.shiftKey && document.activeElement === primeiro) {
        evento.preventDefault();
        ultimo.focus();
      } else if (!evento.shiftKey && document.activeElement === ultimo) {
        evento.preventDefault();
        primeiro.focus();
      }
    });
    this.painelFiltros.addEventListener("close", () => {
      this.botaoFiltros.setAttribute("aria-expanded", "false");
      this.devolverFoco(this.botaoFiltros);
    });
  },

  abrirPainelFiltros() {
    if (this.painelFiltros.open) return;
    this.filtrosEdicao = this.copiarFiltros(this.validarFiltros(this.filtrosAtivos()));
    this.renderizarPainelFiltros();
    this.abrirDialogo(this.painelFiltros);
    this.botaoFiltros.setAttribute("aria-expanded", "true");
    const primeiro = Utils.qs("input[data-grupo]", this.painelFiltrosCorpo) || Utils.qs("[data-fechar-filtros]", this.painelFiltros);
    if (primeiro) primeiro.focus();
  },

  fecharPainelFiltros() {
    if (!this.painelFiltros || !this.painelFiltros.open) return;
    this.filtrosEdicao = this.copiarFiltros(this.filtrosAtivos());
    this.fecharDialogo(this.painelFiltros);
  },

  aplicarFiltrosEdicao() {
    if (this.escopo === "visao") {
      this.filtrosVisao = this.validarFiltros(this.copiarFiltros(this.filtrosEdicao));
      Filtros.definir("visao", this.copiarFiltros(this.filtrosVisao));
      this.atualizarIndicadorFiltros();
      App.renderizarVisao();
      this.fecharPainelFiltros();
      return;
    }
    this.filtros = this.validarFiltros(this.copiarFiltros(this.filtrosEdicao));
    Filtros.definir("entregas", this.copiarFiltros(this.filtros));
    this.atualizarIndicadorFiltros();
    this.renderizarResultado();
    this.fecharPainelFiltros();
  },

  aplicarFiltrosGlobais(foco) {
    this.filtros = this.validarFiltros(this.filtros);
    this.filtrosEdicao = this.copiarFiltros(this.filtros);
    Filtros.definir("entregas", this.copiarFiltros(this.filtros));
    this.atualizarIndicadorFiltros();
    this.renderizarResultado();
    const alvo = (foco && Utils.qs(foco, this.conteudo)) || Utils.qs("[data-filtro-colecao]", this.conteudo);
    if (alvo) alvo.focus();
  },

  alternarColecaoGrafico(chave) {
    const atual = this.filtros.colecao;
    const exclusiva = atual.length === 1 && atual[0] === chave;
    this.filtros = { ...this.copiarFiltros(this.filtros), colecao: exclusiva ? [] : [chave] };
    this.aplicarFiltrosGlobais(`[data-filtro-colecao="${chave}"]`);
  },

  removerColecaoGrafico(chave) {
    this.filtros = { ...this.copiarFiltros(this.filtros), colecao: this.filtros.colecao.filter((c) => c !== chave) };
    this.aplicarFiltrosGlobais(this.filtros.colecao.length ? "[data-remover-colecao]" : null);
  },

  definirEscopo(secao) {
    if (!this.areaFiltros) return;
    CentralPendencias.fechar();
    const escopo = secao === "visao-geral" ? "visao" : "entregas";
    if (escopo !== this.escopo || (secao !== "entregas" && secao !== "visao-geral")) this.fecharPainelFiltros();
    this.escopo = escopo;
    this.filtrosEdicao = this.copiarFiltros(this.filtrosAtivos());
    this.areaFiltros.hidden = secao !== "entregas" && secao !== "visao-geral";
    CentralPendencias.exibirBotao(!this.areaFiltros.hidden);
    this.atualizarIndicadorFiltros();
  },

  procVisao(proc) {
    if (!proc) return proc;
    const anterior = this.proc;
    this.proc = proc;
    const f = this.validarFiltros(this.filtrosVisao);
    this.proc = anterior;
    if (!this.totalSelecionado(f)) return proc;
    const chave = JSON.stringify(f);
    if (this.cacheVisao && this.cacheVisao.proc === proc && this.cacheVisao.chave === chave) return this.cacheVisao.resultado;
    const books = proc.books.filter((b) => this.atendeFiltros(b, f));
    const ids = new Set(books.map((b) => b.id));
    const bruto = (r) =>
      (!f.colecao.length || f.colecao.includes(Materiais.semAcento(r.colecao))) &&
      (!f.ano.length || f.ano.includes(r.ano)) &&
      (!f.tipo.length || f.tipo.includes(this.tipoBruto(r))) &&
      (!f.modulo.length || f.modulo.includes(this.moduloCurto(r.modulo))) &&
      (!f.entrega.length || f.entrega.includes(String(CiclosEntrega.classificarModulo(r.colecao, r.modulo).entrega || "")));
    const checklists = proc.checklists.filter((c) => (c.materialId ? ids.has(c.materialId) : bruto(c)));
    const idsChecklist = new Set(checklists.map((c) => c.id));
    const resultado = {
      ...proc,
      books,
      materiais: books,
      registros: proc.registros.filter((r) => idsChecklist.has(r.id)),
      checklists,
      naoClassificados: proc.naoClassificados.filter(bruto),
      indicadores: { checklist: IndicadoresCalculo.checklist(checklists), books: IndicadoresCalculo.books(books) }
    };
    this.cacheVisao = { proc, chave, resultado };
    return resultado;
  },

  renderizarPainelFiltros() {
    if (!this.painelFiltrosCorpo) return;
    Utils.qs("#painelFiltrosEscopo").textContent = this.escopo === "visao" ? "Visão Geral" : CiclosEntrega.nomeCiclo(this.entrega);
    if (!this.proc) {
      this.painelFiltrosCorpo.innerHTML = '<p class="gaveta-filtros__vazio">Os filtros ficam disponíveis após o carregamento dos dados.</p>';
      this.resumoFiltros.textContent = "";
      this.botaoLimparFiltros.disabled = true;
      return;
    }
    const opcoes = this.opcoesFiltros(this.baseFiltros(this.escopo));
    this.painelFiltrosCorpo.innerHTML = this.gruposPainel().map(({ id, titulo }) => `
      <fieldset class="gaveta-filtros__grupo">
        <legend class="gaveta-filtros__legenda">${this.e(titulo)}</legend>
        <div class="gaveta-filtros__opcoes">
          ${opcoes[id].length ? opcoes[id].map((valor) => `
            <label class="opcao-filtro">
              <input type="checkbox" data-grupo="${id}" value="${this.e(valor)}"${this.filtrosEdicao[id].includes(valor) ? " checked" : ""}>
              <span class="opcao-filtro__rotulo">${this.e(this.rotuloOpcao(id, valor))}</span>
              <span class="opcao-filtro__contagem" data-contagem="${id}|${this.e(valor)}">0</span>
            </label>`).join("") : `<p class="gaveta-filtros__vazio">${this.escopo === "visao" ? "Sem opções disponíveis." : "Sem opções neste entregável."}</p>`}
        </div>
      </fieldset>`).join("");
    this.atualizarPreviaFiltros();
  },

  atualizarPreviaFiltros() {
    if (!this.proc || !this.painelFiltrosCorpo) return;
    const base = this.baseFiltros(this.escopo);
    const contagem = this.contarFacetas(base, this.filtrosEdicao);
    Utils.qsa("[data-contagem]", this.painelFiltrosCorpo).forEach((el) => {
      const [grupo, valor] = el.dataset.contagem.split("|");
      const n = contagem[grupo][valor] || 0;
      el.textContent = this.n(n);
      el.closest(".opcao-filtro").classList.toggle("is-zerada", n === 0);
    });
    const previa = base.filter((b) => this.atendeFiltros(b, this.filtrosEdicao)).length;
    const pendente = !this.mesmosFiltros(this.filtrosEdicao, this.filtrosAtivos());
    this.resumoFiltros.innerHTML = `<strong>${this.n(previa)}</strong> de ${this.n(base.length)} materiais com os filtros ${pendente ? "selecionados" : "aplicados"}${pendente ? '<span class="gaveta-filtros__pendente">Prévia · clique em Aplicar filtros</span>' : ""}`;
    this.botaoLimparFiltros.disabled = this.totalSelecionado(this.filtrosEdicao) === 0;
  },

  atualizarIndicadorFiltros() {
    if (!this.botaoFiltros) return;
    const ativos = this.totalSelecionado(this.filtrosAtivos());
    this.contagemFiltros.textContent = ativos ? String(ativos) : "";
    this.contagemFiltros.hidden = !ativos;
    this.botaoFiltros.classList.toggle("is-ativo", ativos > 0);
    this.botaoFiltros.setAttribute("aria-label", ativos ? `Filtros, ${ativos} ${ativos === 1 ? "critério ativo" : "critérios ativos"}` : "Filtros");
  },

  aplicarFiltros(lista) {
    return lista.filter((b) => this.atendeFiltros(b, this.filtros));
  },

  colecoesVisiveis() {
    const disponiveis = this.opcoesFiltros(this.baseFiltros()).colecao;
    const selecionadas = this.filtros.colecao;
    return selecionadas.length ? disponiveis.filter((c) => selecionadas.includes(c)) : disponiveis;
  },

  tipoBruto(registro) {
    const m = Materiais.canonModulo(registro.modulo).match(/^(BOOK|MANUAL|CMA)-/);
    return m ? m[1] : "BOOK";
  },

  aplicarFiltrosBrutos(lista) {
    const f = this.filtros;
    if (f.situacao.length) return [];
    return lista.filter((r) =>
      (!f.colecao.length || f.colecao.includes(Materiais.semAcento(r.colecao))) &&
      (!f.ano.length || f.ano.includes(r.ano)) &&
      (!f.tipo.length || f.tipo.includes(this.tipoBruto(r)))
    );
  },

  renderizarAviso() {
    const prov = this.proc.books.filter((b) => b.provisorio).length;
    const nc = this.proc.naoClassificados.length;
    if (!prov && !nc) return "";
    return `
      <div class="aviso" role="note">
        ${ICONES.alerta}
        <p><strong>Totais não definitivos.</strong> O agrupamento de materiais ainda depende de validação:
        ${this.n(prov)} agrupamentos provisórios e ${this.n(nc)} registros sem agrupamento em toda a base.</p>
      </div>`;
  },

  renderizarKpis(ind, pendentes) {
    const c = ind.confirmados;
    const p = ind.provisorios;
    const extra = (valor) => (valor ? ` · +${this.n(valor)} em provisórios` : "");
    const taxa = CiclosEntrega.taxaEntrega(c.enviadosGrafica, c.total);
    const cards = [
      { imagem: "assets/entregas.png", analise: "programadas", titulo: "Entregas Programadas", valor: this.n(c.total),
        complemento: c.total === 1 ? "material programado" : "materiais programados",
        apoio: pendentes ? `${this.n(pendentes)} com entrega pendente` : "",
        dica: "Materiais consolidados confirmados programados para este ciclo. Não representa disciplinas ou frentes. Agrupamentos provisórios não entram no valor principal." },
      { imagem: "assets/facform.jpg", imagemLargura: 945, imagemAltura: 455, variante: "marca", titulo: "Livros Enviados para impressão", valor: this.n(c.enviadosGrafica),
        complemento: "enviados à gráfica",
        apoio: `${this.n(c.enviadosGrafica)} de ${this.n(c.total)} materiais confirmados${extra(p.enviadosGrafica)}`, analise: "enviados" },
      { imagem: "assets/%25.png", titulo: "Taxa de entrega", valor: CiclosEntrega.formatarTaxa(taxa),
        complemento: "de envio à gráfica",
        apoio: taxa === null
          ? "Não existem entregas programadas neste entregável"
          : `${this.n(c.enviadosGrafica)} enviados de ${this.n(c.total)} programados`,
        dica: "Livros enviados ÷ Entregas Programadas × 100. Representa o envio à gráfica, não a conclusão integral: separatas e gabaritos continuam obrigatórios." }
    ];
    return `<div class="entregas-kpis">${cards.map((card) => this.cardPrincipal(card)).join("")}</div>`;
  },

  cardPrincipal({ imagem, imagemLargura = 512, imagemAltura = 512, variante = "", titulo, valor, complemento, apoio, dica, analise }) {
    const interativo = analise
      ? ` kpi--interativo" role="button" tabindex="0" aria-haspopup="dialog" data-analise="${this.e(analise)}" aria-label="${this.e(`${titulo}: ${valor}. ${apoio ? `${apoio}. ` : ""}Abrir análise`)}`
      : "";
    const marcador = analise
      ? '<span class="kpi__abrir" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M7 17 17 7"/><path d="M8 7h9v9"/></svg></span>'
      : "";
    return `
      <article class="kpi-principal${interativo}">
        <header class="kpi-principal__topo">
          <h3 class="kpi-principal__titulo">${this.e(titulo)}</h3>
          ${dica ? Dashboard.dica(dica) : ""}
          ${marcador}
        </header>
        <div class="kpi-principal__corpo">
          <span class="kpi-principal__icone${variante ? ` kpi-principal__icone--${variante}` : ""}"><img src="${imagem}" alt="" width="${imagemLargura}" height="${imagemAltura}" decoding="async"></span>
          <div class="kpi-principal__dados">
            <p class="kpi-principal__valor">${this.e(valor)}</p>
            <span class="kpi-principal__complemento">${this.e(complemento)}</span>
          </div>
        </div>
        ${apoio ? `<footer class="kpi-principal__rodape">
          <span class="kpi-principal__ponto" aria-hidden="true"></span>
          <span>${this.e(apoio)}</span>
        </footer>` : ""}
      </article>`;
  },

  ICONES_LINHA: Object.freeze({
    total: '<img class="etapa-card__imagem" src="assets/total.png" alt="" width="20" height="20" decoding="async">',
    pendente: '<img class="etapa-card__imagem" src="assets/pendentes.png" alt="" width="20" height="20" decoding="async">',
    andamento: '<img class="etapa-card__imagem" src="assets/em%20processo.png" alt="" width="20" height="20" decoding="async">',
    concluido: '<img class="etapa-card__imagem" src="assets/finalizadas.png" alt="" width="20" height="20" decoding="async">',
    solicitada: '<img class="etapa-card__imagem" src="assets/solicitado.png" alt="" width="20" height="20" decoding="async">',
    recebida: '<img class="etapa-card__imagem" src="assets/recebido.png" alt="" width="20" height="20" decoding="async">'
  }),

  cardEtapa(etapa) {
    const pct = CiclosEntrega.formatarTaxa(etapa.percentual);
    const largura = etapa.percentual === null ? 0 : Math.min(100, Math.max(0, etapa.percentual));
    const interativo = etapa.analise
      ? ` etapa-card--interativo" role="button" tabindex="0" aria-haspopup="dialog" data-analise="${etapa.analise}" aria-label="${this.e(etapa.linhas === "boneca" ? `${etapa.nome}: ${pct} recebidas. ${etapa.concluidos} recebidas e ${etapa.solicitadas} solicitadas de ${etapa.total} materiais. Abrir análise` : `${etapa.nome}: ${pct}. ${etapa.concluidos} concluídos de ${etapa.total}${etapa.pendentes === null || etapa.pendentes === undefined ? "" : `, ${etapa.pendentes} pendentes`}. Abrir análise`)}`
      : "";
    const marcador = etapa.analise
      ? '<span class="kpi__abrir" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M7 17 17 7"/><path d="M8 7h9v9"/></svg></span>'
      : "";
    const linha = (classe, icone, rotulo, valor, dica) => `
      <li class="etapa-card__linha etapa-card__linha--${classe}"${dica ? ` title="${this.e(dica)}"` : ""}>
        <span class="etapa-card__icone">${icone}</span>
        <span class="etapa-card__rotulo">${rotulo}</span>
        <strong class="etapa-card__valor">${valor === null ? "—" : this.n(valor)}</strong>
      </li>`;
    const pendentes = etapa.pendentes === undefined ? "" : linha("pendente", this.ICONES_LINHA.pendente, "Pendentes", etapa.pendentes, etapa.pendentesIndisponivel ? "Indisponível: a API não informou statusMaterial (coluna Y)" : "Atividades liberadas para execução e ainda não iniciadas");
    return `
      <article class="etapa-card${interativo}">
        <header class="etapa-card__topo">
          <div class="etapa-card__titulos">
            <h4 class="etapa-card__nome">${this.e(etapa.nome)}</h4>
            <span class="etapa-card__unidade">${etapa.unidade}</span>
          </div>
          <span class="etapa-card__pct">${pct}</span>
          ${marcador}
        </header>
        <div class="etapa-card__barra" role="progressbar" aria-label="Conclusão de ${this.e(etapa.nome)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(largura)}"><span style="width:${largura}%"></span></div>
        <ul class="etapa-card__linhas">
          ${linha("total", this.ICONES_LINHA.total, etapa.linhas === "boneca" ? "Total de materiais" : "Total", etapa.total)}
          ${pendentes}
          ${etapa.linhas === "boneca" ? linha("solicitadas", this.ICONES_LINHA.solicitada, "Solicitadas", etapa.solicitadas) : etapa.exibirAndamento === false ? "" : linha("andamento", this.ICONES_LINHA.andamento, "Em andamento", etapa.emAndamento)}
          ${linha("concluido", etapa.linhas === "boneca" ? this.ICONES_LINHA.recebida : this.ICONES_LINHA.concluido, etapa.linhas === "boneca" ? "Recebidas" : "Concluídos", etapa.concluidos)}
        </ul>
      </article>`;
  },

  renderizarProjetos(projetos, visiveis = null) {
    const itens = visiveis ? projetos.itens.filter((p) => visiveis.includes(p.chave)) : projetos.itens;
    const taxa = (t) => CiclosEntrega.formatarTaxa(t);
    const linhas = itens.map((p) => {
      const dica = [
        p.nome,
        `Total programado: ${this.n(p.programados)}`,
        `Enviados para impressão: ${this.n(p.enviados)}`,
        `Ainda não enviados: ${this.n(p.faltam)}`,
        `Taxa de envio: ${taxa(p.taxa)}`
      ].join("\n");
      const rotulo = `${p.nome}: ${this.n(p.enviados)} de ${this.n(p.programados)} livros enviados para impressão, ${this.n(p.faltam)} ainda não enviados, taxa de envio ${taxa(p.taxa)}`;
      const selecionada = this.filtros.colecao.includes(p.chave);
      const acao = selecionada && this.filtros.colecao.length === 1 ? "Filtro ativo; acione para remover" : "Acione para filtrar o painel por esta coleção";
      return `
        <button type="button" class="projetos__linha projetos__linha--botao${p.inconsistente ? " is-inconsistente" : ""}${selecionada ? " is-selecionado" : ""}" data-filtro-colecao="${this.e(p.chave)}" aria-pressed="${selecionada}" style="--cor-projeto: ${p.cor}" data-tooltip="${this.e(dica)}" aria-label="${this.e(`${rotulo}. ${acao}`)}">
          <span class="projetos__marca" style="--recorte-escala: ${p.recorte.escala}; --recorte-x: ${p.recorte.x}; --recorte-y: ${p.recorte.y}"><img src="${p.imagem}" alt="" width="${p.largura}" height="${p.altura}" decoding="async"></span>
          <span class="projetos__nome" aria-hidden="true">${this.e(p.nome)}${selecionada ? '<span class="projetos__selo">Filtrando</span>' : ""}</span>
          <span class="projetos__trilho" aria-hidden="true"><span class="projetos__barra" style="width: ${(p.proporcao * 100).toFixed(2)}%"></span></span>
          <span class="projetos__valor" aria-hidden="true"><strong>${this.n(p.enviados)} de ${this.n(p.programados)}</strong><span class="projetos__pct">(${taxa(p.taxa)})</span></span>
        </button>`;
    }).join("");
    const tabela = itens.map((p) => `<tr><th scope="row">${this.e(p.nome)}</th><td>${this.n(p.programados)}</td><td>${this.n(p.enviados)}</td><td>${this.n(p.faltam)}</td><td>${taxa(p.taxa)}</td></tr>`).join("");
    return `
      <section class="bloco projetos" aria-labelledby="projetosTitulo">
        <div class="bloco__cabecalho">
          <div>
            <h3 class="bloco__titulo" id="projetosTitulo">Entregas por Projetos</h3>
            <p class="bloco__subtitulo">Livros enviados para impressão em relação aos programados, por coleção · ${this.e(CiclosEntrega.nomeCiclo(this.entrega))}</p>
          </div>
          <span class="contador">${this.n(projetos.somaEnviados)} de ${this.n(projetos.somaProgramados)} · ${taxa(projetos.taxaGeral)}</span>
        </div>
        ${this.filtros.colecao.length ? `<div class="projetos__filtro" role="status"><span>Filtro ativo:</span>${this.filtros.colecao.map((c) => `<button type="button" class="projetos__chip" data-remover-colecao="${this.e(c)}" aria-label="${this.e(`Remover filtro da coleção ${c}`)}">${this.e(c)}<span aria-hidden="true">×</span></button>`).join("")}</div>` : ""}
        <div class="projetos__lista" role="group" aria-label="Filtrar o painel por coleção">${linhas}</div>
        <div class="projetos__legenda" aria-hidden="true">
          <span><i class="projetos__amostra projetos__amostra--enviado"></i>Enviados para impressão</span>
          <span><i class="projetos__amostra projetos__amostra--falta"></i>Ainda não enviados</span>
        </div>
        <div class="visualmente-oculto">
          <table>
            <caption>Livros programados e enviados para impressão por coleção</caption>
            <thead><tr><th scope="col">Coleção</th><th scope="col">Programados</th><th scope="col">Enviados</th><th scope="col">Faltam enviar</th><th scope="col">Taxa de envio</th></tr></thead>
            <tbody>${tabela}</tbody>
          </table>
        </div>
      </section>`;
  },

  renderizarEtapas(materiais) {
    const etapas = CiclosEntrega.resumoEtapas(materiais);
    return `
      <section class="etapas-resumo" aria-labelledby="etapasResumoTitulo">
        <h3 class="etapas-resumo__titulo" id="etapasResumoTitulo">Resumo por etapa do processo</h3>
        <div class="etapas-resumo__grade">${etapas.map((e) => this.cardEtapa(e)).join("")}</div>
      </section>`;
  },

  renderizarQualidade(ind, sel) {
    const itens = [
      { rotulo: "Materiais confirmados", valor: ind.confirmados.total, classe: "ok" },
      { rotulo: "Agrupamentos provisórios", valor: ind.provisorios.total, classe: "alerta" },
      { rotulo: "Entrega não classificada", valor: sel.pendentes.length, classe: "neutro" },
      { rotulo: "Inconsistências de etapa", valor: ind.confirmados.inconsistenciasEtapa + ind.provisorios.inconsistenciasEtapa, classe: "erro" },
      { rotulo: "Registros sem agrupamento", valor: sel.naoAgrupados.length, classe: "neutro" }
    ];
    if (sel.materiaisSemColecao) {
      itens.push({ rotulo: "Materiais sem coleção reconhecida", valor: sel.materiaisSemColecao, classe: "erro" });
    }
    return `
      <section class="bloco qualidade" aria-labelledby="qualidadeTitulo">
        <div class="bloco__cabecalho">
          <div>
            <h3 class="bloco__titulo" id="qualidadeTitulo">Qualidade dos dados</h3>
            <p class="bloco__subtitulo">Somente os materiais confirmados compõem os indicadores principais.</p>
          </div>
        </div>
        <ul class="qualidade__lista">
          ${itens.map((i) => `
            <li class="qualidade__item qualidade__item--${i.classe}">
              <span class="qualidade__valor">${this.n(i.valor)}</span>
              <span class="qualidade__rotulo">${i.rotulo}</span>
            </li>`).join("")}
        </ul>
      </section>`;
  },

  pontoStatus(status) {
    const rotulo = STATUS_ROTULO[status];
    return `<span class="status-ponto status-ponto--${status}" role="img" aria-label="${this.e(rotulo)}" title="${this.e(rotulo)}"></span>`;
  },

  marcaColecao(nome) {
    const c = CiclosEntrega.COLECOES_PROJETO.find((x) => x.chave === Materiais.semAcento(nome));
    if (!c) return `<span class="tabela-colecao is-sem-imagem"><span class="tabela-colecao__texto">${this.e(nome)}</span></span>`;
    return `<span class="tabela-colecao" title="${this.e(c.nome)}"><span class="projetos__marca tabela-colecao__marca" style="--recorte-escala: ${c.recorte.escala}; --recorte-x: ${c.recorte.x}; --recorte-y: ${c.recorte.y}"><img src="${c.imagem}" alt="${this.e(`Coleção ${c.nome}`)}" width="${c.largura}" height="${c.altura}" decoding="async"></span><span class="tabela-colecao__texto">${this.e(c.nome)}</span></span>`;
  },

  progressoGeral(b) {
    const total = ETAPAS_BOOK.length + 1;
    const concluidas = (CiclosEntrega.statusChecklist(b.checklist) === STATUS.CONCLUIDO ? 1 : 0) + ETAPAS_BOOK.filter((e) => b.etapas[e.id].status === STATUS.CONCLUIDO).length;
    return { concluidas, total, percentual: (concluidas / total) * 100 };
  },

  celulaProgressoGeral(b) {
    const p = this.progressoGeral(b);
    const texto = CiclosEntrega.formatarTaxa(p.percentual);
    const dica = `${this.n(p.concluidas)} de ${this.n(p.total)} etapas concluídas`;
    return `<div class="progresso-geral" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${p.percentual.toFixed(1)}" aria-valuetext="${this.e(`${texto} · ${dica}`)}" title="${this.e(dica)}"><span class="progresso-geral__trilho" aria-hidden="true"><span style="width:${p.percentual.toFixed(2)}%"></span></span><span class="progresso-geral__valor" aria-hidden="true">${texto}</span></div>`;
  },

  legendaStatus() {
    return `<ul class="legenda-status" aria-label="Legenda dos indicadores de etapa">${[STATUS.NAO_INICIADO, STATUS.EM_ANDAMENTO, STATUS.CONCLUIDO, STATUS.INCONSISTENTE].map((s) => `<li><span class="status-ponto status-ponto--${s}" aria-hidden="true"></span>${this.e(STATUS_ROTULO[s])}</li>`).join("")}</ul>`;
  },

  linhaMaterial(b) {
    const etapas = ETAPAS_BOOK.map((e) => `<td class="tabela__etapa">${this.pontoStatus(b.etapas[e.id].status)}</td>`).join("");
    const ck = b.checklist;
    return `
      <tr>
        <td class="tabela__colecao" data-colecao="${this.e(b.colecao)}">${this.marcaColecao(b.colecao)}</td>
        <td>${this.e(b.ano)}</td>
        <td class="tabela__material">
          <button type="button" class="link-material" data-material="${this.e(b.id)}">${this.e(b.nome)}</button>
          ${b.provisorio ? '<span class="tag tag--alerta">Provisório</span>' : ""}
        </td>
        <td class="tabela__etapa">${this.pontoStatus(CiclosEntrega.statusChecklist(ck))}<small class="tabela__sub">${this.n(ck.concluido)}/${this.n(ck.total)} frentes</small></td>
        ${etapas}
        <td class="tabela__progresso">${this.celulaProgressoGeral(b)}</td>
      </tr>`;
  },

  tabela(lista, rotulo) {
    const cabecalho = ["Coleção", "Ano", "Material", "Checklist", ...ETAPAS_BOOK.map((e) => this.nomeCurto(e.id)), "Progresso geral"];
    const corpo = lista.length
      ? this.ordenarAcompanhamento(lista).map((b) => this.linhaMaterial(b)).join("")
      : `<tr><td colspan="${cabecalho.length}" class="tabela__vazia">Nenhum material encontrado para os filtros selecionados.</td></tr>`;
    return `
      ${this.legendaStatus()}
      <div class="tabela__rolagem" tabindex="0" role="region" aria-label="${this.e(rotulo)}">
        <table class="tabela tabela--entregas">
          <colgroup><col class="col-colecao"><col class="col-ano"><col class="col-material"><col class="col-etapa" span="${cabecalho.length - 4}"><col class="col-progresso"></colgroup>
          <thead><tr>${cabecalho.map((c) => `<th scope="col">${c}</th>`).join("")}</tr></thead>
          <tbody>${corpo}</tbody>
        </table>
      </div>`;
  },

  nomeCurto(id) {
    return {
      montagem: "Montagem", bonecaSolicitada: "Boneca solicitada", bonecaRecebida: "Boneca recebida",
      qrCodes: "QR Codes", ajustes: "Ajustes finais", grafica: "Enviado para impressão",
      separatas: "Separatas V4", gabaritos: "Gabaritos enviados"
    }[id];
  },

  renderizarNaoAgrupados(lista) {
    if (!lista.length) return "";
    const linhas = lista.map((r) => `
      <tr>
        <td class="num">${this.e(r.linhaBase)}</td>
        <td>${this.e(r.colecao)}</td>
        <td>${this.e(r.ano)}</td>
        <td>${this.e(r.modulo)}</td>
        <td>${this.e(r.frente)}</td>
        <td>${this.e(r.motivo)}</td>
      </tr>`).join("");
    return `
      <details class="bloco recolhivel">
        <summary>
          <span class="bloco__titulo">Registros sem agrupamento</span>
          <span class="contador contador--neutro">${this.n(lista.length)}</span>
        </summary>
        <p class="bloco__subtitulo">Frentes deste ciclo que ainda não pertencem a um material confirmado. Não são contabilizadas como materiais.</p>
        <div class="tabela__rolagem" tabindex="0" role="region" aria-label="Registros sem agrupamento">
          <table class="tabela">
            <thead><tr><th scope="col" class="num">Linha</th><th scope="col">Coleção</th><th scope="col">Ano</th><th scope="col">Módulo</th><th scope="col">Frente</th><th scope="col">Motivo</th></tr></thead>
            <tbody>${linhas}</tbody>
          </table>
        </div>
      </details>`;
  },

  renderizarResultado() {
    const alvo = Utils.qs("#entregasResultado");
    if (!alvo || !this.proc) return;
    const sel = CiclosEntrega.selecionar(this.proc, this.entrega);
    const materiais = this.aplicarFiltros(sel.materiais);
    const pendentes = this.aplicarFiltros(sel.pendentes);
    const naoAgrupados = this.aplicarFiltrosBrutos(sel.naoAgrupados);
    const ind = CiclosEntrega.indicadores(materiais);
    const projetos = CiclosEntrega.enviosPorColecao(materiais);
    this.conjuntoAtual = materiais;
    if (this.listaDialogo && this.listaDialogo.open && this.indicadorAtivo) this.renderizarIndicador();
    Analises.atualizar();

    const blocoPendentes = sel.pendentes.length ? `
      <section class="bloco pendentes" aria-labelledby="pendentesTitulo">
        <div class="bloco__cabecalho">
          <div>
            <h3 class="bloco__titulo" id="pendentesTitulo">Classificação de entrega pendente</h3>
            <p class="bloco__subtitulo">Materiais sem vínculo confirmado com uma entrega específica. Não entram nos totais desta entrega.</p>
          </div>
          <span class="contador contador--neutro">${this.n(pendentes.length)}</span>
        </div>
        ${this.tabela(pendentes, "Materiais com classificação de entrega pendente")}
      </section>` : "";

    alvo.innerHTML = `
      ${this.renderizarKpis(ind, pendentes.length)}
      ${this.renderizarProjetos(projetos, this.colecoesVisiveis())}
      ${this.renderizarEtapas(materiais)}
      <section class="bloco" aria-labelledby="acompanhamentoTitulo">
        <div class="bloco__cabecalho">
          <div>
            <h3 class="bloco__titulo" id="acompanhamentoTitulo">Acompanhamento dos materiais</h3>
            <p class="bloco__subtitulo">Selecione um material para consultar disciplinas, responsáveis e datas. Consulta somente leitura.</p>
          </div>
          <span class="contador">${this.n(materiais.length)}</span>
        </div>
        ${this.tabela(materiais, `Materiais do ${CiclosEntrega.nomeCiclo(this.entrega)}`)}
      </section>
      ${blocoPendentes}
      ${this.renderizarNaoAgrupados(naoAgrupados)}`;
  },

  renderizar() {
    if (!this.conteudo) return;
    if (this.secao.classList.contains("is-active")) {
      this.titulo.textContent = CiclosEntrega.tituloCabecalho(this.entrega);
    }
    if (!this.proc) {
      const mensagem = this.estado.erro
        ? "Não foi possível carregar os dados. Utilize o botão Atualizar para tentar novamente."
        : "Carregando dados da BD-DADOS-ARTE.";
      this.conteudo.innerHTML = `<div class="state-card"><p>${this.e(mensagem)}</p></div>`;
      this.atualizarIndicadorFiltros();
      if (this.painelFiltros && this.painelFiltros.open) this.renderizarPainelFiltros();
      return;
    }
    this.validarFiltros(this.filtros);
    this.atualizarIndicadorFiltros();
    if (this.painelFiltros && this.painelFiltros.open) {
      this.validarFiltros(this.filtrosEdicao);
      this.renderizarPainelFiltros();
    }
    this.conteudo.innerHTML = `
      <div class="entregas-resultado" id="entregasResultado" aria-live="polite"></div>`;
    this.renderizarResultado();
  },

  valoresUnicos(registros, campo) {
    if (!campo) return [];
    return [...new Set(registros.map((r) => r.campos[campo]).filter((v) => Processamento.preenchido(v)))];
  },

  formatarValores(valores) {
    if (!valores.length) return '<span class="vazio">—</span>';
    if (valores.length === 1) return this.e(valores[0]);
    return `<span class="divergente">Divergente: ${valores.map((v) => this.e(v)).join("; ")}</span>`;
  },

  linhasFrentes(b, regs) {
    const statusPorRegistro = new Map(this.proc.checklists.map((c) => [c.id, c.status]));
    const anual = b.modulo === "ANUAL";
    const ordemDisciplina = new Map();
    regs.forEach((r) => {
      const disciplina = Materiais.analisarFrente(r.campos.frente).disciplina;
      if (!ordemDisciplina.has(disciplina)) ordemDisciplina.set(disciplina, ordemDisciplina.size);
    });
    const frentes = regs.map((r) => ({ r, f: Materiais.analisarFrente(r.campos.frente) }))
      .sort(anual
        ? (a, c) => ordemDisciplina.get(a.f.disciplina) - ordemDisciplina.get(c.f.disciplina) || (a.f.modulo || "M9").localeCompare(c.f.modulo || "M9") || a.r.linhaBase - c.r.linhaBase
        : (a, c) => (a.f.modulo || "M9").localeCompare(c.f.modulo || "M9") || a.f.rotulo.localeCompare(c.f.rotulo, "pt-BR") || a.r.linhaBase - c.r.linhaBase);
    const nomeDisciplina = (f) => (anual && Materiais.semAcento(f.rotulo) !== f.disciplina && Materiais.ROTULOS[f.disciplina] ? Materiais.ROTULOS[f.disciplina].toUpperCase() : f.rotulo);
    const contagemChecklist = { total: frentes.length, concluido: 0, nao_iniciado: 0, em_andamento: 0, inconsistente: 0 };
    frentes.forEach(({ r }) => { contagemChecklist[statusPorRegistro.get(r.id) || STATUS.NAO_INICIADO] += 1; });
    const statusMaterial = frentes.length
      ? this.chip(CiclosEntrega.statusChecklist(contagemChecklist))
      : '<span class="chip chip--sem-dados">Sem dados</span>';
    const vazio = '<span class="vazio">—</span>';
    const valor = (r, campo) => (Processamento.preenchido(r.campos[campo]) ? this.e(r.campos[campo]) : vazio);
    const linhasChecklist = frentes.map(({ r, f }) => {
      const status = statusPorRegistro.get(r.id) || STATUS.NAO_INICIADO;
      const nome = f.modulo
        ? `${this.e(nomeDisciplina(f))} — ${this.e(f.modulo)}`
        : `${this.e(f.original)}${anual ? ' <span class="tag tag--alerta">Módulo não identificado</span>' : ""}`;
      return `<tr data-linha-base="${this.e(r.linhaBase)}" data-registro="${this.e(r.id)}"><th scope="row">${nome}</th><td>${valor(r, "responsavel")}</td><td>${valor(r, "inicioProducao")}</td><td>${valor(r, "fimProducao")}</td><td>${this.chip(status)}</td></tr>`;
    }).join("");
    return { linhasChecklist, statusMaterial, total: frentes.length };
  },

  abrirDetalhe(id, origem) {
    const b = this.proc && this.proc.books.find((x) => x.id === id);
    if (!b) return;
    this.origemFoco = origem;
    const regs = (this.registrosPorMaterial.get(id) || []).slice().sort((a, c) => a.linhaBase - c.linhaBase);
    const { linhasChecklist, statusMaterial } = this.linhasFrentes(b, regs);

    const pendencias = b.pendencias.length
      ? `<ul class="detalhe__pendencias">${b.pendencias.map((p) => `<li class="${p.provisorio ? "is-provisorio" : ""}">${this.e(p.descricao)}</li>`).join("")}</ul>`
      : '<p class="detalhe__vazio">Nenhuma pendência registrada.</p>';

    const campo = (rotulo, valor) => `<div><dt>${rotulo}</dt><dd>${valor}</dd></div>`;

    this.dialogo.classList.add("detalhe--material");
    this.detalhe.innerHTML = `
      <header class="detalhe__cabecalho">
        <div>
          <span class="detalhe__eyebrow">${this.e(b.tipoMaterial)} · ${this.e(b.categoria)}</span>
          <h2 class="detalhe__titulo" id="detalheTitulo">${this.e(b.nome)}</h2>
          <code class="detalhe__id">${this.e(b.id)}</code>
        </div>
        <button type="button" class="detalhe__fechar" data-fechar aria-label="Fechar detalhes">${ICONES_ENTREGA.fechar}</button>
      </header>
      <div class="detalhe__corpo">
        ${b.provisorio ? `<div class="aviso">${ICONES.alerta}<p><strong>Agrupamento provisório.</strong> Os dados deste material dependem de validação.</p></div>` : ""}
        <dl class="detalhe__campos">
          ${campo("Coleção", this.e(b.colecao))}
          ${campo("Ano escolar", this.e(b.ano))}
          ${campo("Módulo", this.e(b.modulo))}
          ${campo("Tipo", this.e(b.tipoMaterial))}
          ${campo("Status do checklist", statusMaterial)}
        </dl>
        <section class="detalhe-checklist" aria-labelledby="detalheChecklistTitulo">
          <h3 class="detalhe-checklist__titulo" id="detalheChecklistTitulo"><span class="detalhe-checklist__icone" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4.5V3h6v1.5"/><path d="m9 12 2 2 4-4"/><path d="M9 17h6"/></svg></span>Checklist de qualidade<span class="detalhe-checklist__contagem">${this.n(b.checklist.concluido)} de ${this.n(regs.length)} concluídas</span></h3>
          <div class="tabela__rolagem" tabindex="0" role="region" aria-label="Checklist de qualidade das frentes do material">
            <table class="tabela tabela--compacta detalhe-checklist__tabela">
              <thead><tr><th scope="col">Frente</th><th scope="col">Responsável</th><th scope="col">Início checklist</th><th scope="col">Fim checklist</th><th scope="col">Status</th></tr></thead>
              <tbody>${linhasChecklist}</tbody>
            </table>
          </div>
        </section>
        <h3 class="detalhe__secao">Pendências</h3>
        ${pendencias}
      </div>`;
    if (typeof this.dialogo.showModal === "function") {
      this.dialogo.showModal();
    } else {
      this.dialogo.setAttribute("open", "");
    }
    const fechar = Utils.qs("[data-fechar]", this.dialogo);
    if (fechar) fechar.focus();
  },

  ICONES_STATUS: Object.freeze({
    concluido: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m8.5 12.5 2.5 2.5 4.5-5"/></svg>',
    em_andamento: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    nao_iniciado: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/></svg>',
    inconsistente: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7.5v5"/><path d="M12 16h.01"/></svg>'
  }),

  abrirAcompanhamento(id, origem) {
    const b = this.proc && this.proc.books.find((x) => x.id === id);
    if (!b) return;
    this.origemFoco = origem;
    const regs = (this.registrosPorMaterial.get(id) || []).slice().sort((a, c) => a.linhaBase - c.linhaBase);
    const { linhasChecklist, total } = this.linhasFrentes(b, regs);
    const p = this.progressoGeral(b);
    const pct = CiclosEntrega.formatarTaxa(p.percentual);
    const etapas = [
      { nome: ETAPA_CHECKLIST.nome, status: CiclosEntrega.statusChecklist(b.checklist) },
      ...ETAPAS_BOOK.map((e) => ({ nome: { bonecaSolicitada: "Boneca solicitada", bonecaRecebida: "Boneca recebida", grafica: "Enviado para impressão", separatas: "Separatas V4", gabaritos: "Gabaritos enviados" }[e.id] || e.nome, status: b.etapas[e.id].status }))
    ];
    const indicador = (rotulo, valor) => `<div class="acomp__indicador"><span class="acomp__indicador-rotulo">${rotulo}</span><strong class="acomp__indicador-valor">${valor}</strong></div>`;

    this.dialogo.classList.add("detalhe--material", "detalhe--acompanhamento");
    this.detalhe.innerHTML = `
      <header class="detalhe__cabecalho">
        <div>
          <span class="detalhe__eyebrow">Acompanhamento / ${this.e(b.colecao)} / ${this.e(b.ano)} ano</span>
          <h2 class="detalhe__titulo" id="detalheTitulo">${this.e(b.nome)}</h2>
          <p class="acomp__subtitulo">Detalhamento do material</p>
          <code class="detalhe__id">${this.e(b.id)}</code>
        </div>
        <button type="button" class="detalhe__fechar" data-fechar aria-label="Fechar acompanhamento do material">${ICONES_ENTREGA.fechar}</button>
      </header>
      <div class="detalhe__corpo">
        ${b.provisorio ? `<div class="aviso">${ICONES.alerta}<p><strong>Agrupamento provisório.</strong> Os dados deste material dependem de validação.</p></div>` : ""}
        <div class="acomp__indicadores">
          ${indicador("Progresso geral", pct)}
          ${indicador("Frentes no checklist", `${this.n(b.checklist.concluido)}/${this.n(total)}`)}
          ${indicador("Etapas concluídas", `${this.n(p.concluidas)}/${this.n(p.total)}`)}
        </div>
        <section class="acomp__progresso" aria-labelledby="acompProgressoTitulo">
          <div class="acomp__progresso-topo"><h3 id="acompProgressoTitulo">Progresso das etapas</h3><span>${pct}</span></div>
          <div class="acomp__barra" role="progressbar" aria-labelledby="acompProgressoTitulo" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${p.percentual.toFixed(1)}" aria-valuetext="${this.e(`${pct} · ${p.concluidas} de ${p.total} etapas concluídas`)}"><span style="width:${p.percentual.toFixed(2)}%"></span></div>
        </section>
        <section class="acomp__etapas" aria-labelledby="acompEtapasTitulo">
          <h3 class="acomp__secao" id="acompEtapasTitulo">Etapas de produção</h3>
          <ol class="acomp__lista">${etapas.map((x) => `<li class="acomp__etapa acomp__etapa--${x.status}"><span class="acomp__icone" aria-hidden="true">${this.ICONES_STATUS[x.status]}</span><span class="acomp__nome">${this.e(x.nome)}</span><span class="acomp__status">${this.e(STATUS_ROTULO[x.status])}</span></li>`).join("")}</ol>
        </section>
        <details class="acomp__frentes">
          <summary><span>Disciplinas e responsáveis</span><span class="acomp__contagem">${this.n(total)} ${total === 1 ? "frente" : "frentes"}</span></summary>
          <div class="tabela__rolagem" tabindex="0" role="region" aria-label="Disciplinas e responsáveis do material">
            <table class="tabela tabela--compacta detalhe-checklist__tabela">
              <thead><tr><th scope="col">Frente</th><th scope="col">Responsável</th><th scope="col">Início checklist</th><th scope="col">Fim checklist</th><th scope="col">Status</th></tr></thead>
              <tbody>${linhasChecklist}</tbody>
            </table>
          </div>
        </details>
      </div>`;
    if (typeof this.dialogo.showModal === "function") {
      if (!this.dialogo.open) this.dialogo.showModal();
    } else {
      this.dialogo.setAttribute("open", "");
    }
    const fechar = Utils.qs("[data-fechar]", this.dialogo);
    if (fechar) fechar.focus();
  },

  abrirDetalheMontagem(id, origem) {
    const b = this.proc && this.proc.books.find((x) => x.id === id);
    if (!b) return;
    this.origemFoco = origem;
    const regs = (this.registrosPorMaterial.get(id) || []).slice().sort((a, c) => a.linhaBase - c.linhaBase);
    const etapa = b.etapas.montagem;
    const u = (campo) => this.formatarValores(this.valoresUnicos(regs, campo));
    const divergentes = ["book", "inicioBook", "fimBook"].filter((campo) => this.valoresUnicos(regs, campo).length > 1 || (this.valoresUnicos(regs, campo).length === 1 && regs.some((r) => !Processamento.preenchido(r.campos[campo]))));
    const vazio = '<span class="vazio">—</span>';
    const valor = (r, campo) => (Processamento.preenchido(r.campos[campo]) ? this.e(r.campos[campo]) : vazio);
    const campo = (rotulo, conteudo) => `<div><dt>${rotulo}</dt><dd>${conteudo}</dd></div>`;
    const rastreio = divergentes.length || etapa.divergente ? `
          <div class="aviso" role="note">${ICONES.alerta}<p><strong>Registros divergentes entre as frentes deste material.</strong> Nenhum valor foi escolhido; os registros originais estão listados abaixo.</p></div>
          <div class="tabela__rolagem" tabindex="0" role="region" aria-label="Registros de montagem por frente">
            <table class="tabela tabela--compacta detalhe-checklist__tabela">
              <thead><tr><th scope="col">Frente</th><th scope="col">Linha</th><th scope="col">Responsável (I)</th><th scope="col">Início (J)</th><th scope="col">Fim (K)</th></tr></thead>
              <tbody>${regs.map((r) => `<tr data-linha-base="${this.e(r.linhaBase)}"><th scope="row">${this.e(r.campos.frente)}</th><td>${this.e(r.linhaBase)}</td><td>${valor(r, "book")}</td><td>${valor(r, "inicioBook")}</td><td>${valor(r, "fimBook")}</td></tr>`).join("")}</tbody>
            </table>
          </div>` : "";

    this.dialogo.classList.add("detalhe--material");
    this.detalhe.innerHTML = `
      <header class="detalhe__cabecalho">
        <div>
          <span class="detalhe__eyebrow">Montagem do BOOK · ${this.e(b.colecao)} · ${this.e(b.ano)} ano</span>
          <h2 class="detalhe__titulo" id="detalheTitulo">${this.e(b.nome)}</h2>
          <code class="detalhe__id">${this.e(b.id)}</code>
        </div>
        <button type="button" class="detalhe__fechar" data-fechar aria-label="Fechar detalhes da montagem">${ICONES_ENTREGA.fechar}</button>
      </header>
      <div class="detalhe__corpo">
        ${b.provisorio ? `<div class="aviso">${ICONES.alerta}<p><strong>Agrupamento provisório.</strong> Os dados deste material dependem de validação.</p></div>` : ""}
        <dl class="detalhe__campos detalhe__campos--quatro">
          ${campo("Coleção", this.e(b.colecao))}
          ${campo("Ano escolar", this.e(b.ano))}
          ${campo("Módulo", this.e(b.modulo))}
          ${campo("Tipo", this.e(b.tipoMaterial))}
        </dl>
        <section class="detalhe-checklist detalhe-montagem" aria-labelledby="detalheMontagemTitulo">
          <h3 class="detalhe-checklist__titulo" id="detalheMontagemTitulo"><span class="detalhe-checklist__icone" aria-hidden="true">${ICONES_ENTREGA.montagem}</span>Montagem do BOOK</h3>
          <dl class="detalhe__campos detalhe__campos--quatro">
            ${campo("Responsável", u("book"))}
            ${campo("Início da montagem", u("inicioBook"))}
            ${campo("Fim da montagem", u("fimBook"))}
            ${campo("Status", this.chip(etapa.status))}
          </dl>${rastreio}
        </section>
      </div>`;
    if (typeof this.dialogo.showModal === "function") {
      if (!this.dialogo.open) this.dialogo.showModal();
    } else {
      this.dialogo.setAttribute("open", "");
    }
    const fechar = Utils.qs("[data-fechar]", this.dialogo);
    if (fechar) fechar.focus();
  },

  abrirDetalheBoneca(id, origem) {
    const b = this.proc && this.proc.books.find((x) => x.id === id);
    if (!b) return;
    this.origemFoco = origem;
    const regs = (this.registrosPorMaterial.get(id) || []).slice().sort((a, c) => a.linhaBase - c.linhaBase);
    const situacao = Analises.situacaoBoneca(b);
    const u = (campo) => this.formatarValores(this.valoresUnicos(regs, campo));
    const campos = ["enviadoBoneca", "dataEnvioBoneca", "chegadaBoneca"];
    const divergentes = campos.filter((campo) => this.valoresUnicos(regs, campo).length > 1 || (this.valoresUnicos(regs, campo).length === 1 && regs.some((r) => !Processamento.preenchido(r.campos[campo]))));
    const semSolicitacao = b.etapas.bonecaRecebida.status === STATUS.CONCLUIDO && b.etapas.bonecaSolicitada.status !== STATUS.CONCLUIDO;
    const vazio = '<span class="vazio">—</span>';
    const valor = (r, campo) => (Processamento.preenchido(r.campos[campo]) ? this.e(r.campos[campo]) : vazio);
    const campo = (rotulo, conteudo) => `<div><dt>${rotulo}</dt><dd>${conteudo}</dd></div>`;
    const rastreio = divergentes.length || situacao === STATUS.INCONSISTENTE && !semSolicitacao ? `
          <div class="aviso" role="note">${ICONES.alerta}<p><strong>Registros divergentes entre as frentes deste material.</strong> Nenhum valor foi escolhido; os registros originais estão listados abaixo.</p></div>
          <div class="tabela__rolagem" tabindex="0" role="region" aria-label="Registros da boneca por frente">
            <table class="tabela tabela--compacta detalhe-checklist__tabela">
              <thead><tr><th scope="col">Frente</th><th scope="col">Linha</th><th scope="col">Responsável (L)</th><th scope="col">Solicitação (M)</th><th scope="col">Recebimento (N)</th></tr></thead>
              <tbody>${regs.map((r) => `<tr data-linha-base="${this.e(r.linhaBase)}"><th scope="row">${this.e(r.campos.frente)}</th><td>${this.e(r.linhaBase)}</td><td>${valor(r, "enviadoBoneca")}</td><td>${valor(r, "dataEnvioBoneca")}</td><td>${valor(r, "chegadaBoneca")}</td></tr>`).join("")}</tbody>
            </table>
          </div>` : "";

    this.dialogo.classList.add("detalhe--material");
    this.detalhe.innerHTML = `
      <header class="detalhe__cabecalho">
        <div>
          <span class="detalhe__eyebrow">Boneca · ${this.e(b.colecao)} · ${this.e(b.ano)} ano</span>
          <h2 class="detalhe__titulo" id="detalheTitulo">${this.e(b.nome)}</h2>
          <code class="detalhe__id">${this.e(b.id)}</code>
        </div>
        <button type="button" class="detalhe__fechar" data-fechar aria-label="Fechar detalhes da boneca">${ICONES_ENTREGA.fechar}</button>
      </header>
      <div class="detalhe__corpo">
        ${b.provisorio ? `<div class="aviso">${ICONES.alerta}<p><strong>Agrupamento provisório.</strong> Os dados deste material dependem de validação.</p></div>` : ""}
        <dl class="detalhe__campos detalhe__campos--quatro">
          ${campo("Coleção", this.e(b.colecao))}
          ${campo("Ano escolar", this.e(b.ano))}
          ${campo("Módulo", this.e(b.modulo))}
          ${campo("Tipo", this.e(b.tipoMaterial))}
        </dl>
        <section class="detalhe-checklist detalhe-boneca" aria-labelledby="detalheBonecaTitulo">
          <h3 class="detalhe-checklist__titulo" id="detalheBonecaTitulo"><span class="detalhe-checklist__icone" aria-hidden="true">${ICONES_ENTREGA.boneca}</span>Boneca</h3>
          <dl class="detalhe__campos detalhe__campos--quatro">
            ${campo("Responsável pela solicitação", u("enviadoBoneca"))}
            ${campo("Data da solicitação", u("dataEnvioBoneca"))}
            ${campo("Recebimento", u("chegadaBoneca"))}
            ${campo("Situação", `<span class="chip chip--${situacao}">${this.e(Analises.ROTULOS_BONECA[situacao])}</span>`)}
          </dl>${semSolicitacao ? `<div class="aviso" role="note">${ICONES.alerta}<p><strong>Recebimento sem solicitação confirmada.</strong> A coluna N está preenchida, mas a coluna M não tem solicitação válida.</p></div>` : ""}${rastreio}
        </section>
      </div>`;
    if (typeof this.dialogo.showModal === "function") {
      if (!this.dialogo.open) this.dialogo.showModal();
    } else {
      this.dialogo.setAttribute("open", "");
    }
    const fechar = Utils.qs("[data-fechar]", this.dialogo);
    if (fechar) fechar.focus();
  },

  abrirDetalheEtapa(id, etapaId, origem) {
    const b = this.proc && this.proc.books.find((x) => x.id === id);
    const cfg = Analises.ETAPAS_PADRAO[etapaId];
    if (!b || !cfg) return;
    this.origemFoco = origem;
    const regs = (this.registrosPorMaterial.get(id) || []).slice().sort((a, c) => a.linhaBase - c.linhaBase);
    const status = b.etapas[etapaId].status;
    const u = (campo) => this.formatarValores(this.valoresUnicos(regs, campo));
    const divergentes = cfg.campos.filter(([, campo]) => this.valoresUnicos(regs, campo).length > 1 || (this.valoresUnicos(regs, campo).length === 1 && regs.some((r) => !Processamento.preenchido(r.campos[campo]))));
    const vazio = '<span class="vazio">—</span>';
    const valor = (r, campo) => (Processamento.preenchido(r.campos[campo]) ? this.e(r.campos[campo]) : vazio);
    const campo = (rotulo, conteudo) => `<div><dt>${rotulo}</dt><dd>${conteudo}</dd></div>`;
    const rastreio = divergentes.length || status === STATUS.INCONSISTENTE ? `
          <div class="aviso" role="note">${ICONES.alerta}<p><strong>${divergentes.length ? "Registros divergentes entre as frentes deste material." : "Registro inconsistente nesta etapa."}</strong> Nenhum valor foi escolhido; os registros originais estão listados abaixo.</p></div>
          <div class="tabela__rolagem" tabindex="0" role="region" aria-label="${this.e(`Registros de ${cfg.titulo} por frente`)}">
            <table class="tabela tabela--compacta detalhe-checklist__tabela">
              <thead><tr><th scope="col">Frente</th><th scope="col">Linha</th>${cfg.campos.map(([rotulo]) => `<th scope="col">${this.e(rotulo)}</th>`).join("")}</tr></thead>
              <tbody>${regs.map((r) => `<tr data-linha-base="${this.e(r.linhaBase)}"><th scope="row">${this.e(r.campos.frente)}</th><td>${this.e(r.linhaBase)}</td>${cfg.campos.map(([, c]) => `<td>${valor(r, c)}</td>`).join("")}</tr>`).join("")}</tbody>
            </table>
          </div>` : "";
    const icone = ICONES_ENTREGA[etapaId === "grafica" ? "grafica" : "entregue"];

    this.dialogo.classList.add("detalhe--material");
    this.detalhe.innerHTML = `
      <header class="detalhe__cabecalho">
        <div>
          <span class="detalhe__eyebrow">${this.e(cfg.titulo)} · ${this.e(b.colecao)} · ${this.e(b.ano)} ano</span>
          <h2 class="detalhe__titulo" id="detalheTitulo">${this.e(b.nome)}</h2>
          <code class="detalhe__id">${this.e(b.id)}</code>
        </div>
        <button type="button" class="detalhe__fechar" data-fechar aria-label="${this.e(`Fechar detalhes de ${cfg.titulo}`)}">${ICONES_ENTREGA.fechar}</button>
      </header>
      <div class="detalhe__corpo">
        ${b.provisorio ? `<div class="aviso">${ICONES.alerta}<p><strong>Agrupamento provisório.</strong> Os dados deste material dependem de validação.</p></div>` : ""}
        <dl class="detalhe__campos detalhe__campos--quatro">
          ${campo("Coleção", this.e(b.colecao))}
          ${campo("Ano escolar", this.e(b.ano))}
          ${campo("Módulo", this.e(b.modulo))}
          ${campo("Tipo", this.e(b.tipoMaterial))}
        </dl>
        <section class="detalhe-checklist detalhe-etapa" data-etapa-detalhe="${this.e(etapaId)}" aria-labelledby="detalheEtapaTitulo">
          <h3 class="detalhe-checklist__titulo" id="detalheEtapaTitulo"><span class="detalhe-checklist__icone" aria-hidden="true">${icone}</span>${this.e(cfg.titulo)}</h3>
          <dl class="detalhe__campos detalhe__campos--quatro">
            ${cfg.campos.map(([rotulo, c]) => campo(this.e(rotulo), u(c))).join("")}
            ${campo("Status", `<span class="chip chip--${status}">${this.e(cfg.estado[status])}</span>`)}
          </dl>${rastreio}
        </section>
      </div>`;
    if (typeof this.dialogo.showModal === "function") {
      if (!this.dialogo.open) this.dialogo.showModal();
    } else {
      this.dialogo.setAttribute("open", "");
    }
    const fechar = Utils.qs("[data-fechar]", this.dialogo);
    if (fechar) fechar.focus();
  },

  fecharDetalhe() {
    this.fecharDialogo(this.dialogo);
  },

  devolverFoco(elemento) {
    setTimeout(() => {
      const aberto = [this.dialogo, this.listaDialogo].find((d) => d && d.open);
      const focavel = Boolean(elemento) &&
        document.contains(elemento) &&
        !elemento.disabled &&
        typeof elemento.focus === "function" &&
        elemento.getClientRects().length > 0;
      if (focavel && (!aberto || aberto.contains(elemento))) {
        elemento.focus();
        return;
      }
      if (aberto) {
        const reserva = Utils.qs("[data-fechar], [data-fechar-lista]", aberto);
        if (reserva) reserva.focus();
      }
    }, 0);
  },

  abrirDialogo(dialogo) {
    if (typeof dialogo.showModal === "function") {
      if (!dialogo.open) dialogo.showModal();
    } else {
      dialogo.setAttribute("open", "");
    }
  },

  fecharDialogo(dialogo) {
    if (typeof dialogo.close === "function") {
      dialogo.close();
    } else {
      dialogo.removeAttribute("open");
    }
  },

  INDICADORES_DETALHE: Object.freeze({
    bonecas: {
      titulo: "Bonecas solicitadas — Detalhamento",
      descricao: "Materiais com solicitação confirmada pela coluna M (dataEnvioBoneca).",
      etapa: "bonecaSolicitada",
      recortes: [
        { id: "todas", rotulo: "Todas as solicitações", filtro: () => true },
        { id: "recebidas", rotulo: "Recebidas", filtro: (b) => b.etapas.bonecaRecebida.status === STATUS.CONCLUIDO },
        { id: "sem", rotulo: "Sem recebimento registrado", filtro: (b) => b.etapas.bonecaRecebida.status !== STATUS.CONCLUIDO }
      ]
    },
    grafica: {
      titulo: "Livros enviados à gráfica — Detalhamento",
      descricao: "",
      etapa: "grafica",
      recortes: null
    }
  }),

  materiaisDoIndicador(tipo) {
    const def = this.INDICADORES_DETALHE[tipo];
    const atende = (b) => b.etapas[def.etapa].status === STATUS.CONCLUIDO;
    const base = this.listaConsolidada ? Analises.contexto().materiais : (this.conjuntoAtual || []);
    const lista = this.ordenar(base.filter(atende));
    return {
      confirmados: lista.filter((b) => !b.provisorio),
      provisorios: lista.filter((b) => b.provisorio)
    };
  },

  abrirIndicador(tipo, origem) {
    if (!this.INDICADORES_DETALHE[tipo] || !this.proc) return;
    this.origemLista = origem;
    this.listaConsolidada = Boolean(Analises.consolidado && Analises.aberta());
    this.indicadorAtivo = { tipo, recorte: "todas" };
    this.renderizarIndicador();
    this.abrirDialogo(this.listaDialogo);
    const fechar = Utils.qs("[data-fechar-lista]", this.listaDialogo);
    if (fechar) fechar.focus();
  },

  valorEtapa(b, campo) {
    return this.formatarValores(this.valoresUnicos(this.registrosPorMaterial.get(b.id) || [], campo));
  },

  textoValores(b, campo) {
    const valores = this.valoresUnicos(this.registrosPorMaterial.get(b.id) || [], campo);
    if (!valores.length) return "—";
    return valores.length === 1 ? String(valores[0]) : `Divergente: ${valores.join("; ")}`;
  },

  linhaIndicador(b, tipo) {
    const material = `<button type="button" class="link-material" data-material="${this.e(b.id)}">${this.e(b.nome)}</button>`;
    if (tipo === "grafica") {
      return `<tr><td data-rotulo="Coleção">${this.e(b.colecao)}</td><td data-rotulo="Ano">${this.e(b.ano)}</td><td class="tabela__material" data-rotulo="Material">${material}</td><td class="tabela-enviados__data" data-rotulo="Data de envio à gráfica">${this.valorEtapa(b, "dataEnvioGrafica")}</td><td data-rotulo="Responsável pelo envio">${this.valorEtapa(b, "envioGrafica")}</td></tr>`;
    }
    const inicio = `<td>${this.e(b.colecao)}</td><td>${this.e(b.ano)}</td><td class="tabela__material">${material}</td><td>${this.e(b.modulo)}</td>`;
    if (tipo === "bonecas") {
      const recebida = b.etapas.bonecaRecebida.status;
      const situacao = recebida === STATUS.CONCLUIDO
        ? '<span class="chip chip--concluido">Recebida</span>'
        : recebida === STATUS.INCONSISTENTE
          ? this.chip(STATUS.INCONSISTENTE)
          : '<span class="chip chip--nao_iniciado">Recebimento não registrado</span>';
      return `<tr>${inicio}<td>${this.valorEtapa(b, "dataEnvioBoneca")}</td><td>${this.valorEtapa(b, "enviadoBoneca")}</td><td>${situacao}</td><td>${this.valorEtapa(b, "chegadaBoneca")}</td></tr>`;
    }
    return "";
  },

  tabelaIndicador(lista, tipo, rotulo, vazio) {
    const colunas = tipo === "bonecas"
      ? ["Coleção", "Ano", "Material", "Módulo", "Data de solicitação", "Responsável", "Situação da boneca", "Data de recebimento"]
      : ["Coleção", "Ano", "Material", "Data de envio à gráfica", "Responsável pelo envio"];
    if (!lista.length) return `<div class="lista-vazia">${this.e(vazio)}</div>`;
    return `
      <div class="tabela__rolagem lista-indicador__rolagem" tabindex="0" role="region" aria-label="${this.e(rotulo)}">
        <table class="tabela tabela--compacta${tipo === "grafica" ? " tabela-enviados" : ""}">
          <thead><tr>${colunas.map((c) => `<th scope="col">${c}</th>`).join("")}</tr></thead>
          <tbody>${lista.map((b) => this.linhaIndicador(b, tipo)).join("")}</tbody>
        </table>
      </div>`;
  },

  escopoLista() {
    const consolidado = Boolean(this.listaConsolidada);
    const filtros = consolidado ? this.filtrosVisao : this.filtros;
    const nomes = { colecao: "Coleção", ano: "Ano", tipo: "Tipo", situacao: "Situação", entrega: "Entrega", modulo: "Módulo" };
    return {
      secao: consolidado ? "Visão Geral" : CiclosEntrega.nomeCiclo(this.entrega),
      filtros: Object.entries(filtros).filter(([, v]) => v.length).map(([k, v]) => ({ k, rotulo: nomes[k], valores: v.map((x) => this.rotuloOpcao(k, x)).join(", ") }))
    };
  },

  async salvarEnviados(botao) {
    if (!botao || botao.disabled) return;
    const { confirmados } = this.materiaisDoIndicador("grafica");
    if (!confirmados.length) return;
    const escopo = this.escopoLista();
    const dados = {
      secao: escopo.secao,
      filtros: escopo.filtros.map((f) => `${f.rotulo}: ${f.valores}`),
      materiais: confirmados.map((b) => ({
        id: b.id,
        chaveColecao: Materiais.semAcento(b.colecao),
        colecao: b.colecao,
        ano: b.ano,
        nome: b.nome,
        data: this.textoValores(b, "dataEnvioGrafica"),
        responsavel: this.textoValores(b, "envioGrafica")
      }))
    };
    botao.disabled = true;
    botao.setAttribute("aria-busy", "true");
    try {
      const data = new Date();
      await RelatorioPdf.baixarEnviados(dados, data, RelatorioPdf.nomeArquivo({ tipo: "livrosEnviados", escopo: this.listaConsolidada ? "visao" : "entregas", entrega: this.entrega, data }));
    } finally {
      botao.disabled = false;
      botao.removeAttribute("aria-busy");
    }
  },

  descricaoFiltros() {
    if (this.listaConsolidada) {
      const escopo = this.escopoLista();
      return `<span class="tag tag--primaria">Visão Geral</span>${escopo.filtros.map((f) => `<span class="tag">${this.e(f.rotulo)}: ${this.e(f.valores)}</span>`).join("")}`;
    }
    const nomes = { colecao: "Coleção", ano: "Ano", tipo: "Tipo", situacao: "Situação" };
    const ativos = Object.entries(this.filtros).filter(([, v]) => v.length).map(([k, v]) =>
      `<span class="tag">${nomes[k]}: ${this.e(v.map((x) => this.rotuloOpcao(k, x)).join(", "))}</span>`);
    return `<span class="tag tag--primaria">${this.e(CiclosEntrega.nomeCiclo(this.entrega))}</span>${ativos.join("")}`;
  },

  renderizarIndicador() {
    const { tipo, recorte } = this.indicadorAtivo;
    const def = this.INDICADORES_DETALHE[tipo];
    const { confirmados, provisorios } = this.materiaisDoIndicador(tipo);
    let lista = confirmados;
    let seletor = "";
    if (def.recortes) {
      const atual = def.recortes.find((r) => r.id === recorte) || def.recortes[0];
      lista = confirmados.filter(atual.filtro);
      seletor = `
        <div class="segmentos" role="group" aria-label="Filtrar solicitações">
          ${def.recortes.map((r) => `
            <button type="button" class="segmento" data-recorte="${r.id}" aria-pressed="${r.id === atual.id}">
              ${r.rotulo}<span class="segmento__contagem">${this.n(confirmados.filter(r.filtro).length)}</span>
            </button>`).join("")}
        </div>`;
    }
    const vazio = confirmados.length
      ? "Nenhum material neste recorte."
      : "Nenhum material confirmado atende a este indicador com os filtros atuais.";
    const blocoProvisorios = provisorios.length ? `
      <details class="recolhivel lista-indicador__provisorios">
        <summary>
          <span class="detalhe__secao">Agrupamentos provisórios (não contabilizados no card)</span>
          <span class="contador">${this.n(provisorios.length)}</span>
        </summary>
        <p class="bloco__subtitulo">Materiais que atendem à regra, mas dependem de validação do agrupamento.</p>
        ${this.tabelaIndicador(provisorios, tipo, "Agrupamentos provisórios", "")}
      </details>` : "";

    this.listaConteudo.innerHTML = `
      <header class="detalhe__cabecalho">
        <div>
          <span class="detalhe__eyebrow">Indicador</span>
          <h2 class="detalhe__titulo" id="listaIndicadorTitulo">${this.e(def.titulo)}</h2>
          ${def.descricao ? `<p class="lista-indicador__descricao">${this.e(def.descricao)}</p>` : ""}
        </div>
        <button type="button" class="detalhe__fechar" data-fechar-lista aria-label="Fechar detalhamento">${ICONES_ENTREGA.fechar}</button>
      </header>
      <div class="detalhe__corpo">
        <div class="lista-indicador__resumo">
          <div class="lista-indicador__total"><strong>${this.n(confirmados.length)}</strong><span>materiais confirmados</span></div>
          <div class="lista-indicador__filtros">${this.descricaoFiltros()}</div>
        </div>
        ${seletor}
        ${this.tabelaIndicador(lista, tipo, def.titulo, vazio)}
        ${blocoProvisorios}
        ${tipo === "grafica" ? `
        <footer class="relatorio__rodape lista-indicador__rodape">
          <button type="button" class="relatorio__acao relatorio__acao--salvar" data-salvar-enviados${confirmados.length ? "" : " disabled"}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11"/><path d="m7 10 5 5 5-5"/><path d="M5 19h14"/></svg>
            <span>Salvar relatório</span>
          </button>
        </footer>` : ""}
      </div>`;
  }
};
