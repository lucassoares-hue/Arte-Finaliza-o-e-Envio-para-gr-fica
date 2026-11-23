const App = {
  estado: {
    registros: [],
    processamento: null,
    carregando: false,
    erro: null,
    atualizadoEm: null
  },

  init() {
    this.sidebar = Utils.qs("#sidebar");
    this.overlay = Utils.qs("#sidebarOverlay");
    this.toggle = Utils.qs("#sidebarToggle");
    this.botaoAtualizar = Utils.qs("#btnAtualizar");

    this.configurarTema();
    this.configurarMenu();
    this.configurarRecolhimento();
    this.configurarNavegacao();
    this.botaoAtualizar.addEventListener("click", () => this.carregarDados());
    Utils.qs("#btnTentarNovamente").addEventListener("click", () => this.carregarDados());
    this.progressoAbertura(10);

    this.carregarDados();
  },

  abrirMenu() {
    this.sidebar.classList.add("is-open");
    this.overlay.hidden = false;
    this.toggle.setAttribute("aria-expanded", "true");
    this.toggle.setAttribute("aria-label", "Fechar menu");
  },

  fecharMenu() {
    this.sidebar.classList.remove("is-open");
    this.overlay.hidden = true;
    this.toggle.setAttribute("aria-expanded", "false");
    this.toggle.setAttribute("aria-label", "Abrir menu");
  },

  configurarMenu() {
    this.toggle.addEventListener("click", () => {
      if (this.sidebar.classList.contains("is-open")) {
        this.fecharMenu();
      } else {
        this.abrirMenu();
      }
    });

    this.overlay.addEventListener("click", () => this.fecharMenu());

    document.addEventListener("keydown", (evento) => {
      if (evento.key === "Escape" && this.sidebar.classList.contains("is-open")) {
        this.fecharMenu();
        this.toggle.focus();
      }
    });

    window.addEventListener("resize", () => {
      if (!Utils.ehMobile()) this.fecharMenu();
    });
  },

  CHAVE_SIDEBAR: "sgge-pcp.sidebar",

  CHAVE_TEMA: "sgge-pcp.tema",

  configurarTema() {
    this.botaoTema = Utils.qs("#btnTema");
    this.aplicarTema(document.documentElement.getAttribute("data-theme") === "dark", false);
    this.botaoTema.addEventListener("click", () => {
      this.aplicarTema(document.documentElement.getAttribute("data-theme") !== "dark", true);
    });
  },

  aplicarTema(escuro, salvar) {
    document.documentElement.setAttribute("data-theme", escuro ? "dark" : "light");
    this.botaoTema.setAttribute("aria-pressed", String(escuro));
    this.botaoTema.title = escuro ? "Ativar modo claro" : "Ativar modo escuro";
    if (!salvar) return;
    try {
      localStorage.setItem(this.CHAVE_TEMA, escuro ? "escuro" : "claro");
    } catch (e) {}
  },

  configurarRecolhimento() {
    this.raiz = document.documentElement;
    this.botaoRecolher = Utils.qs("#sidebarRecolher");
    this.grupoEntregas = Utils.qs("#grupoEntregas");
    this.toggleEntregas = Utils.qs("#toggleEntregas");
    this.menuEntregas = Utils.qs("#menuEntregas");
    this.entregasAbertas = true;

    this.aplicarRecolhimento(this.raiz.classList.contains("sidebar-recolhido"), false);

    this.botaoRecolher.addEventListener("click", () => {
      this.aplicarRecolhimento(!this.raiz.classList.contains("sidebar-recolhido"), true);
    });

    document.addEventListener("click", (evento) => {
      if (this.flyoutAberto() && !this.grupoEntregas.contains(evento.target)) this.fecharFlyout(false);
    });

    document.addEventListener("keydown", (evento) => {
      if (evento.key === "Escape" && this.flyoutAberto()) this.fecharFlyout(true);
    });

    this.grupoEntregas.addEventListener("focusout", (evento) => {
      if (this.flyoutAberto() && evento.relatedTarget && !this.grupoEntregas.contains(evento.relatedTarget)) this.fecharFlyout(false);
    });

    window.addEventListener("resize", () => {
      if (this.flyoutAberto()) this.fecharFlyout(false);
      this.sincronizarGrupoEntregas();
    });
  },

  estaRecolhido() {
    return this.raiz.classList.contains("sidebar-recolhido") && !Utils.ehMobile();
  },

  aplicarRecolhimento(recolher, salvar) {
    this.fecharFlyout(false);
    this.raiz.classList.toggle("sidebar-recolhido", recolher);
    const rotulo = recolher ? "Expandir menu" : "Recolher menu";
    this.botaoRecolher.setAttribute("aria-expanded", String(!recolher));
    this.botaoRecolher.setAttribute("aria-label", rotulo);
    this.botaoRecolher.title = rotulo;
    Utils.qsa(".sidebar__link, .sidebar__grupo-toggle").forEach((el) => {
      const texto = Utils.qs(".sidebar__texto", el);
      if (recolher && texto) {
        el.title = texto.textContent.trim();
      } else {
        el.removeAttribute("title");
      }
    });
    this.sincronizarGrupoEntregas();
    if (salvar) {
      try {
        localStorage.setItem(this.CHAVE_SIDEBAR, recolher ? "recolhido" : "expandido");
      } catch (erro) {}
    }
  },

  sincronizarGrupoEntregas() {
    if (this.estaRecolhido()) {
      this.toggleEntregas.setAttribute("aria-expanded", String(this.flyoutAberto()));
    } else {
      this.toggleEntregas.setAttribute("aria-expanded", String(this.entregasAbertas));
      this.menuEntregas.hidden = !this.entregasAbertas;
    }
  },

  flyoutAberto() {
    return Boolean(this.grupoEntregas) && this.grupoEntregas.classList.contains("is-flyout");
  },

  abrirFlyout() {
    this.grupoEntregas.classList.add("is-flyout");
    const base = this.toggleEntregas.getBoundingClientRect();
    const altura = this.menuEntregas.getBoundingClientRect().height;
    const topo = Math.max(8, Math.min(base.top, window.innerHeight - altura - 8));
    this.menuEntregas.style.top = `${Math.round(topo)}px`;
    this.toggleEntregas.setAttribute("aria-expanded", "true");
    const alvo = Utils.qs(".sidebar__link.is-active", this.menuEntregas) || Utils.qs(".sidebar__link", this.menuEntregas);
    if (alvo) alvo.focus();
  },

  fecharFlyout(devolverFoco) {
    if (!this.flyoutAberto()) return;
    this.grupoEntregas.classList.remove("is-flyout");
    this.menuEntregas.style.top = "";
    this.toggleEntregas.setAttribute("aria-expanded", "false");
    if (devolverFoco) this.toggleEntregas.focus();
  },

  configurarNavegacao() {
    EntregasView.init();
    CentralPendencias.init();

    Utils.qsa(".sidebar__link").forEach((link) => {
      link.addEventListener("click", (evento) => {
        evento.preventDefault();
        const secao = link.dataset.section;
        const entrega = link.dataset.entrega || "";
        this.mostrarSecao(secao, entrega);
        history.replaceState(null, "", entrega ? `#${secao}-${entrega}` : `#${secao}`);
        this.fecharFlyout(false);
        if (Utils.ehMobile()) this.fecharMenu();
      });
    });

    this.toggleEntregas.addEventListener("click", () => {
      if (this.estaRecolhido()) {
        if (this.flyoutAberto()) {
          this.fecharFlyout(true);
        } else {
          this.abrirFlyout();
        }
        return;
      }
      this.entregasAbertas = !this.entregasAbertas;
      this.sincronizarGrupoEntregas();
    });

    const inicial = window.location.hash.replace("#", "");
    const entregaInicial = inicial.match(/^entregas-([1-4])$/);
    if (entregaInicial) {
      this.mostrarSecao("entregas", entregaInicial[1]);
    } else if (inicial && Utils.qs(`.section[data-section="${CSS.escape(inicial)}"]`)) {
      this.mostrarSecao(inicial);
    }
  },

  mostrarSecao(nome, entrega = "") {
    EntregasView.definirEscopo(nome);
    Utils.qsa(".section").forEach((secao) => {
      secao.classList.toggle("is-active", secao.dataset.section === nome);
    });
    if (nome === "entregas") {
      EntregasView.selecionar(entrega || 1);
    } else {
      Utils.qs("#topbarTitulo").textContent = nome === "visao-geral" ? "Visão Geral" : "Entregas e Produtividade";
    }
    const entregaAtiva = nome === "entregas" ? String(entrega || 1) : "";
    Utils.qs("#toggleEntregas").classList.toggle("has-ativo", Boolean(entregaAtiva));
    Utils.qs("#grupoEntregasNumero").textContent = entregaAtiva;
    Utils.qsa(".sidebar__link").forEach((link) => {
      const ativo = link.dataset.section === nome && (link.dataset.entrega || "") === String(entrega || (nome === "entregas" ? 1 : ""));
      link.classList.toggle("is-active", ativo);
      if (ativo) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  },

  async carregarDados() {
    if (this.estado.carregando) return;

    this.estado.carregando = true;
    this.estado.erro = null;
    this.atualizarInterface();
    const abertura = Boolean(Utils.qs("#abertura"));

    try {
      if (abertura) await this.marcoAbertura(20);
      const registros = await Api.buscarDados();
      if (abertura) await this.marcoAbertura(65);
      this.estado.processamento = Indicadores.processar(registros);
      this.estado.registros = registros;
      this.estado.atualizadoEm = new Date();
      if (abertura) await this.marcoAbertura(85);
    } catch (erro) {
      this.estado.erro = erro.message || "Erro desconhecido.";
    } finally {
      this.estado.carregando = false;
      this.atualizarInterface();
      if (abertura && !this.estado.erro) await this.marcoAbertura(100);
      this.encerrarAbertura();
    }
  },

  progressoAbertura(valor) {
    const barra = Utils.qs("#aberturaBarra");
    if (!barra) return;
    const atual = Number(barra.getAttribute("aria-valuenow")) || 0;
    const novo = Math.max(atual, Math.min(100, Math.round(valor)));
    barra.setAttribute("aria-valuenow", String(novo));
    Utils.qs("#aberturaPreenchimento").style.width = `${novo}%`;
    Utils.qs("#aberturaPercentual").textContent = `${novo}%`;
  },

  marcoAbertura(valor) {
    this.progressoAbertura(valor);
    return new Promise((resolver) => requestAnimationFrame(() => resolver()));
  },

  encerrarAbertura() {
    const abertura = Utils.qs("#abertura");
    if (!abertura || abertura.classList.contains("is-saindo")) return;
    const remover = () => {
      abertura.remove();
      document.documentElement.classList.remove("abertura-ativa");
    };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      remover();
      return;
    }
    abertura.classList.add("is-saindo");
    abertura.setAttribute("aria-hidden", "true");
    abertura.addEventListener("transitionend", remover, { once: true });
    setTimeout(remover, 800);
  },

  obterRegistros() {
    return this.estado.registros.slice();
  },

  obterProcessamento() {
    return this.estado.processamento;
  },

  atualizarStatus(tipo, texto) {
    const status = Utils.qs("#apiStatus");
    status.dataset.state = tipo;
    Utils.qs(".topbar__status-text", status).textContent = texto;
    status.title = texto;
  },

  renderizarVisao() {
    const { processamento, registros, erro } = this.estado;
    if (erro || !processamento || !registros.length) return;
    const visao = EntregasView.procVisao(processamento);
    Indicadores.renderizar(visao);
    Graficos.renderizar(visao);
  },

  atualizarInterface() {
    const { carregando, erro, registros, atualizadoEm, processamento } = this.estado;
    const loading = Utils.qs("#loadingState");
    const erroEl = Utils.qs("#errorState");
    const vazio = Utils.qs("#emptyState");
    const dashboard = Utils.qs("#dashboard");

    this.botaoAtualizar.disabled = carregando;
    this.botaoAtualizar.classList.toggle("is-loading", carregando);
    this.botaoAtualizar.setAttribute("aria-busy", String(carregando));

    const temDados = Boolean(processamento) && registros.length > 0;
    dashboard.hidden = Boolean(erro) || !temDados;
    dashboard.setAttribute("aria-busy", String(carregando));
    if (!carregando && !erro) {
      const visao = temDados ? EntregasView.procVisao(processamento) : null;
      Indicadores.renderizar(visao);
      Graficos.renderizar(visao);
    }
    EntregasView.atualizar(temDados ? processamento : null, { carregando, erro });
    if (!carregando) CentralPendencias.atualizar();

    loading.hidden = !carregando || temDados;
    erroEl.hidden = carregando || !erro;
    vazio.hidden = carregando || Boolean(erro) || registros.length > 0;

    if (carregando) {
      this.atualizarStatus("conectando", "Conectando...");
      return;
    }

    if (erro) {
      this.atualizarStatus("erro", "Erro na conexão");
      Utils.qs("#errorMessage").textContent = erro;
      return;
    }

    const total = Utils.formatarNumero(registros.length);
    const sufixo = registros.length === 1 ? "registro" : "registros";
    this.atualizarStatus("conectado", `API conectada · ${total} ${sufixo}`);

    const atualizado = Utils.qs("#lastUpdate");
    if (atualizado && atualizadoEm) {
      atualizado.textContent = `Atualizado às ${atualizadoEm.toLocaleTimeString("pt-BR")}`;
      atualizado.hidden = false;
    }
  }
};

document.addEventListener("DOMContentLoaded", () => App.init());
