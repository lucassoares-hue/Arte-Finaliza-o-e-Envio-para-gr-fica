const CAMPOS_OFICIAIS_ARTE = Object.freeze([
  "ano", "colecao", "frente", "modulo", "responsavel",
  "inicioProducao", "previstoProducao", "fimProducao",
  "book", "inicioBook", "fimBook",
  "enviadoBoneca", "dataEnvioBoneca", "chegadaBoneca", "verificacaoQr",
  "ajusteFinal", "inicioAjusteFinal", "fimAjusteFinal",
  "envioGrafica", "dataEnvioGrafica",
  "separatas", "dataSeparatas",
  "gabarito", "dataGabarito"
]);

function letraColunaArte_(numero) {
  let letra = "";
  let n = numero;
  while (n > 0) {
    const resto = (n - 1) % 26;
    letra = String.fromCharCode(65 + resto) + letra;
    n = Math.floor((n - 1) / 26);
  }
  return letra;
}

function chaveCampoAdicionalArte_(cabecalho, letra, usadas) {
  const partes = String(cabecalho || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  let base = partes.map((p, i) => (i === 0 ? p.toLowerCase() : p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())).join("");
  if (!base) base = "coluna" + letra;
  if (/^[0-9]/.test(base)) base = "c" + base;
  let chave = base;
  let contador = 2;
  while (usadas.has(chave.toLowerCase())) {
    chave = base + "_" + contador;
    contador += 1;
  }
  usadas.add(chave.toLowerCase());
  return chave;
}

function mapearCamposAdicionaisArte_(cabecalhos) {
  const usadas = new Set(CAMPOS_OFICIAIS_ARTE.concat(["linhaBase", "camposAdicionais"]).map((c) => c.toLowerCase()));
  return cabecalhos.slice(CAMPOS_OFICIAIS_ARTE.length).map((cabecalho, i) => {
    const numero = CAMPOS_OFICIAIS_ARTE.length + i + 1;
    const letra = letraColunaArte_(numero);
    return { chave: chaveCampoAdicionalArte_(cabecalho, letra, usadas), cabecalho: String(cabecalho || "").trim(), coluna: letra, indice: numero };
  });
}

function lerCamposAdicionaisArte_(aba, primeiraLinhaDados, totalLinhas) {
  const ultimaColuna = aba.getLastColumn();
  if (ultimaColuna <= CAMPOS_OFICIAIS_ARTE.length || totalLinhas <= 0) {
    return { mapa: [], valores: [] };
  }
  const cabecalhos = aba.getRange(1, 1, 1, ultimaColuna).getDisplayValues()[0];
  const mapa = mapearCamposAdicionaisArte_(cabecalhos);
  const valores = aba
    .getRange(primeiraLinhaDados, CAMPOS_OFICIAIS_ARTE.length + 1, totalLinhas, ultimaColuna - CAMPOS_OFICIAIS_ARTE.length)
    .getDisplayValues();
  return { mapa, valores };
}

function montarCamposAdicionaisArte_(mapa, linhaValores) {
  const objeto = {};
  mapa.forEach((campo, i) => {
    objeto[campo.chave] = linhaValores && linhaValores[i] !== undefined ? String(linhaValores[i]) : "";
  });
  return objeto;
}
