const Materiais = {
  GRUPOS_MODULOS: Object.freeze({
    "M1/M2": ["M1", "M2"],
    "M3/M4": ["M3", "M4"],
    "ANUAL": ["M1", "M2", "M3", "M4"]
  }),

  SINONIMOS: Object.freeze([
    [/^PROD(UCAO)? TEXTUAL$/, "PRODUCAO TEXTUAL"],
    [/^MATEMATICA BAS(ICA)?$/, "MATEMATICA BASICA"]
  ]),

  MUNDUS_3: Object.freeze({
    "LIVRO-1": Object.freeze(["GEOGRAFIA 1", "HISTORIA 1", "PORTUGUES", "PRODUCAO TEXTUAL", "LITERATURA", "INGLES", "MATEMATICA 1", "BIOLOGIA 1", "FISICA 1", "QUIMICA 1"]),
    "LIVRO-2": Object.freeze(["GEOGRAFIA 2", "HISTORIA 2", "SOCIOLOGIA", "FILOSOFIA", "REDACAO", "MATEMATICA 2", "MATEMATICA 3", "FISICA 2", "QUIMICA 2", "BIOLOGIA 2"])
  }),

  BOOK_LUDUS: Object.freeze({
    "GEOGRAFIA+HISTORIA": Object.freeze(["GEOGRAFIA", "HISTORIA"])
  }),

  MANUAL_LUDUS: Object.freeze({
    "GEOGRAFIA+HISTORIA": Object.freeze(["GEOGRAFIA", "HISTORIA"]),
    PORTUGUES: Object.freeze(["PORTUGUES"]),
    MATEMATICA: Object.freeze(["MATEMATICA"]),
    CIENCIAS: Object.freeze(["CIENCIAS"])
  }),

  ANUAL_BASIS: Object.freeze({
    "INGLES": Object.freeze(["INGLES"]),
    "REDACAO+MATEMATICA-BASICA+PROLAB": Object.freeze(["REDACAO", "MATEMATICA BASICA", "PROLAB"]),
    "LITERATURA": Object.freeze(["LITERATURA"])
  }),

  MUNDUS_MODULAR: Object.freeze({
    "1": Object.freeze({
      "LIVRO-1": Object.freeze(["LITERATURA", "PORTUGUES", "PRODUCAO TEXTUAL", "GEOGRAFIA", "HISTORIA", "MATEMATICA 1", "MATEMATICA 2", "FISICA 1", "FISICA 2", "QUIMICA 1", "QUIMICA 2", "BIOLOGIA 1", "BIOLOGIA 2"])
    }),
    "2": Object.freeze({
      "LIVRO-1": Object.freeze(["LITERATURA", "PORTUGUES", "PRODUCAO TEXTUAL", "GEOGRAFIA", "HISTORIA 1", "HISTORIA 2", "SOCIOLOGIA", "FILOSOFIA", "MATEMATICA 1", "MATEMATICA 2", "FISICA 1", "FISICA 2", "QUIMICA 1", "QUIMICA 2", "BIOLOGIA 1", "BIOLOGIA 2"])
    })
  }),

  ANUAL_MUNDUS: Object.freeze({
    "1": Object.freeze({
      "LIVRO-2": Object.freeze(["REDACAO", "INGLES", "FILOSOFIA", "SOCIOLOGIA", "ARTE"]),
      "ESPANHOL": Object.freeze(["ESPANHOL"])
    }),
    "2": Object.freeze({
      "LIVRO-2": Object.freeze(["REDACAO", "INGLES", "ARTE", "MATEMATICA 3"]),
      "ESPANHOL": Object.freeze(["ESPANHOL"])
    }),
    "3": Object.freeze({
      "ESPANHOL": Object.freeze(["ESPANHOL"])
    })
  }),

  semAcento(texto) {
    return String(texto ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim();
  },

  canonDisciplina(texto) {
    let valor = this.semAcento(texto).replace(/[.\-–_/]+/g, " ").replace(/\s+/g, " ").trim();
    this.SINONIMOS.forEach(([padrao, destino]) => {
      if (padrao.test(valor)) valor = destino;
    });
    return valor;
  },

  analisarFrente(frente) {
    const original = String(frente ?? "").trim();
    const base = this.semAcento(original);
    const sufixo = base.match(/\s*-\s*M\s*([1-4])\s*$/);
    const semModulo = sufixo ? original.replace(/\s*-\s*M\s*[1-4]\s*$/i, "").trim() : original;
    return {
      original,
      disciplina: this.canonDisciplina(semModulo),
      rotulo: semModulo,
      modulo: sufixo ? `M${sufixo[1]}` : ""
    };
  },

  canonModulo(modulo) {
    return this.semAcento(modulo).replace(/\s+/g, "");
  },

  canonAno(ano) {
    const digitos = String(ano ?? "").match(/\d+/);
    return digitos ? digitos[0] : "";
  },

  slug(texto) {
    return this.semAcento(texto).replace(/[^A-Z0-9+]+/g, "-").replace(/^-|-$/g, "");
  },

  naoClassificado(motivo) {
    return { classificado: false, motivo };
  },

  definir(base, extra) {
    const def = { ...base, ...extra };
    def.id = [def.colecaoChave, def.anoChave, def.tipoMaterial, this.slug(def.modulo), def.composicaoChave].filter(Boolean).join("|");
    return { classificado: true, def };
  },

  classificar(registro) {
    const c = registro.campos;
    const colecaoChave = this.semAcento(c.colecao);
    const anoChave = this.canonAno(c.ano);
    const modulo = this.canonModulo(c.modulo);
    const frente = this.analisarFrente(c.frente);

    if (!colecaoChave || !anoChave || !modulo || !frente.disciplina) {
      return this.naoClassificado("Registro sem coleção, ano, módulo ou frente.");
    }

    const base = { colecao: c.colecao, ano: c.ano, colecaoChave, anoChave, frente };

    if (colecaoChave === "LUDUS") return this.classificarLudus(base, modulo, frente);
    if (colecaoChave === "BASIS") return this.classificarSerie(base, modulo, frente, this.ANUAL_BASIS);
    if (colecaoChave === "MUNDUS") return this.classificarSerie(base, modulo, frente, this.ANUAL_MUNDUS[anoChave] || {});
    return this.naoClassificado(`Coleção não reconhecida: ${c.colecao}.`);
  },

  classificarLudus(base, modulo, frente) {
    const m = modulo.match(/^(BOOK|MANUAL|CMA)-(M1\/M2|M3\/M4|ANUAL)$/);
    if (!m) return this.naoClassificado(`Módulo LUDUS não reconhecido: ${modulo}.`);
    const [, tipo, grupo] = m;
    const modulos = this.GRUPOS_MODULOS[grupo];
    const comum = { tipoMaterial: tipo, categoria: grupo === "ANUAL" ? "ANUAL" : "MODULAR", modulo: grupo, modulosEsperados: modulos, exigeSufixo: true };

    if (tipo === "BOOK") {
      const agrupado = Object.entries(this.BOOK_LUDUS).find(([, lista]) => lista.includes(frente.disciplina));
      if (agrupado) {
        return this.definir(base, {
          ...comum,
          composicaoChave: agrupado[0],
          nome: `BOOK ${grupo} · ${agrupado[1].map((d) => this.titulo(d)).join(" + ")}`,
          disciplinasEsperadas: agrupado[1]
        });
      }
      return this.definir(base, {
        ...comum,
        composicaoChave: this.slug(frente.disciplina),
        nome: `BOOK ${grupo} · ${frente.rotulo}`,
        disciplinasEsperadas: [frente.disciplina]
      });
    }

    if (tipo === "CMA") {
      return this.definir(base, {
        ...comum,
        composicaoChave: "",
        nome: `CMA ${grupo}`,
        disciplinasEsperadas: null
      });
    }

    if (grupo === "ANUAL") {
      if (frente.disciplina !== "ARTE") {
        return this.naoClassificado(`Composição do MANUAL ANUAL não definida para ${frente.rotulo}.`);
      }
      return this.definir(base, { ...comum, composicaoChave: "ARTE", nome: "MANUAL ANUAL · Arte", disciplinasEsperadas: ["ARTE"] });
    }

    const conjunto = Object.entries(this.MANUAL_LUDUS).find(([, lista]) => lista.includes(frente.disciplina));
    if (!conjunto) {
      return this.naoClassificado(`Composição do MANUAL ${grupo} não definida para ${frente.rotulo}.`);
    }
    return this.definir(base, {
      ...comum,
      composicaoChave: conjunto[0],
      nome: `MANUAL ${grupo} · ${conjunto[1].map((d) => this.titulo(d)).join(" + ")}`,
      disciplinasEsperadas: conjunto[1]
    });
  },

  classificarSerie(base, modulo, frente, anuais) {
    const modular = modulo.match(/^M([1-4])$/);
    if (modular) {
      const comum = { tipoMaterial: "BOOK", categoria: "MODULAR", modulo, modulosEsperados: [modulo], exigeSufixo: false };
      if (base.colecaoChave === "MUNDUS" && base.anoChave === "3") {
        const livro = Object.entries(this.MUNDUS_3).find(([, lista]) => lista.includes(frente.disciplina));
        if (!livro) {
          return this.naoClassificado(`Frente ${frente.original} não pertence ao Livro 1 nem ao Livro 2 do MUNDUS 3º ano.`);
        }
        return this.definir(base, {
          ...comum,
          composicaoChave: livro[0],
          nome: `${modulo} · ${livro[0] === "LIVRO-1" ? "Livro 1" : "Livro 2"}`,
          disciplinasEsperadas: livro[1]
        });
      }
      const livrosMundus = base.colecaoChave === "MUNDUS" ? this.MUNDUS_MODULAR[base.anoChave] : null;
      if (livrosMundus) {
        const entradas = Object.entries(livrosMundus);
        const livro = entradas.find(([, lista]) => lista.includes(frente.disciplina)) || (entradas.length === 1 ? entradas[0] : null);
        if (!livro) {
          return this.naoClassificado(`Frente ${frente.original} não pertence a nenhum livro modular do MUNDUS ${base.ano}.`);
        }
        return this.definir(base, {
          ...comum,
          composicaoChave: livro[0],
          nome: `${modulo} · Livro 1`,
          disciplinasEsperadas: livro[1]
        });
      }
      return this.definir(base, { ...comum, composicaoChave: "", nome: `Livro ${modulo}`, disciplinasEsperadas: "irmaos" });
    }

    if (modulo === "ANUAL") {
      const conjunto = Object.entries(anuais).find(([, lista]) => lista.includes(frente.disciplina));
      if (!conjunto) {
        return this.naoClassificado(`Composição do livro anual ${base.colecaoChave} não definida para ${frente.rotulo}.`);
      }
      return this.definir(base, {
        tipoMaterial: "BOOK",
        categoria: "ANUAL",
        modulo: "ANUAL",
        modulosEsperados: this.GRUPOS_MODULOS.ANUAL,
        exigeSufixo: true,
        composicaoChave: conjunto[0],
        nome: base.colecaoChave === "MUNDUS"
          ? `${conjunto[0] === "LIVRO-2" ? "Livro 2" : conjunto[1].map((d) => this.titulo(d)).join(" + ")} · Anual`
          : `Livro anual · ${conjunto[1].map((d) => this.titulo(d)).join(" + ")}`,
        disciplinasEsperadas: conjunto[1],
        somenteAno: conjunto[0] === "LITERATURA" && base.colecaoChave === "BASIS" ? "9" : null
      });
    }

    return this.naoClassificado(`Módulo ${base.colecaoChave} não reconhecido: ${modulo}.`);
  },

  ROTULOS: Object.freeze({
    "INGLES": "Inglês",
    "REDACAO": "Redação",
    "MATEMATICA BASICA": "Matemática Básica",
    "PROLAB": "Prolab",
    "LITERATURA": "Literatura",
    "GEOGRAFIA": "Geografia",
    "HISTORIA": "História",
    "ARTE": "Arte",
    "ESPANHOL": "Espanhol",
    "PORTUGUES": "Português",
    "MATEMATICA": "Matemática",
    "CIENCIAS": "Ciências"
  }),

  titulo(disciplina) {
    return this.ROTULOS[disciplina] || disciplina.toLowerCase().replace(/(^|\s)\S/g, (l) => l.toUpperCase());
  },

  chaveIdentidade(def, frente) {
    return def.exigeSufixo ? `${frente.disciplina}#${frente.modulo}` : frente.disciplina;
  },

  disciplinasIrmas(grupos, def) {
    const conjunto = new Set();
    grupos.forEach((g) => {
      const d = g.def;
      if (d.colecaoChave === def.colecaoChave && d.anoChave === def.anoChave && d.categoria === "MODULAR" && d.disciplinasEsperadas === "irmaos") {
        g.itens.forEach((i) => conjunto.add(i.frente.disciplina));
      }
    });
    return [...conjunto];
  },

  validar(grupo, grupos) {
    const { def, itens } = grupo;
    const pendencias = [];

    const identidades = new Map();
    itens.forEach((item) => {
      const chave = this.chaveIdentidade(def, item.frente);
      if (!identidades.has(chave)) identidades.set(chave, []);
      identidades.get(chave).push(item);
    });

    const duplicadas = [...identidades.values()].filter((lista) => lista.length > 1);
    if (duplicadas.length) {
      pendencias.push({
        tipo: "frente_duplicada",
        provisorio: true,
        descricao: "Frentes repetidas no mesmo material; não é possível definir qual registro pertence a ele.",
        detalhes: duplicadas.map((lista) => ({ frente: lista[0].frente.original, linhas: lista.map((i) => i.registro.linhaBase) }))
      });
    }

    const foraDoModulo = itens.filter((item) => {
      const m = item.frente.modulo;
      if (def.exigeSufixo) return !m || !def.modulosEsperados.includes(m);
      return m && m !== def.modulo;
    });
    if (foraDoModulo.length) {
      pendencias.push({
        tipo: "modulo_divergente",
        provisorio: true,
        descricao: `Frentes com módulo incompatível com ${def.modulo}: ${foraDoModulo.map((i) => `${i.frente.original} (linha ${i.registro.linhaBase})`).join("; ")}.`,
        detalhes: foraDoModulo.map((i) => ({ frente: i.frente.original, linhas: [i.registro.linhaBase] }))
      });
    }

    const listaOficial = Array.isArray(def.disciplinasEsperadas) ? def.disciplinasEsperadas : null;
    if (listaOficial) {
      const inesperadas = itens.filter((i) => !listaOficial.includes(i.frente.disciplina));
      if (inesperadas.length) {
        pendencias.push({
          tipo: "frente_inesperada",
          provisorio: true,
          descricao: `Frentes fora da composição oficial: ${inesperadas.map((i) => `${i.frente.original} (linha ${i.registro.linhaBase})`).join("; ")}.`,
          detalhes: inesperadas.map((i) => ({ frente: i.frente.original, linhas: [i.registro.linhaBase] }))
        });
      }
    }

    let disciplinas = def.disciplinasEsperadas;
    if (disciplinas === "irmaos") disciplinas = this.disciplinasIrmas(grupos, def);
    if (disciplinas === null) disciplinas = [...new Set(itens.map((i) => i.frente.disciplina))];

    const esperadas = [];
    disciplinas.forEach((d) => {
      if (def.exigeSufixo) {
        def.modulosEsperados.forEach((m) => esperadas.push(`${d}#${m}`));
      } else {
        esperadas.push(d);
      }
    });
    const ausentes = esperadas.filter((chave) => !identidades.has(chave));
    if (ausentes.length) {
      pendencias.push({
        tipo: "composicao_incompleta",
        provisorio: true,
        descricao: `Composição incompleta. Frentes ausentes: ${ausentes.map((a) => a.replace("#", " - ")).join(", ")}.`,
        detalhes: ausentes
      });
    }

    if (def.somenteAno && def.anoChave !== def.somenteAno) {
      pendencias.push({
        tipo: "regra_divergente",
        provisorio: true,
        descricao: `Material previsto somente para o ${def.somenteAno}º ano, mas registrado no ${def.ano}.`,
        detalhes: []
      });
    }

    return pendencias;
  },

  agrupar(registros) {
    const grupos = new Map();
    const naoClassificados = [];

    registros.forEach((registro) => {
      const resultado = this.classificar(registro);
      if (!resultado.classificado) {
        naoClassificados.push({
          linhaBase: registro.linhaBase,
          colecao: registro.campos.colecao,
          ano: registro.campos.ano,
          modulo: registro.campos.modulo,
          frente: registro.campos.frente,
          motivo: resultado.motivo
        });
        return;
      }
      const { def } = resultado;
      if (!grupos.has(def.id)) grupos.set(def.id, { def, itens: [] });
      grupos.get(def.id).itens.push({ registro, frente: this.analisarFrente(registro.campos.frente) });
    });

    const lista = [...grupos.values()]
      .sort((a, b) => a.def.id.localeCompare(b.def.id, "pt-BR", { numeric: true }))
      .map((grupo) => ({ ...grupo, pendencias: this.validar(grupo, grupos) }));

    return { grupos: lista, naoClassificados };
  }
};
