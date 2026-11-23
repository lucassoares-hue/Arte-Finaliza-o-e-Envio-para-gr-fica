const STATUS = Object.freeze({
  NAO_INICIADO: "nao_iniciado",
  EM_ANDAMENTO: "em_andamento",
  CONCLUIDO: "concluido",
  INCONSISTENTE: "inconsistente"
});

const STATUS_ROTULO = Object.freeze({
  nao_iniciado: "Não iniciado",
  em_andamento: "Em andamento",
  concluido: "Concluído",
  inconsistente: "Inconsistente"
});

const SITUACAO_BOOK = Object.freeze({
  NAO_INICIADO: "nao_iniciado",
  EM_PRODUCAO: "em_producao",
  ENTREGUE: "entregue",
  VALIDACAO: "validacao"
});

const ETAPAS_BOOK = Object.freeze([
  { id: "montagem", nome: "Montagem do BOOK", tipo: "intervalo", inicio: "inicioBook", fim: "fimBook", responsavel: "book" },
  { id: "bonecaSolicitada", nome: "Solicitação da boneca", tipo: "registro", campo: "dataEnvioBoneca", responsavel: "enviadoBoneca" },
  { id: "bonecaRecebida", nome: "Recebimento da boneca", tipo: "registro", campo: "chegadaBoneca" },
  { id: "qrCodes", nome: "Verificação dos QR Codes", tipo: "registro", campo: "verificacaoQr" },
  { id: "ajustes", nome: "Ajustes finais", tipo: "intervalo", inicio: "inicioAjusteFinal", fim: "fimAjusteFinal", responsavel: "ajusteFinal" },
  { id: "grafica", nome: "Envio à gráfica", tipo: "registro", campo: "dataEnvioGrafica", responsavel: "envioGrafica" },
  { id: "separatas", nome: "Separatas", tipo: "registro", campo: "separatas", data: "dataSeparatas" },
  { id: "gabaritos", nome: "Gabaritos", tipo: "registro", campo: "gabarito", data: "dataGabarito" }
]);

const ETAPA_CHECKLIST = Object.freeze({
  id: "checklist", nome: "Checklist de qualidade", tipo: "intervalo",
  inicio: "inicioProducao", fim: "fimProducao", previsto: "previstoProducao", responsavel: "responsavel"
});

const Processamento = {
  texto(valor) {
    if (valor === null || valor === undefined) return "";
    return String(valor).trim();
  },

  preenchido(valor) {
    return this.texto(valor) !== "";
  },

  normalizarRegistro(registro, indice) {
    const original = Object.freeze({ ...registro });
    const campos = {};
    CONFIG.CAMPOS_OBRIGATORIOS.forEach((campo) => {
      campos[campo] = campo === "linhaBase" ? registro[campo] : this.texto(registro[campo]);
    });
    const camposAusentes = CONFIG.CAMPOS_OBRIGATORIOS.filter(
      (campo) => !Object.prototype.hasOwnProperty.call(registro, campo)
    );
    return {
      id: campos.linhaBase !== undefined && campos.linhaBase !== "" ? `L${campos.linhaBase}` : `I${indice}`,
      linhaBase: campos.linhaBase,
      campos,
      original,
      camposAdicionais: Object.freeze(registro.camposAdicionais && typeof registro.camposAdicionais === "object" && !Array.isArray(registro.camposAdicionais) ? { ...registro.camposAdicionais } : {}),
      materialId: null,
      camposAusentes
    };
  },

  statusIntervalo(inicio, fim) {
    const temInicio = this.preenchido(inicio);
    const temFim = this.preenchido(fim);
    if (temInicio && temFim) return STATUS.CONCLUIDO;
    if (temInicio) return STATUS.EM_ANDAMENTO;
    if (temFim) return STATUS.INCONSISTENTE;
    return STATUS.NAO_INICIADO;
  },

  statusRegistro(valor) {
    return this.preenchido(valor) ? STATUS.CONCLUIDO : STATUS.NAO_INICIADO;
  },

  avaliarEtapa(etapa, campos) {
    if (etapa.tipo === "intervalo") {
      const status = this.statusIntervalo(campos[etapa.inicio], campos[etapa.fim]);
      return {
        status,
        inconsistenciaSequencia: status === STATUS.INCONSISTENTE,
        valores: { [etapa.inicio]: campos[etapa.inicio], [etapa.fim]: campos[etapa.fim] }
      };
    }
    return {
      status: this.statusRegistro(campos[etapa.campo]),
      inconsistenciaSequencia: false,
      valores: { [etapa.campo]: campos[etapa.campo] }
    };
  },

  avaliarChecklist(registro) {
    const avaliacao = this.avaliarEtapa(ETAPA_CHECKLIST, registro.campos);
    return {
      id: registro.id,
      linhaBase: registro.linhaBase,
      colecao: registro.campos.colecao,
      ano: registro.campos.ano,
      modulo: registro.campos.modulo,
      frente: registro.campos.frente,
      materialId: registro.materialId,
      status: avaliacao.status,
      previsto: registro.campos[ETAPA_CHECKLIST.previsto],
      inconsistenciaSequencia: avaliacao.inconsistenciaSequencia
    };
  },

  consolidarEtapa(etapa, registros) {
    const avaliacoes = registros.map((registro) => ({
      linhaBase: registro.linhaBase,
      ...this.avaliarEtapa(etapa, registro.campos)
    }));
    const assinaturas = new Set(avaliacoes.map((a) => JSON.stringify(a.valores)));
    const divergente = assinaturas.size > 1;
    const sequenciaInvalida = avaliacoes.some((a) => a.inconsistenciaSequencia);
    let status;
    if (divergente || sequenciaInvalida) {
      status = STATUS.INCONSISTENTE;
    } else {
      status = avaliacoes[0].status;
    }
    return {
      id: etapa.id,
      nome: etapa.nome,
      status,
      divergente,
      sequenciaInvalida,
      valores: divergente ? null : avaliacoes[0].valores,
      porLinha: avaliacoes
    };
  },

  consolidarMaterial(grupo) {
    const { def } = grupo;
    const registros = grupo.itens.map((i) => i.registro);
    const pendencias = grupo.pendencias.map((p) => ({ ...p }));

    const etapas = {};
    ETAPAS_BOOK.forEach((etapa) => {
      etapas[etapa.id] = this.consolidarEtapa(etapa, registros);
    });

    const etapasDivergentes = ETAPAS_BOOK.filter((e) => etapas[e.id].divergente).map((e) => e.id);
    if (etapasDivergentes.length) {
      pendencias.push({
        tipo: "etapa_divergente",
        provisorio: false,
        descricao: "Registros do mesmo material possuem valores diferentes para a mesma etapa.",
        detalhes: etapasDivergentes.map((id) => ({
          etapa: id,
          linhas: etapas[id].porLinha.map((l) => ({ linhaBase: l.linhaBase, valores: l.valores }))
        }))
      });
    }

    const etapasSequencia = ETAPAS_BOOK.filter((e) => etapas[e.id].sequenciaInvalida).map((e) => e.id);
    if (etapasSequencia.length) {
      pendencias.push({
        tipo: "sequencia_invalida",
        provisorio: false,
        descricao: "Etapa com conclusão registrada sem registro de início.",
        detalhes: etapasSequencia.map((id) => ({
          etapa: id,
          linhas: etapas[id].porLinha.filter((l) => l.inconsistenciaSequencia).map((l) => l.linhaBase)
        }))
      });
    }

    const checklists = registros.map((registro) => this.avaliarChecklist(registro));
    const resumoChecklist = this.contarStatus(checklists);

    const provisorio = pendencias.some((p) => p.provisorio);

    return {
      id: def.id,
      chave: def.id,
      colecao: def.colecao,
      ano: def.ano,
      tipoMaterial: def.tipoMaterial,
      categoria: def.categoria,
      modulo: def.modulo,
      nome: def.nome,
      provisorio,
      identificacao: provisorio ? "provisoria" : "confirmada",
      frentes: grupo.itens.map((i) => ({ linhaBase: i.registro.linhaBase, frente: i.frente.original })),
      linhas: registros.map((r) => r.linhaBase),
      totalFrentes: registros.length,
      checklist: resumoChecklist,
      etapas,
      pendencias,
      situacao: this.situacaoBook(provisorio, etapas, resumoChecklist)
    };
  },

  situacaoBook(provisorio, etapas, checklist) {
    const lista = ETAPAS_BOOK.map((e) => etapas[e.id]);
    const algumaInconsistente = lista.some((e) => e.status === STATUS.INCONSISTENTE) || checklist.inconsistente > 0;
    if (provisorio || algumaInconsistente) return SITUACAO_BOOK.VALIDACAO;
    const todasConcluidas = lista.every((e) => e.status === STATUS.CONCLUIDO);
    const checklistConcluido = checklist.total > 0 && checklist.concluido === checklist.total;
    if (todasConcluidas && checklistConcluido) return SITUACAO_BOOK.ENTREGUE;
    const algumRegistro = lista.some((e) => e.status !== STATUS.NAO_INICIADO) || checklist.nao_iniciado < checklist.total;
    return algumRegistro ? SITUACAO_BOOK.EM_PRODUCAO : SITUACAO_BOOK.NAO_INICIADO;
  },

  contarStatus(itens) {
    const contagem = { total: itens.length, nao_iniciado: 0, em_andamento: 0, concluido: 0, inconsistente: 0 };
    itens.forEach((item) => { contagem[item.status] += 1; });
    return contagem;
  },

  processar(registrosApi) {
    const lista = Array.isArray(registrosApi) ? registrosApi : [];
    const registros = lista
      .filter((item) => item && typeof item === "object")
      .map((item, indice) => this.normalizarRegistro(item, indice));

    const inconsistencias = [];

    const agrupamento = Materiais.agrupar(registros);
    agrupamento.grupos.forEach((grupo) => {
      grupo.itens.forEach((item) => { item.registro.materialId = grupo.def.id; });
    });

    agrupamento.naoClassificados.forEach((nc) => {
      inconsistencias.push({
        tipo: "nao_classificado",
        linhaBase: nc.linhaBase,
        descricao: nc.motivo
      });
    });

    registros.filter((r) => r.camposAusentes.length).forEach((r) => {
      inconsistencias.push({
        tipo: "campos_ausentes",
        linhaBase: r.linhaBase,
        descricao: `Campos ausentes: ${r.camposAusentes.join(", ")}.`
      });
    });

    const checklists = registros.map((r) => this.avaliarChecklist(r));
    checklists.filter((c) => c.inconsistenciaSequencia).forEach((c) => {
      inconsistencias.push({
        tipo: "checklist_sem_inicio",
        linhaBase: c.linhaBase,
        descricao: `Checklist concluído sem registro de início (${c.colecao} ${c.ano} ${c.modulo} · ${c.frente}).`
      });
    });

    const books = agrupamento.grupos.map((grupo) => this.consolidarMaterial(grupo));

    books.forEach((book) => {
      book.pendencias.forEach((pendencia) => {
        inconsistencias.push({
          tipo: pendencia.tipo,
          book: book.chave,
          descricao: pendencia.descricao,
          detalhes: pendencia.detalhes
        });
      });
    });

    return {
      processadoEm: new Date(),
      registros,
      checklists,
      books,
      materiais: books,
      naoClassificados: agrupamento.naoClassificados,
      inconsistencias,
      indicadores: {
        checklist: IndicadoresCalculo.checklist(checklists),
        books: IndicadoresCalculo.books(books)
      }
    };
  }
};

const IndicadoresCalculo = {
  checklist(checklists) {
    const c = Processamento.contarStatus(checklists);
    return {
      totalFrentes: c.total,
      iniciados: c.em_andamento + c.concluido,
      emAndamento: c.em_andamento,
      concluidos: c.concluido,
      naoIniciados: c.nao_iniciado,
      inconsistentes: c.inconsistente
    };
  },

  contarBooks(books) {
    const etapa = (book, id) => book.etapas[id].status;
    const conta = (fn) => books.filter(fn).length;
    const iniciada = (s) => s === STATUS.EM_ANDAMENTO || s === STATUS.CONCLUIDO;
    return {
      total: books.length,
      montagemIniciada: conta((b) => iniciada(etapa(b, "montagem"))),
      montagemConcluida: conta((b) => etapa(b, "montagem") === STATUS.CONCLUIDO),
      bonecasSolicitadas: conta((b) => etapa(b, "bonecaSolicitada") === STATUS.CONCLUIDO),
      bonecasRecebidas: conta((b) => etapa(b, "bonecaRecebida") === STATUS.CONCLUIDO),
      qrCodesVerificados: conta((b) => etapa(b, "qrCodes") === STATUS.CONCLUIDO),
      ajustesIniciados: conta((b) => iniciada(etapa(b, "ajustes"))),
      ajustesConcluidos: conta((b) => etapa(b, "ajustes") === STATUS.CONCLUIDO),
      enviadosGrafica: conta((b) => etapa(b, "grafica") === STATUS.CONCLUIDO),
      separatasConcluidas: conta((b) => etapa(b, "separatas") === STATUS.CONCLUIDO),
      gabaritosEnviados: conta((b) => etapa(b, "gabaritos") === STATUS.CONCLUIDO),
      integralmenteEntregues: conta((b) => b.situacao === SITUACAO_BOOK.ENTREGUE),
      aguardandoValidacao: conta((b) => b.situacao === SITUACAO_BOOK.VALIDACAO)
    };
  },

  situacoes(books) {
    const contagem = {};
    Object.values(SITUACAO_BOOK).forEach((s) => { contagem[s] = 0; });
    books.forEach((b) => { contagem[b.situacao] += 1; });
    return contagem;
  },

  books(books) {
    const confirmados = books.filter((b) => !b.provisorio);
    const provisorios = books.filter((b) => b.provisorio);
    return {
      totalIdentificados: books.length,
      confirmados: this.contarBooks(confirmados),
      provisorios: this.contarBooks(provisorios),
      situacoes: this.situacoes(books)
    };
  }
};

const SITUACAO_ROTULO = Object.freeze({
  nao_iniciado: "Não iniciado",
  em_producao: "Em produção",
  entregue: "Entregue",
  validacao: "Aguardando validação"
});

const MAPA_INDICADOR_ETAPA = Object.freeze({
  montagem: "montagemConcluida",
  bonecaSolicitada: "bonecasSolicitadas",
  bonecaRecebida: "bonecasRecebidas",
  qrCodes: "qrCodesVerificados",
  ajustes: "ajustesConcluidos",
  grafica: "enviadosGrafica",
  separatas: "separatasConcluidas",
  gabaritos: "gabaritosEnviados"
});

const ICONES = Object.freeze({
  frentes: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6h12M8 12h12M8 18h12"/><path d="M4 6h.01M4 12h.01M4 18h.01"/></svg>',
  materiais: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5"/><path d="M18 19v2H6"/></svg>',
  checklist: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 11l2.5 2.5L16 9"/><rect x="4" y="4" width="16" height="16" rx="3"/></svg>',
  alerta: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4 2.8 19.5h18.4z"/><path d="M12 10v4"/><path d="M12 17h.01"/></svg>',
  info: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 8h.01"/></svg>'
});

const Dashboard = {
  numero(valor) {
    return Utils.formatarNumero(valor);
  },

  percentual(parte, total) {
    if (!total) return 0;
    return Math.round((parte / total) * 1000) / 10;
  },

  dica(texto) {
    const t = Utils.escaparHtml(texto);
    return `<span class="dica" tabindex="0" role="note" aria-label="${t}" data-dica="${t}">${ICONES.info}</span>`;
  },

  card({ icone, titulo, valor, descricao, dica, variante, acao }) {
    const interativo = acao
      ? ` kpi--interativo" role="button" tabindex="0" aria-haspopup="dialog" data-indicador="${Utils.escaparHtml(acao)}" aria-label="${Utils.escaparHtml(`${titulo}: ${valor}. Abrir detalhamento`)}`
      : "";
    const marcador = acao
      ? '<span class="kpi__abrir" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M7 17 17 7"/><path d="M8 7h9v9"/></svg></span>'
      : "";
    return `
      <article class="kpi kpi--${variante}${interativo}">
        <div class="kpi__topo">
          <span class="kpi__icone">${icone}</span>
          <h3 class="kpi__titulo">${Utils.escaparHtml(titulo)}</h3>
          ${dica ? this.dica(dica) : ""}
          ${marcador}
        </div>
        <p class="kpi__valor">${valor}</p>
        <p class="kpi__descricao">${descricao}</p>
      </article>`;
  },

  materiaisConsolidados(proc) {
    const mapa = new Map();
    CiclosEntrega.ENTREGAS.forEach((e) => CiclosEntrega.selecionar(proc, e).materiais.forEach((b) => { if (!mapa.has(b.id)) mapa.set(b.id, b); }));
    return [...mapa.values()];
  },

  renderizarConsolidado(proc) {
    const c = CiclosEntrega.indicadores(this.materiaisConsolidados(proc)).confirmados;
    const taxa = CiclosEntrega.taxaEntrega(c.enviadosGrafica, c.total);
    const cards = [
      { imagem: "assets/entregas.png", analise: "programadas", titulo: "Entregas Programadas", valor: EntregasView.n(c.total),
        complemento: c.total === 1 ? "material programado" : "materiais programados",
        apoio: "Materiais programados nos quatro entregáveis." },
      { imagem: "assets/facform.jpg", imagemLargura: 945, imagemAltura: 455, variante: "marca", analise: "enviados", titulo: "Livros Enviados para impressão", valor: EntregasView.n(c.enviadosGrafica),
        complemento: "enviados à gráfica",
        apoio: "Materiais enviados para impressão." },
      { imagem: "assets/%25.png", titulo: "Taxa de entrega", valor: CiclosEntrega.formatarTaxa(taxa),
        complemento: "de envio à gráfica",
        apoio: `${EntregasView.n(c.enviadosGrafica)} enviados de ${EntregasView.n(c.total)} programados` }
    ];
    return `<div class="entregas-kpis">${cards.map((card) => EntregasView.cardPrincipal(card)).join("")}</div>`;
  },

  renderizarCards(proc) {
    const ck = proc.indicadores.checklist;
    const bk = proc.indicadores.books;
    const pctCk = this.percentual(ck.concluidos, ck.totalFrentes);
    return `
      <div class="kpis__grupo">
        <span class="bloco__rotulo">Operação</span>
        <div class="kpis__grade">
          ${this.card({
            icone: ICONES.frentes, variante: "operacional", titulo: "Frentes de produção",
            valor: this.numero(ck.totalFrentes),
            descricao: "Disciplinas/frentes registradas na BD-DADOS-ARTE.",
            dica: "Cada linha da planilha corresponde a uma frente de checklist. Frentes não são materiais."
          })}
          ${this.card({
            icone: ICONES.materiais, variante: "operacional", titulo: "Materiais identificados",
            valor: this.numero(bk.totalIdentificados),
            descricao: `${this.numero(bk.confirmados.total)} confirmados · ${this.numero(bk.provisorios.total)} provisórios`,
            dica: "Materiais agrupados por coleção, ano escolar e módulo. Inclui BOOK, CMA e MANUAL."
          })}
          ${this.card({
            icone: ICONES.checklist, variante: "operacional", titulo: "Checklists concluídos",
            valor: this.numero(ck.concluidos),
            descricao: `${pctCk.toLocaleString("pt-BR")}% de ${this.numero(ck.totalFrentes)} frentes`,
            dica: "Frentes com início e fim do checklist registrados. A data prevista não confirma conclusão."
          })}
        </div>
      </div>
      <div class="kpis__grupo kpis__grupo--qualidade">
        <span class="bloco__rotulo">Qualidade dos dados</span>
        <div class="kpis__grade">
          ${this.card({
            icone: ICONES.alerta, variante: "qualidade", titulo: "Agrupamentos provisórios",
            valor: this.numero(bk.provisorios.total),
            descricao: `de ${this.numero(bk.totalIdentificados)} materiais precisam de validação`,
            dica: "Agrupamentos com frentes repetidas ou valores divergentes entre linhas. Não entram como entregas confirmadas."
          })}
        </div>
      </div>`;
  },

  NOMES_FLUXO: Object.freeze({ grafica: "Enviado para impressão", separatas: "Separatas V4", gabaritos: "Gabaritos enviados" }),

  taxaFluxo(parte, total) {
    const valor = total ? (parte / total) * 100 : 0;
    return `${valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
  },

  cartaoFluxo({ numero, unidade, nome, confirmados, total, nota, frentes }) {
    const raio = 42;
    const circ = 2 * Math.PI * raio;
    const fracao = total ? Math.min(1, confirmados / total) : 0;
    const pendentes = Math.max(0, total - confirmados);
    const pct = this.taxaFluxo(confirmados, total);
    return `
      <li class="etapa${frentes ? " etapa--frentes" : ""}">
        <div class="etapa__cabecalho">
          <span class="etapa__numero">${numero}</span>
          <span class="etapa__unidade">${unidade}</span>
        </div>
        <h4 class="etapa__nome">${Utils.escaparHtml(nome)}</h4>
        <div class="etapa__donut" role="img" aria-label="${Utils.escaparHtml(`${nome}: ${this.numero(confirmados)} de ${this.numero(total)} ${unidade} confirmados, ${pct}`)}">
          <svg viewBox="0 0 100 100" aria-hidden="true">
            <circle class="etapa__trilha" cx="50" cy="50" r="${raio}"/>
            ${fracao > 0 ? `<circle class="etapa__arco" cx="50" cy="50" r="${raio}" stroke-dasharray="${(circ * fracao).toFixed(2)} ${circ.toFixed(2)}"/>` : ""}
          </svg>
          <span class="etapa__centro" aria-hidden="true"><strong>${this.numero(confirmados)}<span> / ${this.numero(total)}</span></strong><em>${pct}</em></span>
        </div>
        <dl class="etapa__legenda">
          <div><dt><i class="etapa__ponto etapa__ponto--confirmado" aria-hidden="true"></i>Confirmados</dt><dd>${this.numero(confirmados)}</dd></div>
          <div><dt><i class="etapa__ponto" aria-hidden="true"></i>Pendentes</dt><dd>${this.numero(pendentes)}</dd></div>
        </dl>
        ${nota ? `<p class="etapa__nota">${nota}</p>` : ""}
      </li>`;
  },

  renderizarFluxo(proc) {
    const ck = proc.indicadores.checklist;
    const bk = proc.indicadores.books;
    const totalConf = bk.confirmados.total;
    const etapaChecklist = this.cartaoFluxo({
      numero: 1, unidade: "frentes", nome: ETAPA_CHECKLIST.nome, confirmados: ck.concluidos, total: ck.totalFrentes, frentes: true,
      nota: `${this.numero(ck.emAndamento)} em andamento · ${this.numero(ck.inconsistentes)} inconsistentes`
    });
    const etapas = ETAPAS_BOOK.map((etapa, i) => {
      const chave = MAPA_INDICADOR_ETAPA[etapa.id];
      const prov = bk.provisorios[chave];
      return this.cartaoFluxo({
        numero: i + 2, unidade: "materiais", nome: this.NOMES_FLUXO[etapa.id] || etapa.nome, confirmados: bk.confirmados[chave], total: totalConf,
        nota: prov ? `+${this.numero(prov)} em agrupamento provisório` : ""
      });
    }).join("");
    return `
      <div class="bloco__cabecalho">
        <div>
          <h3 class="bloco__titulo">Fluxo de Arte-Finalização</h3>
          <p class="bloco__subtitulo">Conclusões confirmadas por etapa. O checklist é contado por frente; as demais etapas, por material consolidado.</p>
        </div>
      </div>
      <ol class="fluxo__lista">${etapaChecklist}${etapas}</ol>`;
  },

  motivos(book) {
    const nomeEtapa = (id) => (ETAPAS_BOOK.find((e) => e.id === id) || {}).nome || id;
    return book.pendencias.map((p) => {
      if (p.tipo === "frente_duplicada") {
        const itens = p.detalhes.map((d) => `${Utils.escaparHtml(d.frente)} (linhas ${d.linhas.join(", ")})`);
        return `<li><strong>Frentes repetidas:</strong> ${itens.join("; ")}</li>`;
      }
      if (p.tipo === "etapa_divergente") {
        return `<li><strong>Valores divergentes entre linhas:</strong> ${p.detalhes.map((d) => Utils.escaparHtml(nomeEtapa(d.etapa))).join(", ")}</li>`;
      }
      if (p.tipo === "sequencia_invalida") {
        return `<li><strong>Conclusão sem início:</strong> ${p.detalhes.map((d) => `${Utils.escaparHtml(nomeEtapa(d.etapa))} (linhas ${d.linhas.join(", ")})`).join("; ")}</li>`;
      }
      return `<li>${Utils.escaparHtml(p.descricao)}</li>`;
    }).join("");
  },

  renderizarValidacao(proc) {
    const provisorios = proc.books.filter((b) => b.provisorio);
    const corpo = provisorios.length
      ? provisorios.map((b) => `
        <tr>
          <td>${Utils.escaparHtml(b.colecao)}</td>
          <td>${Utils.escaparHtml(b.ano)}</td>
          <td><span class="tag">${Utils.escaparHtml(b.modulo)}</span></td>
          <td class="num">${this.numero(b.totalFrentes)}</td>
          <td><ul class="motivos">${this.motivos(b)}</ul></td>
        </tr>`).join("")
      : `<tr><td colspan="5" class="tabela__vazia">Nenhum agrupamento provisório identificado.</td></tr>`;
    return `
      <div class="bloco__cabecalho">
        <div>
          <h3 class="bloco__titulo">Materiais que precisam de validação</h3>
          <p class="bloco__subtitulo">Agrupamentos provisórios. Não são contabilizados como entregas confirmadas.</p>
        </div>
        <span class="contador">${this.numero(provisorios.length)}</span>
      </div>
      <div class="tabela__rolagem" tabindex="0" role="region" aria-label="Tabela de materiais que precisam de validação">
        <table class="tabela">
          <thead>
            <tr><th scope="col">Coleção</th><th scope="col">Ano</th><th scope="col">Material</th><th scope="col" class="num">Frentes</th><th scope="col">Motivo</th></tr>
          </thead>
          <tbody>${corpo}</tbody>
        </table>
      </div>`;
  }
};

const Indicadores = {
  container() {
    return Utils.qs("#indicadores");
  },

  limpar() {
    const alvo = this.container();
    if (alvo) alvo.innerHTML = "";
  },

  processar(registros) {
    return Processamento.processar(registros);
  },

  renderizar(proc) {
    const cards = Utils.qs("#indicadores");
    const fluxo = Utils.qs("#fluxo");
    const validacao = Utils.qs("#validacao");
    if (!proc) {
      [cards, fluxo, validacao].forEach((el) => { if (el) el.innerHTML = ""; });
      return;
    }
    cards.innerHTML = Dashboard.renderizarConsolidado(proc);
    fluxo.innerHTML = Dashboard.renderizarFluxo(proc);
    if (validacao) validacao.innerHTML = Dashboard.renderizarValidacao(proc);
  }
};
