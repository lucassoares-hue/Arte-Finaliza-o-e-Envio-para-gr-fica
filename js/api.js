const Api = {
  estaConfigurada() {
    return typeof CONFIG.API_URL === "string" && CONFIG.API_URL.trim() !== "";
  },

  async requisitar(parametros = {}) {
    if (!this.estaConfigurada()) {
      throw new Error("URL da API não configurada em js/config.js.");
    }

    const url = new URL(CONFIG.API_URL);
    Object.entries(parametros).forEach(([chave, valor]) => {
      if (valor !== undefined && valor !== null && valor !== "") {
        url.searchParams.set(chave, valor);
      }
    });

    const controlador = new AbortController();
    const temporizador = setTimeout(() => controlador.abort(), CONFIG.API_TIMEOUT_MS);

    try {
      const resposta = await fetch(url.toString(), {
        method: "GET",
        cache: "no-store",
        signal: controlador.signal
      });

      if (!resposta.ok) {
        throw new Error(`Falha na API: HTTP ${resposta.status}.`);
      }

      try {
        return await resposta.json();
      } catch (erro) {
        throw new Error("A API retornou uma resposta que não é JSON válido.");
      }
    } catch (erro) {
      if (erro.name === "AbortError") {
        throw new Error("Tempo limite excedido ao consultar a API.");
      }
      if (erro instanceof TypeError) {
        throw new Error("Não foi possível conectar à API. Verifique a conexão.");
      }
      throw erro;
    } finally {
      clearTimeout(temporizador);
    }
  },

  validarCampos(registros) {
    const ausentes = CONFIG.CAMPOS_OBRIGATORIOS.filter((campo) =>
      !registros.some((registro) => Object.prototype.hasOwnProperty.call(registro, campo))
    );
    return { valido: ausentes.length === 0, ausentes };
  },

  async buscarDados(parametros = {}) {
    const json = await this.requisitar(parametros);

    if (!json || typeof json !== "object") {
      throw new Error("Resposta da API em formato inesperado.");
    }

    if (json.sucesso !== true) {
      throw new Error(json.mensagem || json.erro || "A API informou falha na consulta.");
    }

    if (!Array.isArray(json.dados)) {
      throw new Error("A propriedade 'dados' não foi encontrada na resposta.");
    }

    const registros = json.dados.filter((item) => item && typeof item === "object");

    if (registros.length > 0) {
      const validacao = this.validarCampos(registros);
      if (!validacao.valido) {
        throw new Error(`Campos ausentes na resposta: ${validacao.ausentes.join(", ")}.`);
      }
    }

    return registros;
  }
};
