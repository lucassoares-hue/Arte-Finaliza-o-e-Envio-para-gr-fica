const Filtros = {
  estado: {},

  obter() {
    return { ...this.estado };
  },

  definir(chave, valor) {
    this.estado[chave] = valor;
  },

  limpar() {
    this.estado = {};
  }
};
