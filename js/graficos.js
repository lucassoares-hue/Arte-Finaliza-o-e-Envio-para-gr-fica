const Graficos = {
  container() {
    return Utils.qs("#graficos");
  },

  limpar() {
    const alvo = this.container();
    if (alvo) alvo.innerHTML = "";
  },

  situacao(proc) {
    const contagem = proc.indicadores.books.situacoes;
    const ordem = [
      SITUACAO_BOOK.ENTREGUE,
      SITUACAO_BOOK.EM_PRODUCAO,
      SITUACAO_BOOK.NAO_INICIADO
    ];
    const total = ordem.reduce((s, x) => s + (contagem[x] || 0), 0);
    const raio = 40;
    const circ = 2 * Math.PI * raio;
    const presentes = ordem.filter((s) => contagem[s] > 0);
    const folga = presentes.length > 1 ? 1.6 : 0;
    const dica = (s) => `${SITUACAO_ROTULO[s]}: ${Dashboard.numero(contagem[s] || 0)} materiais (${Dashboard.percentual(contagem[s] || 0, total).toLocaleString("pt-BR")}%)`;
    let inicio = 0;
    const arcos = presentes.map((s) => {
      const comprimento = (contagem[s] / total) * circ;
      const visivel = Math.max(0.01, comprimento - folga);
      const arco = `<circle class="rosca__arco rosca__arco--${s}" cx="50" cy="50" r="${raio}" stroke-dasharray="${visivel.toFixed(3)} ${(circ - visivel).toFixed(3)}" stroke-dashoffset="${(-inicio).toFixed(3)}"><title>${Utils.escaparHtml(dica(s))}</title></circle>`;
      inicio += comprimento;
      return arco;
    }).join("");
    const legenda = ordem.map((s) => {
      const pct = Dashboard.percentual(contagem[s] || 0, total);
      return `
        <li class="legenda__item" title="${Utils.escaparHtml(dica(s))}">
          <span class="legenda__marca pilha__seg--${s}" aria-hidden="true"></span>
          <span class="legenda__rotulo">${SITUACAO_ROTULO[s]}</span>
          <span class="legenda__valor">${Dashboard.numero(contagem[s] || 0)}</span>
          <span class="legenda__pct">${pct.toLocaleString("pt-BR")}%</span>
        </li>`;
    }).join("");
    return `
      <article class="painel">
        <header class="painel__cabecalho">
          <h3 class="painel__titulo">Situação dos materiais</h3>
          <p class="painel__subtitulo">${Dashboard.numero(total)} materiais por situação geral</p>
        </header>
        <div class="rosca">
          <div class="rosca__grafico">
            <svg viewBox="0 0 100 100" role="img" aria-label="${Utils.escaparHtml(ordem.map((s) => dica(s)).join("; "))}">
              <circle class="rosca__trilha" cx="50" cy="50" r="${raio}"/>
              <g transform="rotate(-90 50 50)">${arcos}</g>
            </svg>
            <span class="rosca__centro" aria-hidden="true"><strong>${Dashboard.numero(total)}</strong><span>materiais</span></span>
          </div>
          <ul class="legenda rosca__legenda">${legenda}</ul>
        </div>
      </article>`;
  },

  progresso(proc) {
    const conf = proc.indicadores.books.confirmados;
    const total = conf.total;
    const linhas = ETAPAS_BOOK.map((etapa) => {
      const valor = conf[MAPA_INDICADOR_ETAPA[etapa.id]];
      const pct = Dashboard.percentual(valor, total);
      return `
        <li class="barras__linha">
          <span class="barras__rotulo">${Utils.escaparHtml(etapa.nome)}</span>
          <span class="barras__trilho" title="${Utils.escaparHtml(etapa.nome)}: ${Dashboard.numero(valor)} de ${Dashboard.numero(total)} (${pct.toLocaleString("pt-BR")}%)">
            <span class="barras__preenchimento" style="width:${pct}%"></span>
          </span>
          <span class="barras__valor">${Dashboard.numero(valor)}</span>
        </li>`;
    }).join("");
    return `
      <article class="painel">
        <header class="painel__cabecalho">
          <h3 class="painel__titulo">Progresso por etapa</h3>
          <p class="painel__subtitulo">Materiais confirmados que concluíram cada etapa · base ${Dashboard.numero(total)}</p>
        </header>
        <ol class="barras" aria-label="Progresso por etapa">${linhas}</ol>
        <div class="barras__eixo" aria-hidden="true"><span></span><span class="barras__escala"><span>0</span><span>${Dashboard.numero(total / 2)}</span><span>${Dashboard.numero(total)}</span></span><span></span></div>
      </article>`;
  },

  renderizar(proc) {
    const alvo = this.container();
    if (!alvo) return;
    alvo.innerHTML = proc ? this.situacao(proc) + this.progresso(proc) : "";
  }
};
