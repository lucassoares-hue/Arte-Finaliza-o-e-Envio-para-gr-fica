const Utils = {
  qs(seletor, contexto = document) {
    return contexto.querySelector(seletor);
  },

  qsa(seletor, contexto = document) {
    return Array.from(contexto.querySelectorAll(seletor));
  },

  escaparHtml(valor) {
    return String(valor ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  },

  formatarNumero(valor) {
    return new Intl.NumberFormat("pt-BR").format(Number(valor) || 0);
  },

  formatarData(valor) {
    const data = valor instanceof Date ? valor : new Date(valor);
    return Number.isNaN(data.getTime()) ? "" : data.toLocaleDateString("pt-BR");
  },

  ehMobile() {
    return window.innerWidth <= CONFIG.BREAKPOINT_MENU;
  }
};
