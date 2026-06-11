// laudo/normalize.ts — adapter: raw CheckTudo "Veículo Total"/"Total Plus"
// payload → typed NormalizedReport. This is the ONLY layer that knows the raw
// JSON paths (mapped from a real product-66 response for DAZ7597). Pure.
//
// Fields not present in product 66 (radar securitário, CSV) resolve to null
// ("não consta") and are TODO-tagged for when a product-65 sample is captured.

export const CAMPO = {
  scoreLeilao: "leilao.score.pontuacao",
  vistoriaEspecial: "leilao.score.exigenciaVistoriaEspecial",
  aceitacao: "leilao.score.aceitacao",
  percentualSobreRef: "leilao.score.percentualSobreRef",
  leilaoRegistros: "leilao.registros",
  indicioSinistro: "indicioSinistro.classificacao",
  rouboFurto: "rouboFurto.constaOcorrencia",
  rouboFurtoAtivo: "rouboFurto.constaOcorrenciaAtiva",
  riscoComercial: "analiseRisco.parecer",
  gravame: "gravame",
  restricaoFinanceiraEstadual: "baseEstadual.restricaoFinanceira",
  renajudEstadual: "baseEstadual.restricaoRenajud",
  renajudNacional: "baseNacional.indicadorRestricaoRenajud",
  chassiRemarcadoNacional: "baseNacional.restricao2",
  marcacaoChassiEstadual: "baseEstadual.tipoMarcacaoChassi",
  motorAlterado: "baseEstadual.dataAlteracaoMotor",
  multasRenainfNacional: "baseNacional.restricao1",
  debitoRenainfEstadual: "baseEstadual.debitoRenainf",
  recallPendentes: "recall.recallsPendente",
  fipeValor: "dadosBasicosDoVeiculo.informacoesFipe[0].valorAtual",
  fipeHistorico: "dadosBasicosDoVeiculo.informacoesFipe[0].historicoPreco",
  baseEstadualRestricoes: "baseEstadual.*",
  baseNacionalRestricoes: "baseNacional.restricao*",
  radarSecuritario: "(não consta no produto 66 — TODO produto 65)",
  csv: "(não consta no produto 66 — TODO produto 65)",
} as const;

export type Debitos = Record<string, number>;

export type NormalizedReport = {
  veiculo: {
    placa: string | null; chassi: string | null; marcaModelo: string | null;
    marca: string | null; modelo: string | null; versao: string | null;
    anoModelo: number | null; anoFabricacao: number | null;
    combustivel: string | null; cor: string | null; potencia: number | null;
  };
  fipe: { codigoFipe: string | null; valorAtual: number | null; historicoPreco: { ano: number; mes: number; valor: number }[] };
  leilao: { scoreLeilao: number | null; vistoriaEspecial: number | null; aceitacaoPct: number | null; percentualFipePct: number | null; registros: unknown[]; descricao: string | null };
  indicioSinistro: { presente: boolean; classificacao: string | null; descricao: string | null };
  rouboFurto: { constaOcorrencia: boolean; constaOcorrenciaAtiva: boolean; historico: unknown[] };
  recall: { pendentes: unknown[]; detalhes: unknown[] };
  riscoComercial: { nivel: "baixo" | "medio" | "alto" | null; indice: number | null; parecer: string | null };
  gravame: { ativo: boolean; descricaoRestricao: string | null; itens: unknown[] };
  baseEstadual: {
    restricaoFinanceira: string | null; restricaoRenajud: string | null; restricaoRouboFurto: string | null;
    restricaoJudicial: string | null; restricaoTributaria: string | null;
    tipoMarcacaoChassi: string | null; dataAlteracaoMotor: string | null; debitos: Debitos;
  };
  baseNacional: { restricoes: string[]; chassiRemarcado: boolean; indicadorRenajud: string | null; tipoMarcacaoChassi: string | null };
  proprietarios: unknown[];
  historicoKm: unknown[];
  radarSecuritario: null; // não consta no produto 66
  csv: { tipo: string | null; codigo: string | null };
};

// ── helpers ──────────────────────────────────────────────────────────────────
function rec(v: unknown): Record<string, unknown> { return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {}; }
function arr(v: unknown): unknown[] { return Array.isArray(v) ? v : []; }
function str(v: unknown): string | null { const s = v == null ? "" : String(v).trim(); return s === "" ? null : s; }
function intOrNull(v: unknown): number | null { const n = Number(String(v ?? "").replace(/[^\d-]/g, "")); return Number.isFinite(n) && String(v ?? "").trim() !== "" ? n : null; }
/** Parse a BRL string like "174,08" or "1.234,56" → 174.08 / 1234.56. */
export function parseBrl(v: unknown): number { const s = String(v ?? "").trim(); if (!s) return 0; const n = Number(s.replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "")); return Number.isFinite(n) ? n : 0; }
/** A restriction string that means "nothing found". */
function vazia(s: string | null): boolean { return s === null || /^(nada consta|nao consta|não consta|sem)/i.test(s); }

function riscoNivel(parecer: string | null, indice: number | null): "baixo" | "medio" | "alto" | null {
  const p = (parecer ?? "").toLowerCase();
  if (/\balto\b/.test(p)) return "alto";
  if (/\bm[ée]dio\b/.test(p)) return "medio";
  if (/\bbaixo\b/.test(p)) return "baixo";
  return indice == null ? null : null; // índice scale not confirmed — don't guess
}

export function normalizeReport(raw: unknown): NormalizedReport {
  const d = rec(raw);
  const dbv = rec(d.dadosBasicosDoVeiculo);
  const fipe0 = rec(arr(dbv.informacoesFipe)[0]);
  const leilaoScore = rec(rec(d.leilao).score);
  const be = rec(d.baseEstadual);
  const bn = rec(d.baseNacional);
  const ar = rec(d.analiseRisco);
  const rf = rec(d.rouboFurto);
  const isi = rec(d.indicioSinistro);
  const rc = rec(d.recall);

  const debitoKeys = ["debitoIpva", "debitoLicenciamento", "debitoMultas", "debitoDpvat", "debitoRenainf", "debitoDetran", "debitoDersa", "debitoDer", "debitoCetesb", "debitoMunicipais", "debitoPoliciaRodoviariaFederal"];
  const debitos: Debitos = {};
  for (const k of debitoKeys) { const val = parseBrl(be[k]); if (val > 0) debitos[k] = val; }

  const bnRestricoes = ["restricao1", "restricao2", "restricao3", "restricao4", "outrasRestricoes1", "outrasRestricoes2", "outrasRestricoes3", "outrasRestricoes4"]
    .map((k) => str(bn[k])).filter((s): s is string => !!s && !vazia(s));

  const restricaoFinanceira = str(be.restricaoFinanceira);
  const gravameItens = arr(d.gravame);
  const gravameAtivo = gravameItens.length > 0 || (!!restricaoFinanceira && !vazia(restricaoFinanceira));

  return {
    veiculo: {
      placa: str(d.placa) ?? str(dbv.placa),
      chassi: str(d.chassi) ?? str(dbv.chassi),
      marcaModelo: str(d.marcaModelo),
      marca: str(dbv.marca) ?? str(fipe0.marca),
      modelo: str(fipe0.modelo) ?? str(dbv.descricao),
      versao: str(fipe0.versao),
      anoModelo: intOrNull(d.anoModelo) ?? intOrNull(dbv.anoModelo),
      anoFabricacao: intOrNull(d.anoFabricacao) ?? intOrNull(dbv.anoFabricacao),
      combustivel: str(d.combustivel) ?? str(dbv.combustivel),
      cor: str(d.corVeiculo) ?? str(be.cor),
      potencia: intOrNull(d.potencia),
    },
    fipe: {
      codigoFipe: str(dbv.codigoFipe),
      valorAtual: fipe0.valorAtual != null ? Number(String(fipe0.valorAtual).replace(/[^\d.]/g, "")) || null : null,
      historicoPreco: arr(fipe0.historicoPreco)
        .map((e) => rec(e))
        .filter((e) => e.predicao !== true)
        .map((e) => ({ ano: Number(e.ano) || 0, mes: Number(e.mes) || 0, valor: Number(e.valor) || 0 }))
        .filter((p) => p.valor > 0),
    },
    leilao: {
      scoreLeilao: intOrNull(leilaoScore.pontuacao) ?? intOrNull(leilaoScore.score),
      vistoriaEspecial: leilaoScore.exigenciaVistoriaEspecial == null ? null : Number(leilaoScore.exigenciaVistoriaEspecial),
      aceitacaoPct: leilaoScore.aceitacao == null ? null : Number(leilaoScore.aceitacao),
      percentualFipePct: leilaoScore.percentualSobreRef == null ? null : Number(leilaoScore.percentualSobreRef),
      registros: arr(rec(d.leilao).registros),
      descricao: str(rec(d.leilao).descricao),
    },
    indicioSinistro: {
      presente: str(isi.classificacao) != null,
      classificacao: str(isi.classificacao),
      descricao: str(isi.descricao),
    },
    rouboFurto: {
      constaOcorrencia: rf.constaOcorrencia === true,
      constaOcorrenciaAtiva: rf.constaOcorrenciaAtiva === true,
      historico: arr(rf.historico),
    },
    recall: { pendentes: arr(rc.recallsPendente), detalhes: arr(rc.detalhes) },
    riscoComercial: { nivel: riscoNivel(str(ar.parecer), intOrNull(ar.indiceRisco)), indice: intOrNull(ar.indiceRisco), parecer: str(ar.parecer) },
    gravame: { ativo: gravameAtivo, descricaoRestricao: vazia(restricaoFinanceira) ? null : restricaoFinanceira, itens: gravameItens },
    baseEstadual: {
      restricaoFinanceira, restricaoRenajud: str(be.restricaoRenajud), restricaoRouboFurto: str(be.restricaoRouboFurto),
      restricaoJudicial: str(be.restricaoJudicial), restricaoTributaria: str(be.restricaoTributaria),
      tipoMarcacaoChassi: str(be.tipoMarcacaoChassi), dataAlteracaoMotor: str(be.dataAlteracaoMotor), debitos,
    },
    baseNacional: {
      restricoes: bnRestricoes,
      chassiRemarcado: /remarcad/i.test(str(bn.restricao2) ?? "") || bnRestricoes.some((r) => /remarcad/i.test(r)),
      indicadorRenajud: str(bn.indicadorRestricaoRenajud),
      tipoMarcacaoChassi: str(bn.tipoMarcacaoChassi),
    },
    proprietarios: arr(d.historicoProprietarios),
    historicoKm: arr(d.historicoKm),
    radarSecuritario: null,
    csv: { tipo: null, codigo: null },
  };
}
