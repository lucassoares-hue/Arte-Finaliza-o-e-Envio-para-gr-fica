const CentralPendencias = {
  ETAPAS: Object.freeze([
    Object.freeze({ id: "checklist", nome: "Realizar Checklist de qualidade", unidade: "frentes", cor: "#2563EB" }),
    Object.freeze({ id: "montagem", nome: "Montar Book", unidade: "materiais", cor: "#475569" }),
    Object.freeze({ id: "bonecaSolicitada", nome: "Solicitar Boneca", unidade: "materiais", cor: "#7C3AED" }),
    Object.freeze({ id: "qrCodes", nome: "Verificar QRs", unidade: "materiais", cor: "#0891B2" }),
    Object.freeze({ id: "ajustes", nome: "Realizar Ajustes Finais", unidade: "materiais", cor: "#B45309" }),
    Object.freeze({ id: "grafica", nome: "Enviar para impressão", unidade: "materiais", cor: "#047857" }),
    Object.freeze({ id: "separatas", nome: "Gerar separatas para o V4", unidade: "materiais", cor: "#BE185D" }),
    Object.freeze({ id: "gabaritos", nome: "Enviar Gabarito", unidade: "materiais", cor: "#334155" })
  ]),

  ORDEM_COLECOES: Object.freeze(["LUDUS", "BASIS", "MUNDUS"]),

  filtros: { colecao: "", ano: "", entrega: "", modulo: "" },
  selecionadas: new Set(),
  disponiveis: [],

  init() {
    this.botao = Utils.qs("#btnPendentes");
    this.dialogo = Utils.qs("#centralPendencias");
    this.conteudo = Utils.qs("#centralPendenciasConteudo");
    if (!this.botao || !this.dialogo) return;
    this.botao.addEventListener("click", () => this.abrir());
    this.dialogo.addEventListener("click", (evento) => {
      if (evento.target === this.dialogo || evento.target.closest("[data-fechar-central]")) {
        this.fechar();
        return;
      }
      const salvar = evento.target.closest("[data-salvar-relatorio]");
      if (salvar) {
        this.salvar(salvar);
        return;
      }
      if (evento.target.closest("[data-imprimir-relatorio]")) {
        this.imprimir();
        return;
      }
      const detalhe = evento.target.closest("[data-detalhe-central]");
      if (detalhe) this.abrirDetalhe(detalhe);
    });
    this.dialogo.addEventListener("change", (evento) => {
      if (evento.target.matches("[data-atividades-todas]")) {
        this.selecionadas = evento.target.checked ? new Set(this.disponiveis) : new Set();
        Utils.qsa("[data-atividade]", this.dialogo).forEach((c) => { c.checked = evento.target.checked; });
      } else if (evento.target.matches("[data-atividade]")) {
        if (evento.target.checked) this.selecionadas.add(evento.target.dataset.atividade);
        else this.selecionadas.delete(evento.target.dataset.atividade);
      } else {
        return;
      }
      this.atualizarSelecao();
      this.renderizarTabela();
    });
    this.dialogo.addEventListener("close", () => EntregasView.devolverFoco(this.botao));
  },

  filtrosVazios() {
    return { colecao: "", ano: "", entrega: "", modulo: "" };
  },

  e(valor) {
    return Utils.escaparHtml(valor);
  },

  n(valor) {
    return Utils.formatarNumero(valor);
  },

  exibirBotao(visivel) {
    if (this.botao) this.botao.hidden = !visivel;
    if (!visivel) this.fechar();
  },

  aberta() {
    return Boolean(this.dialogo && this.dialogo.open);
  },

  abrir() {
    if (!EntregasView.proc) return;
    this.filtros = this.filtrosVazios();
    if (EntregasView.escopo === "entregas") this.filtros.entrega = String(EntregasView.entrega);
    this.selecionadas = new Set();
    this.disponiveis = [];
    this.renderizar();
    EntregasView.abrirDialogo(this.dialogo);
    this.botao.setAttribute("aria-expanded", "true");
    this.dialogo.scrollTop = 0;
    const fechar = Utils.qs("[data-fechar-central]", this.dialogo);
    if (fechar) fechar.focus();
  },

  fechar() {
    if (!this.aberta()) return;
    EntregasView.fecharDialogo(this.dialogo);
    this.botao.setAttribute("aria-expanded", "false");
  },

  atualizar() {
    if (!this.aberta()) return;
    if (!EntregasView.proc) {
      this.fechar();
      return;
    }
    this.renderizar();
  },

  filtrosOrigem() {
    return EntregasView.escopo === "visao" ? EntregasView.filtrosVisao : EntregasView.filtros;
  },

  base() {
    const proc = EntregasView.proc;
    const origem = this.filtrosOrigem();
    return Dashboard.materiaisConsolidados(proc).filter((b) => !b.provisorio && EntregasView.atendeFiltros(b, origem));
  },

  valor(grupo, b) {
    if (grupo === "colecao") return Materiais.semAcento(b.colecao);
    return EntregasView.valorDoGrupo(grupo, b);
  },

  rotulo(grupo, valor) {
    if (grupo === "etapa") return (this.ETAPAS.find((e) => e.id === valor) || {}).nome || valor;
    return EntregasView.rotuloOpcao(grupo, valor);
  },

  itens(materiais) {
    const proc = EntregasView.proc;
    const dados = Pendencias.dados(proc);
    const disponivel = Boolean(dados && dados.disponivel);
    const lista = [];
    if (disponivel) {
      Pendencias.frentes(proc, materiais).filter((f) => f.estado === Pendencias.ESTADO).forEach((f) => {
        lista.push({ etapa: "checklist", material: f.material, frente: f.registro.campos.frente || "", responsavel: f.registro.campos.responsavel || "", motivo: f.motivo, linha: f.registro.linhaBase });
      });
    }
    ETAPAS_BOOK.filter((etapa) => this.ETAPAS.some((e) => e.id === etapa.id)).forEach((etapa) => {
      materiais.forEach((b) => {
        const r = Pendencias.etapa(b, etapa.id);
        if (r.estado === Pendencias.ESTADO) lista.push({ etapa: etapa.id, material: b, frente: "", responsavel: "", motivo: r.motivo, linha: "" });
      });
    });
    return { lista, disponivel };
  },

  calcular() {
    const base = this.base();
    const f = this.filtros;
    const materiais = base.filter((b) => ["colecao", "ano", "entrega", "modulo"].every((g) => !f[g] || this.valor(g, b) === f[g]));
    const { lista, disponivel } = this.itens(materiais);
    const porEtapa = Object.fromEntries(this.ETAPAS.map((e) => [e.id, 0]));
    lista.forEach((i) => { porEtapa[i.etapa] += 1; });
    return { base, lista, disponivel, porEtapa };
  },

  secaoOrigem() {
    return EntregasView.escopo === "visao" ? "Visão Geral" : CiclosEntrega.nomeCiclo(EntregasView.entrega);
  },

  filtrosOrigemTexto() {
    const nomes = { colecao: "Coleção", ano: "Ano", tipo: "Tipo", situacao: "Situação", entrega: "Entrega", modulo: "Módulo" };
    return Object.entries(this.filtrosOrigem()).filter(([, v]) => v.length).map(([k, v]) => `${nomes[k]}: ${v.map((x) => EntregasView.rotuloOpcao(k, x)).join(", ")}`);
  },

  descricaoOrigem() {
    const ativos = this.filtrosOrigemTexto();
    const secao = this.secaoOrigem();
    return ativos.length ? `Origem: ${secao} · filtros da seção aplicados (${ativos.join(" · ")})` : `Origem: ${secao} · sem filtros na seção`;
  },

  progressoChecklist(material) {
    const total = material.checklist ? material.checklist.total : 0;
    const concluidos = material.checklist ? material.checklist.concluido : 0;
    if (!total) return { concluidos, total, percentual: null };
    return { concluidos, total, percentual: (concluidos / total) * 100 };
  },

  formatarPercentual(valor) {
    return valor === null ? "—" : `${valor.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%`;
  },

  priorizarChecklist(lista) {
    const ordemColecao = (b) => { const i = this.ORDEM_COLECOES.indexOf(Materiais.semAcento(b.colecao)); return i < 0 ? this.ORDEM_COLECOES.length : i; };
    const ano = (b) => Number(Materiais.canonAno(b.ano)) || 0;
    const modulo = (b) => EntregasView.ordemModulo(EntregasView.moduloCurto(b.modulo));
    return lista.map((i) => ({ i, p: this.progressoChecklist(i.material) })).sort((x, y) =>
      y.p.concluidos - x.p.concluidos ||
      (x.p.total - x.p.concluidos) - (y.p.total - y.p.concluidos) ||
      ordemColecao(x.i.material) - ordemColecao(y.i.material) ||
      Materiais.semAcento(x.i.material.colecao).localeCompare(Materiais.semAcento(y.i.material.colecao)) ||
      ano(y.i.material) - ano(x.i.material) ||
      String(x.i.frente).localeCompare(String(y.i.frente), "pt-BR") ||
      modulo(x.i.material) - modulo(y.i.material) ||
      String(x.i.material.id).localeCompare(String(y.i.material.id))
    ).map(({ i, p }, indice) => ({ item: i, progresso: p, prioridade: indice + 1 }));
  },

  conteudoRelatorio() {
    const secoes = this.ETAPAS.filter((e) => this.disponiveis.includes(e.id) && this.selecionadas.has(e.id)).map((etapa) => {
      const checklist = etapa.id === "checklist";
      const doEtapa = this.dados.lista.filter((i) => i.etapa === etapa.id);
      const base = checklist ? this.priorizarChecklist(doEtapa) : this.ordenarRegistros(doEtapa).map((i) => ({ item: i }));
      const registros = base.map((r) => ({
        ...r,
        colecao: r.item.material.colecao,
        ano: r.item.material.ano,
        texto: checklist ? `${r.item.frente || "Frente não informada"} — ${EntregasView.moduloCurto(r.item.material.modulo)}` : r.item.material.nome
      }));
      return { etapa, checklist, registros };
    });
    return {
      secoes,
      total: secoes.reduce((t, s) => t + s.registros.length, 0),
      secao: this.secaoOrigem(),
      filtros: this.filtrosOrigemTexto()
    };
  },

  textoTotal(total, atividades) {
    return `${this.n(total)} ${total === 1 ? "pendência" : "pendências"} em ${this.n(atividades)} ${atividades === 1 ? "atividade" : "atividades"}`;
  },

  dataHora(data) {
    return `${data.toLocaleDateString("pt-BR")} às ${data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
  },

  atualizarCabecalhoImpressao(conteudo) {
    const alvo = Utils.qs("#relatorioImpressao", this.dialogo);
    if (!alvo) return;
    const filtros = conteudo.filtros.length ? conteudo.filtros.join(" · ") : "Nenhum";
    alvo.innerHTML = `
      <div class="relatorio__impressao-topo">
        <img src="assets/gge-logo.png" alt="GGE" width="120" height="40">
        <div>
          <p class="relatorio__impressao-marca">SGGE-PCP | ARTE FINALIZAÇÃO</p>
          <h2 class="relatorio__impressao-titulo">RELATÓRIO DE ATIVIDADES PENDENTES</h2>
        </div>
      </div>
      <dl class="relatorio__impressao-info">
        <div><dt>Gerado em</dt><dd>${this.e(this.dataHora(new Date()))}</dd></div>
        <div><dt>Seção de origem</dt><dd>${this.e(conteudo.secao)}</dd></div>
        <div><dt>Filtros herdados</dt><dd>${this.e(filtros)}</dd></div>
        <div><dt>Atividades selecionadas</dt><dd>${this.n(conteudo.secoes.length)}</dd></div>
        <div><dt>Total de pendências</dt><dd>${this.n(conteudo.total)}</dd></div>
      </dl>`;
  },

  imprimir() {
    const conteudo = this.conteudoRelatorio();
    if (!conteudo.secoes.length) return;
    this.atualizarCabecalhoImpressao(conteudo);
    window.print();
  },

  async salvar(botao) {
    const conteudo = this.conteudoRelatorio();
    if (!conteudo.secoes.length || (botao && botao.disabled)) return;
    if (botao) {
      botao.disabled = true;
      botao.setAttribute("aria-busy", "true");
    }
    try {
      const data = new Date();
      await RelatorioPdf.baixar(conteudo, data, { nomeArquivo: RelatorioPdf.nomeArquivo({ tipo: "pendencias", escopo: EntregasView.escopo, entrega: EntregasView.entrega, data }) });
    } finally {
      if (botao) {
        botao.disabled = false;
        botao.removeAttribute("aria-busy");
      }
    }
  },

  renderizar(foco) {
    this.dados = this.calcular();
    const { porEtapa } = this.dados;
    const disponiveis = this.ETAPAS.filter((e) => porEtapa[e.id] > 0).map((e) => e.id);
    this.selecionadas = new Set(disponiveis.filter((id) => this.selecionadas.has(id)));
    this.disponiveis = disponiveis;
    const opcao = (e) => `
      <label class="relatorio__opcao">
        <input type="checkbox" data-atividade="${e.id}"${this.selecionadas.has(e.id) ? " checked" : ""}>
        <span class="relatorio__marcador" style="--cor-atividade: ${e.cor}" aria-hidden="true"></span>
        <span class="relatorio__opcao-nome">${this.e(e.nome)}</span>
        <span class="relatorio__opcao-contagem" aria-label="${this.e(`${porEtapa[e.id]} ${porEtapa[e.id] === 1 ? "pendência" : "pendências"}`)}">${this.n(porEtapa[e.id])}</span>
      </label>`;
    const corpo = disponiveis.length ? `
        <fieldset class="relatorio__selecao">
          <legend class="relatorio__legenda">Atividades com pendências</legend>
          <label class="relatorio__opcao relatorio__opcao--todas">
            <input type="checkbox" data-atividades-todas>
            <span class="relatorio__opcao-nome">Selecionar todas</span>
          </label>
          <div class="relatorio__opcoes">${this.ETAPAS.filter((e) => disponiveis.includes(e.id)).map(opcao).join("")}</div>
        </fieldset>
        <div class="relatorio__resumo" id="centralContagem" role="status" aria-live="polite"></div>
        <div id="centralTabela" class="relatorio__secoes"></div>
        <footer class="relatorio__rodape">
          <button type="button" class="relatorio__acao relatorio__acao--salvar" data-salvar-relatorio>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11"/><path d="m7 10 5 5 5-5"/><path d="M5 19h14"/></svg>
            <span>Salvar</span>
          </button>
          <button type="button" class="relatorio__acao relatorio__acao--imprimir" data-imprimir-relatorio>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 9V4h10v5"/><rect x="4" y="9" width="16" height="8" rx="2"/><path d="M7 14h10v6H7z"/></svg>
            <span>Imprimir</span>
          </button>
        </footer>` : `
        <div class="central__vazio relatorio__sem-pendencias" role="status">
          <strong>Nenhuma atividade pendente.</strong>
          <span>Não existem atividades liberadas aguardando execução no escopo consultado.</span>
        </div>`;
    this.conteudo.innerHTML = `
      <header class="detalhe__cabecalho central__cabecalho">
        <div class="central__titulos">
          <h2 class="detalhe__titulo relatorio__titulo" id="centralPendenciasTitulo"><img class="central__icone" src="assets/pendentes.png" alt="" width="24" height="24">RELATÓRIO DE ATIVIDADES PENDENTES</h2>
          <p class="central__subtitulo">Selecione as atividades que deseja consultar.</p>
        </div>
        <button type="button" class="detalhe__fechar" data-fechar-central aria-label="Fechar relatório de atividades pendentes">${ICONES_ENTREGA.fechar}</button>
      </header>
      <div class="detalhe__corpo central__corpo">
        <div class="relatorio__impressao" id="relatorioImpressao"></div>
        <p class="central__origem">${this.e(this.descricaoOrigem())}</p>
        ${this.dados.disponivel ? "" : `<div class="aviso" role="note">${ICONES.alerta}<p><strong>Checklist indisponível.</strong> A API não informou statusMaterial (coluna Y); as pendências de checklist não podem ser calculadas.</p></div>`}
        ${corpo}
      </div>`;
    this.atualizarSelecao();
    this.renderizarTabela();
    if (foco) {
      const alvo = Utils.qs(foco, this.dialogo);
      if (alvo) alvo.focus();
    }
  },

  atualizarSelecao() {
    const todas = Utils.qs("[data-atividades-todas]", this.dialogo);
    if (!todas) return;
    const marcadas = this.disponiveis.filter((id) => this.selecionadas.has(id)).length;
    todas.checked = marcadas === this.disponiveis.length;
    todas.indeterminate = marcadas > 0 && marcadas < this.disponiveis.length;
  },

  ordenarRegistros(lista) {
    const ordemColecao = (b) => { const i = this.ORDEM_COLECOES.indexOf(Materiais.semAcento(b.colecao)); return i < 0 ? this.ORDEM_COLECOES.length : i; };
    const ano = (b) => Number(Materiais.canonAno(b.ano)) || 0;
    const modulo = (b) => EntregasView.ordemModulo(EntregasView.moduloCurto(b.modulo));
    return lista.slice().sort((x, y) =>
      ordemColecao(x.material) - ordemColecao(y.material) ||
      Materiais.semAcento(x.material.colecao).localeCompare(Materiais.semAcento(y.material.colecao)) ||
      ano(y.material) - ano(x.material) ||
      modulo(x.material) - modulo(y.material) ||
      String(x.frente || x.material.nome).localeCompare(String(y.frente || y.material.nome), "pt-BR"));
  },

  renderizarTabela() {
    const alvo = Utils.qs("#centralTabela", this.dialogo);
    if (!alvo || !this.dados) return;
    const conteudo = this.conteudoRelatorio();
    Utils.qs("#centralContagem", this.dialogo).textContent = conteudo.secoes.length
      ? this.textoTotal(conteudo.total, conteudo.secoes.length)
      : "Selecione uma ou mais atividades para visualizar suas pendências.";
    Utils.qsa("[data-salvar-relatorio], [data-imprimir-relatorio]", this.dialogo).forEach((b) => { b.disabled = !conteudo.secoes.length; });
    this.atualizarCabecalhoImpressao(conteudo);
    alvo.innerHTML = conteudo.secoes.map(({ etapa, checklist, registros }) => {
      const botao = (i, texto) => `<button type="button" class="relatorio__registro" data-detalhe-central data-material="${this.e(i.material.id)}" data-etapa-pendente="${etapa.id}" data-frente="${this.e(i.frente)}" title="${this.e(i.motivo)}" aria-label="${this.e(`${texto} · ${i.material.colecao} ${i.material.ano} · consultar detalhamento`)}">${this.e(texto)}</button>`;
      const progresso = (p) => p.percentual === null
        ? '<span class="relatorio__progresso-indisponivel">Progresso indisponível</span>'
        : `<div class="relatorio__progresso" role="img" aria-label="${this.e(`${p.concluidos} de ${p.total} checklists concluídos no livro, ${this.formatarPercentual(p.percentual)}`)}">
                <span class="relatorio__progresso-topo"><span>${p.concluidos}/${p.total}</span><span>${this.formatarPercentual(p.percentual)}</span></span>
                <span class="relatorio__progresso-trilho"><span style="width:${p.percentual.toFixed(4)}%"></span></span>
              </div>`;
      const linha = ({ item: i, texto, progresso: p, prioridade }) => checklist ? `
          <tr data-etapa="${etapa.id}" data-material-id="${this.e(i.material.id)}" data-colecao="${this.e(Materiais.semAcento(i.material.colecao))}" data-ano="${this.e(i.material.ano)}" data-prioridade="${prioridade}" data-concluidos="${p.concluidos}" data-total="${p.total}">
            <td><span class="relatorio__prioridade${prioridade === 1 ? " relatorio__prioridade--primeira" : ""}">${prioridade}º</span></td>
            <td class="relatorio__col-secundaria">${this.e(i.material.colecao)}</td>
            <td class="relatorio__col-secundaria">${this.e(i.material.ano)}</td>
            <td>${botao(i, texto)}<span class="relatorio__meta-mobile">${this.e(i.material.colecao)} · ${this.e(i.material.ano)}</span></td>
            <td>${progresso(p)}</td>
          </tr>` : `
          <tr data-etapa="${etapa.id}" data-material-id="${this.e(i.material.id)}" data-colecao="${this.e(Materiais.semAcento(i.material.colecao))}" data-ano="${this.e(i.material.ano)}">
            <td>${this.e(i.material.colecao)}</td>
            <td>${this.e(i.material.ano)}</td>
            <td>${botao(i, texto)}</td>
          </tr>`;
      return `
        <section class="relatorio__secao" data-secao-etapa="${etapa.id}" style="--cor-atividade: ${etapa.cor}" aria-labelledby="relatorio-${etapa.id}">
          <header class="relatorio__faixa">
            <h3 class="relatorio__faixa-titulo" id="relatorio-${etapa.id}">${this.e(etapa.nome.toUpperCase())}</h3>
            <span class="relatorio__faixa-total">${this.n(registros.length)} ${registros.length === 1 ? "PENDÊNCIA" : "PENDÊNCIAS"}</span>
          </header>
          <table class="relatorio__tabela${checklist ? " relatorio__tabela--prioridade" : ""}">
            <thead><tr>${checklist
              ? '<th scope="col">Prioridade</th><th scope="col" class="relatorio__col-secundaria">Coleção</th><th scope="col" class="relatorio__col-secundaria">Ano</th><th scope="col">Frente / Módulo</th><th scope="col">Progresso do checklist</th>'
              : '<th scope="col">Coleção</th><th scope="col">Ano</th><th scope="col">Material</th>'}</tr></thead>
            <tbody>${registros.map(linha).join("")}</tbody>
          </table>
        </section>`;
    }).join("");
  },

  abrirDetalhe(botao) {
    const id = botao.dataset.material;
    const etapa = botao.dataset.etapaPendente;
    const item = this.dados.lista.find((i) => i.material.id === id && i.etapa === etapa && i.frente === botao.dataset.frente);
    EntregasView.abrirAcompanhamento(id, botao);
    const corpo = Utils.qs("#detalheConteudo .detalhe__corpo");
    if (!corpo || !item) return;
    const indice = etapa === "checklist" ? 0 : 1 + ETAPAS_BOOK.findIndex((e) => e.id === etapa);
    const marcada = Utils.qsa("#detalheConteudo .acomp__etapa")[indice];
    if (marcada) {
      marcada.classList.add("acomp__etapa--pendente-central");
      marcada.setAttribute("aria-current", "step");
    }
    corpo.insertAdjacentHTML("afterbegin", `
      <div class="central__contexto" role="note">
        <img src="assets/pendentes.png" alt="" width="22" height="22">
        <p><strong>Pendência selecionada: ${this.e(this.rotulo("etapa", etapa))}${item.frente ? ` · ${this.e(item.frente)}` : ""}</strong><span>${this.e(item.motivo)}. Feche este detalhamento para retornar ao relatório.</span></p>
      </div>`);
    if (etapa === "checklist") {
      const frentes = Utils.qs("#detalheConteudo .acomp__frentes");
      if (frentes) frentes.open = true;
    }
  }
};
