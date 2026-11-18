const CONFIG = Object.freeze({
  APP_NOME: "SGGE-PCP | Entregas e Produtividade",
  API_URL: "https://script.google.com/macros/s/AKfycbymuuD8rvFN13JDA8-RCopuEvO35-opQCFIvMmQ6WHpsMaXg-qpkpmiz01a-1FaSYic/exec",
  API_ABA: "BD-DADOS-ARTE",
  API_TIMEOUT_MS: 30000,
  BREAKPOINT_MENU: 1024,
  CAMPOS_OBRIGATORIOS: Object.freeze([
    "ano", "colecao", "frente", "modulo", "responsavel",
    "inicioProducao", "previstoProducao", "fimProducao",
    "book", "inicioBook", "fimBook",
    "enviadoBoneca", "dataEnvioBoneca", "chegadaBoneca", "verificacaoQr",
    "ajusteFinal", "inicioAjusteFinal", "fimAjusteFinal",
    "envioGrafica", "dataEnvioGrafica",
    "separatas", "dataSeparatas",
    "gabarito", "dataGabarito",
    "linhaBase"
  ])
});
