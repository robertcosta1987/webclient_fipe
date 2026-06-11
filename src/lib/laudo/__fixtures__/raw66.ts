// Representative CheckTudo product-66 payload (compact, anonymized from the real
// DAZ7597 response). Exercises the tricky cases: roubo/furto history, "RESERVA
// DE DOMINIO" with an empty gravame[] (contradiction), chassi remarcado in the
// national base while the state base says NORMAL (contradiction), multa Renainf,
// and a débito de licenciamento.

export const raw66: Record<string, unknown> = {
  analiseRisco: { indiceRisco: "1", parecer: "Veículo com baixo risco de recusa em comercialização/seguro" },
  baseEstadual: {
    restricaoFinanceira: "RESERVA DE DOMINIO",
    restricaoRenajud: "NADA CONSTA",
    restricaoRouboFurto: "NADA CONSTA",
    restricaoJudicial: "NADA CONSTA",
    restricaoTributaria: "NADA CONSTA",
    tipoMarcacaoChassi: "NORMAL",
    dataAlteracaoMotor: null,
    debitoIpva: "0,00", debitoLicenciamento: "174,08", debitoMultas: "0,00", debitoRenainf: "0,00",
    cor: "BRANCA",
  },
  baseNacional: {
    restricao1: "EXISTE MULTA RENAINF",
    restricao2: "CHASSI_REMARCADO",
    indicadorRestricaoRenajud: null,
    tipoMarcacaoChassi: null,
  },
  indicioSinistro: { classificacao: null, descricao: "NÃO CONSTA INDÍCIO DE SINISTRO PARA O VEÍCULO INFORMADO" },
  leilao: { score: { aceitacao: null, exigenciaVistoriaEspecial: null, percentualSobreRef: null, pontuacao: null, score: null }, descricao: "Não consta registro de leilão para o veículo informado", registros: [] },
  recall: { detalhes: [], recallsPendente: [] },
  rouboFurto: {
    constaOcorrencia: true, constaOcorrenciaAtiva: false,
    historico: [{ ocorrencia: "Alerta de Roubo/Furto", dataOcorrencia: "20/09/2019", declaracao: "Furto" }],
  },
  gravame: [],
  dadosBasicosDoVeiculo: {
    marca: "FIAT", descricao: "UNO MILLE EX", codigoFipe: "10189",
    informacoesFipe: [{
      valorAtual: "10966.00", marca: "Fiat", modelo: "UNO", versao: "MILLE/ MILLE EX/ SMART 2P",
      historicoPreco: [
        { ano: "2025", mes: "6", valor: "10291", predicao: false },
        { ano: "2026", mes: "6", valor: "10966", predicao: false },
        { ano: "2026", mes: "7", valor: "11050", predicao: true },
      ],
    }],
  },
  historicoProprietarios: [{ proprietario: "ALEXANDRE CRUZ DA SILVA", anoExercicio: "2026" }],
  historicoKm: [],
  placa: "DAZ7597", chassi: "9BD158018Y4138950", marcaModelo: "FIAT/UNO MILLE EX",
  anoModelo: "2000", anoFabricacao: "2000", combustivel: "GASOLINA", corVeiculo: "BRANCA", potencia: "58",
};
