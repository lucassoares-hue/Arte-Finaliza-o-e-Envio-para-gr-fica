const RelatorioPdf = {
  LARGURA: 595.28,
  ALTURA: 841.89,
  MARGEM: 40,
  NAVY: [16, 28, 53],
  CINZA: [91, 101, 120],
  CINZA_CLARO: [244, 246, 250],
  BORDA: [226, 232, 240],

  ESPECIAIS: Object.freeze({
    "€": 0x80, "‚": 0x82, "ƒ": 0x83, "„": 0x84, "…": 0x85, "†": 0x86, "‡": 0x87, "ˆ": 0x88, "‰": 0x89, "Š": 0x8a, "‹": 0x8b, "Œ": 0x8c, "Ž": 0x8e,
    "‘": 0x91, "’": 0x92, "“": 0x93, "”": 0x94, "•": 0x95, "–": 0x96, "—": 0x97, "˜": 0x98, "™": 0x99, "š": 0x9a, "›": 0x9b, "œ": 0x9c, "ž": 0x9e, "Ÿ": 0x9f
  }),

  codificar(texto) {
    let saida = "";
    for (const c of String(texto ?? "")) {
      const codigo = c.codePointAt(0);
      let b = this.ESPECIAIS[c];
      if (b === undefined) b = codigo < 256 && (codigo < 0x80 || codigo > 0x9f) ? codigo : 0x3f;
      const ch = String.fromCharCode(b);
      saida += ch === "(" || ch === ")" || ch === "\\" ? `\\${ch}` : ch;
    }
    return saida;
  },

  LARGURAS: Object.freeze({
    regular: Object.freeze({
      " ": 278, a: 556, b: 556, c: 500, d: 556, e: 556, f: 278, g: 556, h: 556, i: 222, j: 222, k: 500, l: 222, m: 833, n: 556, o: 556, p: 556, q: 556, r: 333, s: 500, t: 278, u: 556, v: 500, w: 722, x: 500, y: 500, z: 500,
      A: 667, B: 667, C: 722, D: 722, E: 667, F: 611, G: 778, H: 722, I: 278, J: 500, K: 667, L: 556, M: 833, N: 722, O: 778, P: 667, Q: 778, R: 722, S: 667, T: 611, U: 722, V: 667, W: 944, X: 667, Y: 667, Z: 611,
      ".": 278, ",": 278, ":": 278, ";": 278, "/": 278, "-": 333, "(": 333, ")": 333, "·": 278, "º": 365, "ª": 370, "%": 889, "+": 584, "!": 278, "?": 556, "'": 191, "\"": 355, "&": 667, "|": 260, "—": 1000, "–": 556, "…": 1000, "_": 556
    }),
    negrito: Object.freeze({
      " ": 278, a: 556, b: 611, c: 556, d: 611, e: 556, f: 333, g: 611, h: 611, i: 278, j: 278, k: 556, l: 278, m: 889, n: 611, o: 611, p: 611, q: 611, r: 389, s: 556, t: 333, u: 611, v: 556, w: 778, x: 556, y: 556, z: 500,
      A: 722, B: 722, C: 722, D: 722, E: 667, F: 611, G: 778, H: 722, I: 278, J: 556, K: 722, L: 611, M: 833, N: 722, O: 778, P: 667, Q: 778, R: 722, S: 667, T: 611, U: 722, V: 667, W: 944, X: 667, Y: 667, Z: 611,
      ".": 278, ",": 278, ":": 333, ";": 333, "/": 278, "-": 333, "(": 333, ")": 333, "·": 278, "º": 365, "ª": 370, "%": 889, "+": 584, "!": 333, "?": 611, "'": 238, "\"": 474, "&": 722, "|": 280, "—": 1000, "–": 556, "…": 1000, "_": 556
    })
  }),

  larguraTexto(texto, tamanho, negrito) {
    const tabela = negrito ? this.LARGURAS.negrito : this.LARGURAS.regular;
    let total = 0;
    for (const c of String(texto ?? "")) {
      let w = tabela[c];
      if (w === undefined) {
        const base = c.normalize("NFD").charAt(0);
        w = tabela[base];
      }
      if (w === undefined) w = /[0-9]/.test(c) ? 556 : negrito ? 611 : 556;
      total += w;
    }
    return (total / 1000) * tamanho;
  },


  quebrar(texto, largura, tamanho, negrito) {
    const palavras = String(texto ?? "").split(/\s+/).filter(Boolean);
    const linhas = [];
    let atual = "";
    palavras.forEach((p) => {
      const teste = atual ? `${atual} ${p}` : p;
      if (this.larguraTexto(teste, tamanho, negrito) <= largura || !atual) atual = teste;
      else {
        linhas.push(atual);
        atual = p;
      }
    });
    if (atual) linhas.push(atual);
    return linhas.length ? linhas : [""];
  },

  hexRgb(hex) {
    const h = hex.replace("#", "");
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  },

  cor(rgb) {
    return rgb.map((v) => (v / 255).toFixed(3)).join(" ");
  },

  TIPOS_RELATORIO: {
    pendencias: "PENDENCIAS",
    livrosEnviados: "LIVROS_ENVIADOS"
  },

  registrarTipoRelatorio(chave, codigo) {
    this.TIPOS_RELATORIO[chave] = this.limparSegmento(codigo);
  },

  limparSegmento(texto) {
    return String(texto ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "").toUpperCase();
  },

  dataRecife(data) {
    const partes = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Recife", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(data).map((p) => [p.type, p.value]));
    return `${partes.year}-${partes.month}-${partes.day}`;
  },

  codigoEntrega(escopo, entrega) {
    return escopo === "visao" ? "GERAL" : `${Number(entrega)}_ENTREGA`;
  },

  nomeArquivo({ tipo, escopo, entrega, data }) {
    const codigo = this.TIPOS_RELATORIO[tipo];
    if (!codigo) throw new Error(`Tipo de relatório não cadastrado: ${tipo}`);
    return ["SGGE_ENTREGAS", codigo, this.codigoEntrega(escopo, entrega), this.dataRecife(data)].join("_") + ".pdf";
  },


  async carregarLogo() {
    try {
      const img = new Image();
      img.src = "assets/gge-logo.png";
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      const dados = atob(canvas.toDataURL("image/jpeg", 0.92).split(",")[1]);
      return { dados, largura: canvas.width, altura: canvas.height };
    } catch (erro) {
      return null;
    }
  },

  async gerar(conteudo, data, opcoes = {}) {
    const tituloRelatorio = opcoes.titulo || "RELATÓRIO DE ATIVIDADES PENDENTES";
    const logo = await this.carregarLogo();
    const paginas = [];
    const L = this.LARGURA;
    const H = this.ALTURA;
    const M = this.MARGEM;
    const util = L - M * 2;
    const limite = M + 28;
    let ops = null;
    let y = 0;

    const ret = (x, yTopo, w, h, rgb) => ops.push(`${this.cor(rgb)} rg ${x.toFixed(2)} ${(H - yTopo - h).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`);
    const linhaH = (x1, x2, yy, rgb) => ops.push(`${this.cor(rgb)} RG 0.6 w ${x1.toFixed(2)} ${(H - yy).toFixed(2)} m ${x2.toFixed(2)} ${(H - yy).toFixed(2)} l S`);
    const texto = (t, x, base, tamanho, negrito, rgb) => ops.push(`BT /${negrito ? "F2" : "F1"} ${tamanho} Tf ${this.cor(rgb)} rg ${x.toFixed(2)} ${(H - base).toFixed(2)} Td (${this.codificar(t)}) Tj ET`);
    const textoDireita = (t, xDir, base, tamanho, negrito, rgb) => texto(t, xDir - this.larguraTexto(t, tamanho, negrito), base, tamanho, negrito, rgb);

    const novaPagina = () => {
      ops = [];
      paginas.push(ops);
      y = M;
      if (paginas.length > 1) {
        texto(`SGGE-PCP | ${tituloRelatorio}`, M, y + 8, 8, true, this.CINZA);
        textoDireita(this.dataHoraTexto(data), M + util, y + 8, 8, false, this.CINZA);
        linhaH(M, M + util, y + 14, this.BORDA);
        y += 26;
      }
    };

    novaPagina();
    let xTitulo = M;
    if (logo) {
      const h = 40;
      const w = (logo.largura / logo.altura) * h;
      ops.push(`q ${w.toFixed(2)} 0 0 ${h.toFixed(2)} ${M.toFixed(2)} ${(H - y - h).toFixed(2)} cm /Logo Do Q`);
      xTitulo = M + w + 16;
    }
    texto("SGGE-PCP | ARTE FINALIZAÇÃO", xTitulo, y + 14, 9, true, this.hexRgb("#2563EB"));
    texto(tituloRelatorio, xTitulo, y + 34, 16, true, this.NAVY);
    y += 54;
    linhaH(M, M + util, y, this.NAVY);
    y += 16;

    const info = opcoes.info ? [["Gerado em", this.dataHoraTexto(data)], ...opcoes.info] : [
      ["Gerado em", this.dataHoraTexto(data)],
      ["Seção de origem", conteudo.secao],
      ["Filtros herdados", conteudo.filtros.length ? conteudo.filtros.join(" · ") : "Nenhum"],
      ["Atividades selecionadas", String(conteudo.secoes.length)],
      ["Total de pendências", conteudo.total.toLocaleString("pt-BR")]
    ];
    info.forEach(([rotulo, valor]) => {
      const linhas = this.quebrar(valor, util - 140, 9, false);
      texto(rotulo, M, y + 9, 9, true, this.CINZA);
      linhas.forEach((l, i) => texto(l, M + 140, y + 9 + i * 12, 9, false, this.NAVY));
      y += 12 * linhas.length + 3;
    });
    y += 12;

    const colunasPadrao = [{ x: M + 10, w: 110 }, { x: M + 130, w: 50 }, { x: M + 190, w: util - 200 }];
    const larguraProgresso = 120;
    const colunasPrioridade = [{ x: M + 10, w: 48 }, { x: M + 64, w: 64 }, { x: M + 132, w: 30 }, { x: M + 166, w: util - 166 - larguraProgresso - 22 }, { x: M + util - larguraProgresso - 10, w: larguraProgresso }];
    const tamanhoLinha = 9;
    const colunasPersonalizadas = (secao) => {
      const soma = secao.colunas.reduce((t, c) => t + c.peso, 0);
      const disponivel = util - 20 - (secao.colunas.length - 1) * 10;
      let x = M + 10;
      return secao.colunas.map((c) => {
        const w = (disponivel * c.peso) / soma;
        const coluna = { x, w, titulo: c.titulo, negrito: Boolean(c.negrito) };
        x += w + 10;
        return coluna;
      });
    };
    const colunasDe = (secao) => (secao.colunas ? colunasPersonalizadas(secao) : secao.checklist ? colunasPrioridade : colunasPadrao);
    const titulosDe = (secao) => (secao.colunas ? secao.colunas.map((c) => c.titulo.toUpperCase()) : secao.checklist ? ["PRIORIDADE", "COLEÇÃO", "ANO", "FRENTE / MÓDULO", "PROGRESSO DO CHECKLIST"] : ["COLEÇÃO", "ANO", "MATERIAL"]);
    const alturaRegistro = (secao, r) => {
      if (secao.colunas) {
        const c = colunasDe(secao);
        const celulas = r.celulas.map((v, i) => this.quebrar(v, c[i].w, tamanhoLinha, c[i].negrito));
        return { celulas, altura: Math.max(...celulas.map((l) => l.length)) * 11 + 7 };
      }
      const c = colunasDe(secao);
      const linhas = this.quebrar(r.texto, c[secao.checklist ? 3 : 2].w, tamanhoLinha, true);
      return { linhas, altura: Math.max(linhas.length * 11 + 7, secao.checklist ? 28 : 0) };
    };

    const faixa = (secao, continua) => {
      const cor = this.hexRgb(secao.etapa.cor);
      ret(M, y, util, 24, cor);
      const total = secao.totalTexto || `${secao.registros.length.toLocaleString("pt-BR")} ${secao.registros.length === 1 ? "PENDÊNCIA" : "PENDÊNCIAS"}`;
      texto(`${secao.etapa.nome.toUpperCase()}${continua ? " (continuação)" : ""}`, M + 10, y + 15.5, 10, true, [255, 255, 255]);
      textoDireita(total, M + util - 10, y + 15.5, 9, true, [255, 255, 255]);
      y += 24;
      const c = colunasDe(secao);
      const titulos = titulosDe(secao).map((t, i) => this.quebrar(t, c[i].w, 7, true));
      const alturaCabecalho = Math.max(18, Math.max(...titulos.map((l) => l.length)) * 9 + 9);
      ret(M, y, util, alturaCabecalho, this.CINZA_CLARO);
      titulos.forEach((ls, i) => ls.forEach((l, li) => texto(l, c[i].x, y + 12 + li * 9, 7, true, this.CINZA)));
      y += alturaCabecalho;
      linhaH(M, M + util, y, this.BORDA);
    };

    const progresso = (r, x, w) => {
      const p = r.progresso;
      if (!p || p.percentual === null) {
        texto("Progresso indisponível", x, y + 13, 8, false, this.CINZA);
        return;
      }
      const pct = `${p.percentual.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%`;
      texto(`${p.concluidos}/${p.total}`, x, y + 11, 8.5, true, this.NAVY);
      textoDireita(pct, x + w, y + 11, 8.5, true, this.NAVY);
      ret(x, y + 15, w, 5, [226, 232, 240]);
      if (p.percentual > 0) ret(x, y + 15, w * Math.min(1, p.percentual / 100), 5, this.hexRgb("#1D4ED8"));
    };

    conteudo.secoes.forEach((secao, indice) => {
      if (indice) y += 14;
      const primeira = secao.registros[0];
      const alturaPrimeira = primeira ? alturaRegistro(secao, primeira).altura : 0;
      if (y + 24 + 27 + alturaPrimeira > H - limite) novaPagina();
      faixa(secao, false);
      secao.registros.forEach((r) => {
        const { linhas, celulas, altura } = alturaRegistro(secao, r);
        if (y + altura > H - limite) {
          novaPagina();
          faixa(secao, true);
        }
        const c = colunasDe(secao);
        if (secao.colunas) {
          celulas.forEach((ls, ci) => ls.forEach((l, li) => texto(l, c[ci].x, y + 13 + li * 11, tamanhoLinha, c[ci].negrito, this.NAVY)));
        } else if (secao.checklist) {
          if (r.prioridade === 1) ret(c[0].x - 4, y + 4, 28, 14, [254, 243, 199]);
          texto(`${r.prioridade}º`, c[0].x, y + 14, tamanhoLinha, true, this.NAVY);
          texto(r.colecao, c[1].x, y + 14, tamanhoLinha, false, this.NAVY);
          texto(r.ano, c[2].x, y + 14, tamanhoLinha, false, this.NAVY);
          linhas.forEach((l, i) => texto(l, c[3].x, y + 14 + i * 11, tamanhoLinha, true, this.NAVY));
          progresso(r, c[4].x, c[4].w);
        } else {
          texto(r.colecao, c[0].x, y + 13, tamanhoLinha, false, this.NAVY);
          texto(r.ano, c[1].x, y + 13, tamanhoLinha, false, this.NAVY);
          linhas.forEach((l, i) => texto(l, c[2].x, y + 13 + i * 11, tamanhoLinha, true, this.NAVY));
        }
        y += altura;
        linhaH(M, M + util, y, this.BORDA);
      });
    });

    paginas.forEach((p, i) => {
      ops = p;
      textoDireita(`Página ${i + 1} de ${paginas.length}`, M + util, H - M + 10, 8, false, this.CINZA);
      texto("SGGE-PCP | Entregas e Produtividade", M, H - M + 10, 8, false, this.CINZA);
    });

    return this.montar(paginas, logo, tituloRelatorio);
  },

  dataHoraTexto(data) {
    return `${data.toLocaleDateString("pt-BR")} às ${data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
  },

  montar(paginas, logo, titulo = "RELATÓRIO DE ATIVIDADES PENDENTES") {
    const objetos = [];
    const adicionar = (conteudo) => {
      objetos.push(conteudo);
      return objetos.length;
    };
    const catalogo = adicionar(null);
    const raiz = adicionar(null);
    const f1 = adicionar("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
    const f2 = adicionar("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
    const imagem = logo
      ? adicionar(`<< /Type /XObject /Subtype /Image /Width ${logo.largura} /Height ${logo.altura} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${logo.dados.length} >>\nstream\n${logo.dados}\nendstream`)
      : 0;
    const recursos = `<< /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >>${imagem ? ` /XObject << /Logo ${imagem} 0 R >>` : ""} >>`;
    const filhos = paginas.map((ops) => {
      const fluxo = ops.join("\n");
      const conteudo = adicionar(`<< /Length ${fluxo.length} >>\nstream\n${fluxo}\nendstream`);
      return adicionar(`<< /Type /Page /Parent ${raiz} 0 R /MediaBox [0 0 ${this.LARGURA} ${this.ALTURA}] /Resources ${recursos} /Contents ${conteudo} 0 R >>`);
    });
    objetos[catalogo - 1] = `<< /Type /Catalog /Pages ${raiz} 0 R >>`;
    objetos[raiz - 1] = `<< /Type /Pages /Kids [${filhos.map((f) => `${f} 0 R`).join(" ")}] /Count ${filhos.length} >>`;
    let saida = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
    const posicoes = [];
    objetos.forEach((o, i) => {
      posicoes.push(saida.length);
      saida += `${i + 1} 0 obj\n${o}\nendobj\n`;
    });
    const xref = saida.length;
    saida += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n${posicoes.map((p) => `${String(p).padStart(10, "0")} 00000 n \n`).join("")}`;
    saida += `trailer\n<< /Size ${objetos.length + 1} /Root ${catalogo} 0 R /Info << /Title (${this.codificar(titulo)}) /Producer (SGGE-PCP) >> >>\nstartxref\n${xref}\n%%EOF\n`;
    const bytes = new Uint8Array(saida.length);
    for (let i = 0; i < saida.length; i += 1) bytes[i] = saida.charCodeAt(i) & 0xff;
    return bytes;
  },

COLECOES_ENVIADOS: Object.freeze({
    BASIS: Object.freeze({ cor: "#2563EB", fundo: "#EFF5FF", borda: "#C9DBFD", rotulo: "BASIS" }),
    LUDUS: Object.freeze({ cor: "#0F9488", fundo: "#ECFBF7", borda: "#B5EDE2", rotulo: "LUDUS" }),
    MUNDUS: Object.freeze({ cor: "#7C3AED", fundo: "#F5F1FF", borda: "#DDD3FB", rotulo: "MUNDUS" })
  }),

  ORDEM_ENVIADOS: Object.freeze(["BASIS", "LUDUS", "MUNDUS"]),

  formatarParteMaterial(texto, secundaria) {
    const t = String(texto || "").trim();
    if (t !== t.toUpperCase() || !/[A-ZÀ-Ú]/.test(t)) return t;
    if (!secundaria && t.length <= 3) return t;
    return t.split(" ").map((p, i) => {
      if (/\d|\//.test(p) || (p.length <= 3 && /^[A-Z]+$/.test(p) && i > 0)) return p;
      const minuscula = p.toLocaleLowerCase("pt-BR");
      return i === 0 ? minuscula.charAt(0).toLocaleUpperCase("pt-BR") + minuscula.slice(1) : minuscula;
    }).join(" ");
  },

  dividirMaterial(nome) {
    const secundario = /^(livro anual|book .+|manual .+|cma .+|anual|m\d.*|livro m\d.*)$/i;
    const partes = String(nome || "").split(" · ").map((p) => p.trim()).filter(Boolean);
    if (partes.length >= 2) {
      const indice = partes.findIndex((p) => secundario.test(p));
      if (indice >= 0) {
        const resto = partes.filter((_, i) => i !== indice).join(" · ");
        return { principal: this.formatarParteMaterial(resto, false), secundario: this.formatarParteMaterial(partes[indice], true) };
      }
      return { principal: this.formatarParteMaterial(partes[1], false), secundario: this.formatarParteMaterial(partes[0], true) };
    }
    const unico = partes[0] || "";
    const m = unico.match(/^(\S+)\s+((?:M\d|ANUAL)\S*)$/i);
    if (m) return { principal: this.formatarParteMaterial(m[1], false), secundario: m[2] };
    return { principal: unico, secundario: "" };
  },

  lerEnvio(texto) {
    const valor = String(texto || "").trim();
    const m = valor.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?:\s+(\d{1,2}):(\d{2}))?$/);
    if (!m) return { valido: false, texto: valor || "—" };
    const p = (n) => String(n).padStart(2, "0");
    const hora = m[4] !== undefined ? `${p(m[4])}:${m[5]}` : "";
    return {
      valido: true,
      data: `${p(m[1])}/${p(m[2])}`,
      hora,
      chave: (m[3] ? Number(m[3].length === 2 ? `20${m[3]}` : m[3]) : 0) * 1e8 + Number(m[2]) * 1e6 + Number(m[1]) * 1e4 + (hora ? Number(m[4]) * 100 + Number(m[5]) : -1)
    };
  },

  async gerarEnviados(dados, data) {
    const logo = await this.carregarLogo();
    const L = this.LARGURA;
    const H = this.ALTURA;
    const M = 46;
    const util = L - M * 2;
    const rodape = H - 34;
    const limite = rodape - 12;
    const NAVY = this.hexRgb("#0E1A3A");
    const TEXTO = this.hexRgb("#1E2A44");
    const CINZA = this.hexRgb("#6B7489");
    const CINZA_CLARO = this.hexRgb("#9AA3B5");
    const DIVISOR = this.hexRgb("#E6E9F0");
    const BRANCO = [255, 255, 255];
    const paginas = [];
    let ops = null;
    let y = 0;
    const n = (v) => v.toFixed(2);
    const K = 0.5523;

    const caminhoArredondado = (x, yTopo, w, h, r) => {
      const rr = Math.max(0, Math.min(r, w / 2, h / 2));
      const x0 = x, x1 = x + w, yb = H - yTopo - h, yt = H - yTopo;
      return [
        `${n(x0 + rr)} ${n(yb)} m`,
        `${n(x1 - rr)} ${n(yb)} l`,
        `${n(x1 - rr + rr * K)} ${n(yb)} ${n(x1)} ${n(yb + rr - rr * K)} ${n(x1)} ${n(yb + rr)} c`,
        `${n(x1)} ${n(yt - rr)} l`,
        `${n(x1)} ${n(yt - rr + rr * K)} ${n(x1 - rr + rr * K)} ${n(yt)} ${n(x1 - rr)} ${n(yt)} c`,
        `${n(x0 + rr)} ${n(yt)} l`,
        `${n(x0 + rr - rr * K)} ${n(yt)} ${n(x0)} ${n(yt - rr + rr * K)} ${n(x0)} ${n(yt - rr)} c`,
        `${n(x0)} ${n(yb + rr)} l`,
        `${n(x0)} ${n(yb + rr - rr * K)} ${n(x0 + rr - rr * K)} ${n(yb)} ${n(x0 + rr)} ${n(yb)} c`,
        "h"
      ].join(" ");
    };
    const caixa = (x, yTopo, w, h, r, fundo, borda, espessura = 0.7) => {
      const caminho = caminhoArredondado(x, yTopo, w, h, r);
      if (fundo && borda) ops.push(`${this.cor(fundo)} rg ${this.cor(borda)} RG ${espessura} w ${caminho} B`);
      else if (fundo) ops.push(`${this.cor(fundo)} rg ${caminho} f`);
      else if (borda) ops.push(`${this.cor(borda)} RG ${espessura} w ${caminho} S`);
    };
    const linha = (x1, x2, yy, rgb, espessura = 0.6) => ops.push(`${this.cor(rgb)} RG ${espessura} w ${n(x1)} ${n(H - yy)} m ${n(x2)} ${n(H - yy)} l S`);
    const largura = (t, tamanho, negrito, espaco = 0) => this.larguraTexto(t, tamanho, negrito) + espaco * Math.max(0, [...String(t)].length - 1);
    const texto = (t, x, base, tamanho, negrito, rgb, espaco = 0) => {
      ops.push(`BT /${negrito ? "F2" : "F1"} ${tamanho} Tf ${espaco} Tc ${this.cor(rgb)} rg ${n(x)} ${n(H - base)} Td (${this.codificar(t)}) Tj ET`);
      return x + largura(t, tamanho, negrito, espaco);
    };
    const textoDireita = (t, xDir, base, tamanho, negrito, rgb, espaco = 0) => texto(t, xDir - largura(t, tamanho, negrito, espaco), base, tamanho, negrito, rgb, espaco);
    const textoCentro = (t, xc, base, tamanho, negrito, rgb, espaco = 0) => texto(t, xc - largura(t, tamanho, negrito, espaco) / 2, base, tamanho, negrito, rgb, espaco);
    const trechos = (lista, xDir, base) => {
      const total = lista.reduce((s, [t, tam, neg]) => s + largura(t, tam, neg), 0);
      let x = xDir - total;
      lista.forEach(([t, tam, neg, rgb]) => { x = texto(t, x, base, tam, neg, rgb); });
    };

    const p2 = (v) => String(v).padStart(2, "0");
    const dataCompleta = `${p2(data.getDate())}/${p2(data.getMonth() + 1)}/${data.getFullYear()}`;
    const horaGeracao = `${p2(data.getHours())}:${p2(data.getMinutes())}`;

    const cabecalhoTabela = () => {
      texto("ANO", M, y + 8, 6.5, true, CINZA, 0.9);
      texto("MATERIAL", M + 34, y + 8, 6.5, true, CINZA, 0.9);
      texto("ENVIO À GRÁFICA", M + 326, y + 8, 6.5, true, CINZA, 0.9);
      textoDireita("RESPONSÁVEL", M + util, y + 8, 6.5, true, CINZA, 0.9);
      y += 14;
      linha(M, M + util, y, NAVY, 1);
      y += 8;
    };

    const novaPagina = (continuacao) => {
      ops = [];
      paginas.push(ops);
      y = 40;
      if (!continuacao) return;
      texto("SGGE-PCP · ARTE-FINALIZAÇÃO", M, y + 7, 6.5, true, CINZA_CLARO, 1.1);
      trechos([["Livros enviados à gráfica", 9, true, NAVY], ["  ·  ", 9, false, CINZA_CLARO], [`${dataCompleta} · ${horaGeracao}`, 8, false, CINZA]], M + util, y + 8);
      y += 16;
      linha(M, M + util, y, NAVY, 1.2);
      y += 14;
      cabecalhoTabela();
    };

    novaPagina(false);
    let xTexto = M;
    if (logo) {
      const h = 24;
      const w = (logo.largura / logo.altura) * h;
      ops.push(`q ${n(w)} 0 0 ${n(h)} ${n(M)} ${n(H - y - 8 - h)} cm /Logo Do Q`);
      ops.push(`${this.cor(DIVISOR)} RG 0.8 w ${n(M + w + 11)} ${n(H - y - 2)} m ${n(M + w + 11)} ${n(H - y - 40)} l S`);
      xTexto = M + w + 22;
    }
    texto("SGGE-PCP · ARTE-FINALIZAÇÃO", xTexto, y + 9, 6.5, true, CINZA_CLARO, 1.3);
    texto("Livros enviados à gráfica", xTexto, y + 30, 18, true, NAVY);
    trechos([["Gerado em ", 7.5, false, CINZA_CLARO], [`${dataCompleta} · ${horaGeracao}`, 7.5, true, TEXTO]], M + util, y + 15);
    trechos([["Seção ", 7.5, false, CINZA_CLARO], [dados.secao, 7.5, true, TEXTO]], M + util, y + 27);
    if (dados.filtros.length) {
      const filtros = dados.filtros.join(" · ");
      const linhasFiltro = this.quebrar(filtros, 170, 7, false);
      linhasFiltro.forEach((l, i) => trechos(i === 0 ? [["Filtros ", 7, false, CINZA_CLARO], [l, 7, true, TEXTO]] : [[l, 7, true, TEXTO]], M + util, y + 38 + i * 9));
      y += Math.max(0, linhasFiltro.length * 9 - 2);
    }
    y += 41;
    linha(M, M + util, y, NAVY, 1.6);
    y += 16;

    const grupos = this.ORDEM_ENVIADOS.map((chave) => ({ chave, ...this.COLECOES_ENVIADOS[chave], itens: dados.materiais.filter((m) => m.chaveColecao === chave) }));
    const extras = dados.materiais.filter((m) => !this.ORDEM_ENVIADOS.includes(m.chaveColecao));
    if (extras.length) grupos.push({ chave: "OUTRAS", cor: "#64748B", fundo: "#F3F5F9", borda: "#D9DEE7", rotulo: "OUTRAS COLEÇÕES", itens: extras });
    const total = dados.materiais.length;
    const pct = (q) => (total ? Math.round((q / total) * 100) : 0);

    const envios = dados.materiais.map((m) => this.lerEnvio(m.data)).filter((e) => e.valido);
    const ultimo = envios.reduce((a, e) => (!a || e.chave > a.chave ? e : a), null);

    const gap = 7;
    const larguraCard = (util - gap * 3) / 4;
    const alturaCard = 70;
    caixa(M, y, larguraCard, alturaCard, 7, NAVY, null);
    texto("MATERIAIS ENVIADOS", M + 12, y + 16, 6.5, true, this.hexRgb("#B8C4E0"), 1.2);
    texto(String(total), M + 12, y + 44, 27, true, BRANCO);
    if (ultimo) {
      const x = texto("Último envio: ", M + 12, y + 59, 7, false, this.hexRgb("#D5DDEF"));
      texto(`${ultimo.data}${ultimo.hora ? ` às ${ultimo.hora}` : ""}`, x, y + 59, 7, true, BRANCO);
    } else {
      texto("Último envio: não identificado", M + 12, y + 59, 7, false, this.hexRgb("#D5DDEF"));
    }
    this.ORDEM_ENVIADOS.forEach((chave, i) => {
      const c = this.COLECOES_ENVIADOS[chave];
      const qtd = dados.materiais.filter((m) => m.chaveColecao === chave).length;
      const x = M + (larguraCard + gap) * (i + 1);
      const cor = this.hexRgb(c.cor);
      caixa(x, y, larguraCard, alturaCard, 7, this.hexRgb(c.fundo), this.hexRgb(c.borda));
      caixa(x + 12, y + 11, 5.5, 5.5, 1.3, cor, null);
      texto(c.rotulo, x + 21, y + 16, 7, true, NAVY, 1.4);
      texto(String(qtd), x + 12, y + 44, 25, true, cor);
      texto(`${pct(qtd)}% do total`, x + 12, y + 59, 7, false, TEXTO);
    });
    y += alturaCard + 13;

    texto("DISTRIBUIÇÃO", M, y + 4, 6, true, CINZA, 1.1);
    const xBarra = M + 64;
    const larguraBarra = M + util - xBarra;
    const presentes = this.ORDEM_ENVIADOS.map((chave) => ({ chave, qtd: dados.materiais.filter((m) => m.chaveColecao === chave).length })).filter((g) => g.qtd > 0);
    const somaPresentes = presentes.reduce((s, g) => s + g.qtd, 0);
    if (somaPresentes) {
      const folga = 1.6;
      const util2 = larguraBarra - folga * (presentes.length - 1);
      let x = xBarra;
      presentes.forEach((g) => {
        const w = (util2 * g.qtd) / somaPresentes;
        caixa(x, y, w, 4, 2, this.hexRgb(this.COLECOES_ENVIADOS[g.chave].cor), null);
        x += w + folga;
      });
    } else {
      caixa(xBarra, y, larguraBarra, 4, 2, DIVISOR, null);
    }
    y += 21;

    cabecalhoTabela();

    const ALTURA_GRUPO = 22;
    const ALTURA_LINHA = 29.5;
    const faixaGrupo = (g, continuacao) => {
      const cor = this.hexRgb(g.cor);
      caixa(M, y, util, 18, 4, this.hexRgb(g.fundo), null);
      ops.push(`${this.cor(cor)} rg ${n(M)} ${n(H - y - 18)} 2 18 re f`);
      const x = texto(g.rotulo, M + 11, y + 12.3, 8, true, cor, 1.6);
      texto(`${g.itens.length} ${g.itens.length === 1 ? "material" : "materiais"}${continuacao ? " (continuação)" : ""}`, x + 8, y + 12.3, 7, false, NAVY);
      y += ALTURA_GRUPO;
    };

    grupos.filter((g) => g.itens.length).forEach((g) => {
      if (y + ALTURA_GRUPO + ALTURA_LINHA > limite) novaPagina(true);
      faixaGrupo(g, false);
      g.itens.forEach((m) => {
        const partes = this.dividirMaterial(m.nome);
        const larguraMaterial = 326 - 34 - 12;
        const linhasPrincipal = this.quebrar(partes.principal, larguraMaterial, 8.5, true);
        const altura = Math.max(ALTURA_LINHA, linhasPrincipal.length * 10.5 + (partes.secundario ? 9 : 0) + 10);
        if (y + altura > limite) {
          novaPagina(true);
          faixaGrupo(g, true);
        }
        const cor = this.hexRgb(g.cor);
        const meio = y + altura / 2;
        caixa(M + 3, meio - 6.8, 24, 13, 3, this.hexRgb(g.fundo), cor, 0.7);
        textoCentro(String(m.ano), M + 15, meio + 2.6, 7.5, true, NAVY);
        const topoTexto = y + 11;
        linhasPrincipal.forEach((l, i) => texto(l, M + 34, topoTexto + i * 10.5, 8.5, true, TEXTO));
        if (partes.secundario) texto(partes.secundario, M + 34, topoTexto + linhasPrincipal.length * 10.5 - 1, 7, false, CINZA);
        const envio = this.lerEnvio(m.data);
        if (envio.valido) {
          const x = texto(envio.data, M + 326, meio + 3, 8.5, true, TEXTO);
          if (envio.hora) texto(envio.hora, x + 4, meio + 3, 8.5, false, CINZA_CLARO);
          else {
            const rotulo = "SEM HORÁRIO";
            const w = largura(rotulo, 5.8, true, 0.5) + 12;
            caixa(x + 7, meio - 5.2, w, 10.4, 5.2, this.hexRgb("#FDF1C7"), null);
            texto(rotulo, x + 13, meio + 2.1, 5.8, true, this.hexRgb("#8A4B06"), 0.5);
          }
        } else {
          texto(envio.texto, M + 326, meio + 3, 8, false, CINZA);
        }
        const responsavel = String(m.responsavel || "").trim();
        const informado = responsavel && responsavel !== "—";
        const nome = informado ? responsavel : "Não informado";
        const maximo = util - 326 - 100 - 16;
        let nomeLinha = nome;
        if (largura(nomeLinha, 8.5, false) > maximo) {
          while (nomeLinha.length > 1 && largura(`${nomeLinha.trimEnd()}…`, 8.5, false) > maximo) nomeLinha = nomeLinha.slice(0, -1);
          nomeLinha = `${nomeLinha.trimEnd()}…`;
        }
        const xNome = M + util - largura(nomeLinha, 8.5, false);
        textoDireita(nomeLinha, M + util, meio + 3, 8.5, false, informado ? TEXTO : CINZA_CLARO);
        const cx = xNome - 10;
        caixa(cx - 5.5, meio - 5.5, 11, 11, 5.5, informado ? NAVY : DIVISOR, null);
        textoCentro(informado ? nome.charAt(0).toLocaleUpperCase("pt-BR") : "–", cx, meio + 2.3, 6.5, true, informado ? BRANCO : CINZA);
        y += altura;
        linha(M, M + util, y, DIVISOR, 0.6);
      });
      y += 6;
    });

    const nota = [
      [`Retrato de ${dataCompleta} às ${horaGeracao}.`, true],
      ["As informações refletem o momento em que este relatório foi gerado e podem mudar ao longo dos dias. Para consultar a posição mais recente, gere um novo relatório no sistema ou solicite à equipe de PCP ou de Performance do SGGE.", false]
    ];
    const larguraNota = util - 60;
    const palavras = nota.flatMap(([t, negrito]) => t.split(" ").map((p) => ({ p, negrito })));
    const linhasNota = [];
    let atual = [];
    let larguraAtual = 0;
    palavras.forEach((w) => {
      const lw = largura(w.p, 7.5, w.negrito);
      const espaco = atual.length ? largura(" ", 7.5, false) : 0;
      if (atual.length && larguraAtual + espaco + lw > larguraNota) {
        linhasNota.push(atual);
        atual = [w];
        larguraAtual = lw;
      } else {
        atual.push(w);
        larguraAtual += espaco + lw;
      }
    });
    if (atual.length) linhasNota.push(atual);
    const alturaNota = linhasNota.length * 11 + 22;
    y += 10;
    if (y + alturaNota > limite) novaPagina(false);
    caixa(M, y, util, alturaNota, 7, this.hexRgb("#F1F5FF"), this.hexRgb("#DCE5FB"));
    caixa(M + 13, y + 11, 13, 13, 6.5, this.hexRgb("#2563EB"), null);
    textoCentro("i", M + 19.5, y + 20.6, 8, true, BRANCO);
    linhasNota.forEach((ws, i) => {
      const grupos = [];
      ws.forEach((w, j) => {
        const ultimoGrupo = grupos[grupos.length - 1];
        const parte = j < ws.length - 1 ? `${w.p} ` : w.p;
        if (ultimoGrupo && ultimoGrupo.negrito === w.negrito) ultimoGrupo.t += parte;
        else grupos.push({ t: parte, negrito: w.negrito });
      });
      let x = M + 36;
      grupos.forEach((g) => { x = texto(g.t, x, y + 19 + i * 11, 7.5, g.negrito, g.negrito ? NAVY : TEXTO); });
    });

    paginas.forEach((p, i) => {
      ops = p;
      texto("SGGE-PCP · Entregas", M, rodape, 7, false, CINZA_CLARO);
      textoDireita(`Página ${i + 1} de ${paginas.length}`, M + util, rodape, 7, false, CINZA_CLARO);
    });
    return this.montar(paginas, logo, "Livros enviados à gráfica");
  },

  async baixarEnviados(dados, data, nome) {
    const bytes = await this.gerarEnviados(dados, data);
    const blob = new Blob([bytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = nome;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return blob;
  },

  async baixar(conteudo, data, opcoes = {}) {
    const bytes = await this.gerar(conteudo, data, opcoes);
    const blob = new Blob([bytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = opcoes.nomeArquivo;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return blob;
  }
};
