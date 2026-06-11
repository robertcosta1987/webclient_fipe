// laudo/analyzers.ts — Phase 2: deterministic analyzers. NO LLM. Every output
// carries the source field(s) it was computed from (campo_origem). Pure +
// fully unit-tested. Weights/bands live in tunable config objects.

import { CAMPO, type NormalizedReport } from "./normalize";
import { translateFlag, translateVistoriaEspecial, type QuadroFlag, type Translation } from "./dictionary";

// ── tunable config ───────────────────────────────────────────────────────────
export const RISCO_PESOS = {
  csvSinistrado: 30,
  scoreLeilao: { 1: 0, 2: 10, 3: 20, 4: 30 } as Record<number, number>,
  indicioSinistro: 15,
  rouboFurtoHistorico: 10,
  riscoComercialAlto: 15,
  riscoComercialMedio: 7,
  renajud: 15,
  chassiRemarcado: 20,
  motorAlterado: 8,
  recallPendente: 5,
  debitosPorMilReais: 5, // +5 por R$1.000 em débitos…
  debitosContribMax: 15, // …até no máximo 15.
};
export const RISCO_BANDAS = { baixoMax: 30, medioMax: 60 }; // 0–30 baixo, 31–60 médio, 61–100 alto
export const DESCONTO_BANDA = { baixo: [0, 0.05], medio: [0.05, 0.12], alto: [0.12, 0.25] } as const;

const ORGAO_LABEL: Record<string, string> = {
  debitoIpva: "IPVA", debitoLicenciamento: "Licenciamento", debitoMultas: "Multas", debitoDpvat: "DPVAT",
  debitoRenainf: "Renainf", debitoDetran: "DETRAN", debitoDersa: "DERSA", debitoDer: "DER",
  debitoCetesb: "CETESB", debitoMunicipais: "Municipais", debitoPoliciaRodoviariaFederal: "PRF",
};

// ── helpers ──────────────────────────────────────────────────────────────────
function vazia(s: string | null): boolean { return s === null || /^(nada consta|nao consta|não consta|sem)/i.test(s); }
function renajudPresente(r: NormalizedReport): boolean {
  return !vazia(r.baseEstadual.restricaoRenajud) || (r.baseNacional.indicadorRenajud != null && !vazia(r.baseNacional.indicadorRenajud));
}
function multasRenainf(r: NormalizedReport): boolean {
  return r.baseNacional.restricoes.some((x) => /multa\s*renainf/i.test(x)) || (r.baseEstadual.debitos.debitoRenainf ?? 0) > 0;
}
function restricoesEstaduais(r: NormalizedReport): boolean {
  return [r.baseEstadual.restricaoFinanceira, r.baseEstadual.restricaoJudicial, r.baseEstadual.restricaoTributaria, r.baseEstadual.restricaoRenajud, r.baseEstadual.restricaoRouboFurto]
    .some((x) => !vazia(x));
}

// ── quadro de avisos (13 flags; SIM = ruim) ─────────────────────────────────
export type QuadroItem = { flag: QuadroFlag; sim: boolean | null; campo_origem: string } & Translation;

export function quadroAvisos(r: NormalizedReport): QuadroItem[] {
  const vals: Record<QuadroFlag, { sim: boolean | null; campo: string }> = {
    restricoes_nacionais: { sim: r.baseNacional.restricoes.length > 0, campo: CAMPO.baseNacionalRestricoes },
    chassi_remarcado: { sim: r.baseNacional.chassiRemarcado, campo: CAMPO.chassiRemarcadoNacional },
    restricoes_estaduais: { sim: restricoesEstaduais(r), campo: CAMPO.baseEstadualRestricoes },
    motor_alterado: { sim: r.baseEstadual.dataAlteracaoMotor != null, campo: CAMPO.motorAlterado },
    csv: { sim: r.csv.tipo === null ? null : r.csv.tipo === "SINISTRADO", campo: CAMPO.csv },
    roubo_furto: { sim: r.rouboFurto.constaOcorrencia, campo: CAMPO.rouboFurto },
    registro_leilao: { sim: r.leilao.registros.length > 0, campo: CAMPO.leilaoRegistros },
    indicio_sinistro: { sim: r.indicioSinistro.presente, campo: CAMPO.indicioSinistro },
    risco_comercial: { sim: r.riscoComercial.nivel == null ? null : r.riscoComercial.nivel === "alto", campo: CAMPO.riscoComercial },
    recall: { sim: r.recall.pendentes.length > 0, campo: CAMPO.recallPendentes },
    renajud: { sim: renajudPresente(r), campo: CAMPO.renajudEstadual },
    multas_renainf: { sim: multasRenainf(r), campo: CAMPO.multasRenainfNacional },
    gravame: { sim: r.gravame.ativo, campo: CAMPO.gravame },
  };
  return (Object.keys(vals) as QuadroFlag[]).map((flag) => ({ flag, ...vals[flag], ...translateFlag(flag, vals[flag].sim), campo_origem: vals[flag].campo }));
}

// ── 1. riscoScore ────────────────────────────────────────────────────────────
export type RiscoBreakdown = { fator: string; peso: number; contribuicao: number; campo_origem: string };
export type RiscoScore = { score: number; banda: "baixo" | "medio" | "alto"; breakdown: RiscoBreakdown[] };

export function riscoScore(r: NormalizedReport): RiscoScore {
  const bd: RiscoBreakdown[] = [];
  const add = (fator: string, peso: number, contribuicao: number, campo: string) => { if (contribuicao > 0) bd.push({ fator, peso, contribuicao, campo_origem: campo }); };

  if (r.csv.tipo === "SINISTRADO") add("CSV sinistrado", RISCO_PESOS.csvSinistrado, RISCO_PESOS.csvSinistrado, CAMPO.csv);
  if (r.leilao.scoreLeilao != null) add(`Score de leilão (${r.leilao.scoreLeilao})`, RISCO_PESOS.scoreLeilao[r.leilao.scoreLeilao] ?? 0, RISCO_PESOS.scoreLeilao[r.leilao.scoreLeilao] ?? 0, CAMPO.scoreLeilao);
  if (r.indicioSinistro.presente) add("Indício de sinistro", RISCO_PESOS.indicioSinistro, RISCO_PESOS.indicioSinistro, CAMPO.indicioSinistro);
  if (r.rouboFurto.constaOcorrencia) add("Histórico de roubo/furto", RISCO_PESOS.rouboFurtoHistorico, RISCO_PESOS.rouboFurtoHistorico, CAMPO.rouboFurto);
  if (r.riscoComercial.nivel === "alto") add("Risco comercial alto", RISCO_PESOS.riscoComercialAlto, RISCO_PESOS.riscoComercialAlto, CAMPO.riscoComercial);
  else if (r.riscoComercial.nivel === "medio") add("Risco comercial médio", RISCO_PESOS.riscoComercialMedio, RISCO_PESOS.riscoComercialMedio, CAMPO.riscoComercial);
  if (renajudPresente(r)) add("Renajud (bloqueio de transferência)", RISCO_PESOS.renajud, RISCO_PESOS.renajud, CAMPO.renajudEstadual);
  if (r.baseNacional.chassiRemarcado) add("Chassi remarcado", RISCO_PESOS.chassiRemarcado, RISCO_PESOS.chassiRemarcado, CAMPO.chassiRemarcadoNacional);
  if (r.baseEstadual.dataAlteracaoMotor != null) add("Motor alterado", RISCO_PESOS.motorAlterado, RISCO_PESOS.motorAlterado, CAMPO.motorAlterado);
  if (r.recall.pendentes.length > 0) add("Recall pendente", RISCO_PESOS.recallPendente, RISCO_PESOS.recallPendente, CAMPO.recallPendentes);

  const totalDebitos = Object.values(r.baseEstadual.debitos).reduce((a, b) => a + b, 0);
  if (totalDebitos > 0) {
    const contrib = Math.min(RISCO_PESOS.debitosContribMax, Math.round((totalDebitos / 1000) * RISCO_PESOS.debitosPorMilReais));
    add(`Débitos (R$ ${totalDebitos.toFixed(2)})`, RISCO_PESOS.debitosContribMax, contrib, CAMPO.baseEstadualRestricoes);
  }

  const score = Math.min(100, bd.reduce((a, x) => a + x.contribuicao, 0));
  const banda = score <= RISCO_BANDAS.baixoMax ? "baixo" : score <= RISCO_BANDAS.medioMax ? "medio" : "alto";
  return { score, banda, breakdown: bd };
}

// ── 2. resumoFinanceiro ──────────────────────────────────────────────────────
export type DebitoOrgao = { orgao: string; valor: number; campo_origem: string };
export type Bloqueio = { tipo: string; descricao: string; campo_origem: string };
export type ResumoFinanceiro = { totalDebitos: number; porOrgao: DebitoOrgao[]; bloqueiosTransferencia: Bloqueio[] };

export function resumoFinanceiro(r: NormalizedReport): ResumoFinanceiro {
  const porOrgao: DebitoOrgao[] = Object.entries(r.baseEstadual.debitos)
    .map(([k, v]) => ({ orgao: ORGAO_LABEL[k] ?? k, valor: v, campo_origem: `baseEstadual.${k}` }))
    .sort((a, b) => b.valor - a.valor);
  const totalDebitos = porOrgao.reduce((a, x) => a + x.valor, 0);

  const bloqueios: Bloqueio[] = [];
  if (renajudPresente(r)) bloqueios.push({ tipo: "Renajud", descricao: r.baseEstadual.restricaoRenajud ?? "Restrição Renajud", campo_origem: CAMPO.renajudEstadual });
  if (r.gravame.ativo) bloqueios.push({ tipo: "Gravame / restrição financeira", descricao: r.gravame.descricaoRestricao ?? "Gravame ativo", campo_origem: r.gravame.itens.length ? CAMPO.gravame : CAMPO.restricaoFinanceiraEstadual });
  return { totalDebitos, porOrgao, bloqueiosTransferencia: bloqueios };
}

// ── 3. deteccaoContradicoes (explicit, extensible rules) ─────────────────────
export type Contradicao = { id: string; descricao: string; campos: string[] };
type Regra = { id: string; check: (r: NormalizedReport) => Contradicao | null };

export const REGRAS_CONTRADICAO: Regra[] = [
  {
    id: "gravame_vs_restricao_financeira",
    check: (r) => (r.gravame.itens.length === 0 && r.gravame.descricaoRestricao && /alienacao fiduciaria|reserva de dominio/i.test(r.gravame.descricaoRestricao))
      ? { id: "gravame_vs_restricao_financeira", descricao: `Sem gravame listado, porém a base estadual registra restrição financeira "${r.gravame.descricaoRestricao}".`, campos: [CAMPO.gravame, CAMPO.restricaoFinanceiraEstadual] }
      : null,
  },
  {
    id: "roubo_furto_base_vs_historico",
    check: (r) => (r.rouboFurto.constaOcorrencia && vazia(r.baseEstadual.restricaoRouboFurto))
      ? { id: "roubo_furto_base_vs_historico", descricao: "A base estadual não registra ocorrência de roubo/furto, mas há histórico de roubo/furto para o veículo.", campos: [CAMPO.rouboFurto, "baseEstadual.restricaoRouboFurto"] }
      : null,
  },
  {
    id: "chassi_remarcado_estadual_vs_nacional",
    check: (r) => (r.baseNacional.chassiRemarcado && /^normal$/i.test(r.baseEstadual.tipoMarcacaoChassi ?? ""))
      ? { id: "chassi_remarcado_estadual_vs_nacional", descricao: "A base nacional indica chassi remarcado, porém a base estadual marca a chapa do chassi como NORMAL.", campos: [CAMPO.chassiRemarcadoNacional, CAMPO.marcacaoChassiEstadual] }
      : null,
  },
];

export function deteccaoContradicoes(r: NormalizedReport): Contradicao[] {
  return REGRAS_CONTRADICAO.map((rg) => rg.check(r)).filter((c): c is Contradicao => c !== null);
}

// ── 4. faixaNegociacao ───────────────────────────────────────────────────────
export type FaixaNegociacao = { min: number; max: number; referenciaFipe: number; alavancas: { motivo: string; campo_origem: string }[] } | { indisponivel: true; motivo: string };

export function faixaNegociacao(r: NormalizedReport, risco: RiscoScore = riscoScore(r)): FaixaNegociacao {
  const fipe = r.fipe.valorAtual;
  if (fipe == null || fipe <= 0) return { indisponivel: true, motivo: "Valor FIPE não consta." };
  const teto = r.leilao.percentualFipePct != null ? fipe * (r.leilao.percentualFipePct / 100) : fipe;
  const [minDisc, maxDisc] = DESCONTO_BANDA[risco.banda];
  const max = Math.round(teto * (1 - minDisc));
  const min = Math.round(teto * (1 - maxDisc));
  const alavancas: { motivo: string; campo_origem: string }[] = [];
  if (r.indicioSinistro.presente) alavancas.push({ motivo: "Indício de sinistro", campo_origem: CAMPO.indicioSinistro });
  if (r.leilao.registros.length > 0 || (r.leilao.scoreLeilao ?? 0) > 1) alavancas.push({ motivo: "Histórico/score de leilão", campo_origem: CAMPO.scoreLeilao });
  if (r.rouboFurto.constaOcorrencia) alavancas.push({ motivo: "Histórico de roubo/furto", campo_origem: CAMPO.rouboFurto });
  if (r.gravame.ativo) alavancas.push({ motivo: "Gravame / restrição financeira", campo_origem: CAMPO.gravame });
  const totalDeb = Object.values(r.baseEstadual.debitos).reduce((a, b) => a + b, 0);
  if (totalDeb > 0) alavancas.push({ motivo: `Débitos pendentes (R$ ${totalDeb.toFixed(2)})`, campo_origem: CAMPO.baseEstadualRestricoes });
  return { min, max, referenciaFipe: fipe, alavancas };
}

// ── 5. resumoSegurabilidade ──────────────────────────────────────────────────
export type ResumoSegurabilidade = { disponivel: boolean; aprovadas: number | null; recusadas: number | null; vistoriaEspecial: Translation; observacao: string };

export function resumoSegurabilidade(r: NormalizedReport): ResumoSegurabilidade {
  const vistoria = translateVistoriaEspecial(r.leilao.vistoriaEspecial);
  // Radar Securitário não consta no produto 66 — TODO produto 65.
  if (r.radarSecuritario === null) {
    return { disponivel: false, aprovadas: null, recusadas: null, vistoriaEspecial: vistoria, observacao: "Radar Securitário não consta neste produto (disponível no Total Plus)." };
  }
  return { disponivel: true, aprovadas: null, recusadas: null, vistoriaEspecial: vistoria, observacao: "" };
}

// ── 6. recallsPendentes ──────────────────────────────────────────────────────
export type RecallItem = { descricao: string; campo_origem: string };
export function recallsPendentes(r: NormalizedReport): RecallItem[] {
  const items = r.recall.pendentes.length ? r.recall.pendentes : r.recall.detalhes;
  return items.map((x) => {
    const o = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
    const desc = [o.defeito, o.descricaoCompleta, o.descricao].filter(Boolean).join(": ") || "Recall pendente";
    return { descricao: String(desc).slice(0, 300), campo_origem: CAMPO.recallPendentes };
  });
}
