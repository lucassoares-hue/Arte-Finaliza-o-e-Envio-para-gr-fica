const Pendencias = {
  ESTADO: "pendente",
  LIBERA_CHECKLIST: "FECHADO EDITORIALMENTE",
  ANTERIOR: Object.freeze({
    bonecaSolicitada: "montagem",
    bonecaRecebida: "bonecaSolicitada",
    qrCodes: "bonecaRecebida",
    ajustes: "qrCodes",
    grafica: "ajustes",
    separatas: "grafica",
    gabaritos: "separatas"
  }),
  cache: new WeakMap(),

  normalizar(valor) {
    return Materiais.semAcento(valor).replace(/\s+/g, " ");
  },

  temStatusMaterial(registro) {
    return Boolean(registro && registro.original && Object.prototype.hasOwnProperty.call(registro.original, "statusMaterial"));
  },

  dados(proc) {
    if (!proc) return null;
    if (this.cache.has(proc)) return this.cache.get(proc);
    const statusPorRegistro = new Map(proc.checklists.map((c) => [c.id, c.status]));
    const registrosPorMaterial = new Map();
    proc.registros.forEach((r) => {
      if (!r.materialId) return;
      if (!registrosPorMaterial.has(r.materialId)) registrosPorMaterial.set(r.materialId, []);
      registrosPorMaterial.get(r.materialId).push(r);
    });
    const disponivel = proc.registros.length > 0 && proc.registros.some((r) => this.temStatusMaterial(r));
    const dados = { statusPorRegistro, registrosPorMaterial, disponivel };
    this.cache.set(proc, dados);
    return dados;
  },

  frente(registro, status) {
    if (status !== STATUS.NAO_INICIADO) return { estado: status, motivo: "Checklist já registrado" };
    if (!this.temStatusMaterial(registro)) return { estado: STATUS.NAO_INICIADO, motivo: "A API não informou statusMaterial (coluna Y)", indisponivel: true };
    if (this.normalizar(registro.original.statusMaterial) === this.LIBERA_CHECKLIST) return { estado: this.ESTADO, motivo: "Material fechado editorialmente" };
    return { estado: STATUS.NAO_INICIADO, motivo: "Material ainda não fechado editorialmente" };
  },

  frentes(proc, materiais) {
    const dados = this.dados(proc);
    if (!dados) return [];
    const lista = [];
    materiais.forEach((material) => {
      (dados.registrosPorMaterial.get(material.id) || []).forEach((registro) => {
        const status = dados.statusPorRegistro.get(registro.id) || STATUS.NAO_INICIADO;
        lista.push({ registro, material, status, ...this.frente(registro, status) });
      });
    });
    return lista;
  },

  etapa(material, etapaId) {
    const atual = material.etapas[etapaId].status;
    if (atual !== STATUS.NAO_INICIADO) return { estado: atual, motivo: "Etapa já registrada" };
    const anterior = this.ANTERIOR[etapaId];
    if (anterior) {
      const nomeAnterior = (ETAPAS_BOOK.find((e) => e.id === anterior) || {}).nome || anterior;
      return material.etapas[anterior].status === STATUS.CONCLUIDO
        ? { estado: this.ESTADO, motivo: `${nomeAnterior} concluída` }
        : { estado: STATUS.NAO_INICIADO, motivo: `${nomeAnterior} ainda não concluída` };
    }
    return CiclosEntrega.statusChecklist(material.checklist) === STATUS.CONCLUIDO
      ? { estado: this.ESTADO, motivo: "Checklist concluído em todas as frentes" }
      : { estado: STATUS.NAO_INICIADO, motivo: "Checklist ainda não concluído em todas as frentes" };
  },

  pendente(material, etapaId) {
    return this.etapa(material, etapaId).estado === this.ESTADO;
  },

  resumo(proc, materiais) {
    const confirmados = materiais.filter((b) => !b.provisorio);
    const dados = this.dados(proc);
    const etapas = {};
    ETAPAS_BOOK.forEach((e) => { etapas[e.id] = confirmados.filter((b) => this.pendente(b, e.id)).length; });
    const checklist = dados && dados.disponivel ? this.frentes(proc, confirmados).filter((f) => f.estado === this.ESTADO).length : null;
    return { disponivel: Boolean(dados && dados.disponivel), checklist, etapas };
  }
};
