// laudo/factsBundle.ts — assemble the deterministic facts the LLM narrates over.
// EVERYTHING here is computed in code (translated dictionary + analyzer outputs).
// The LLM never recomputes; it only explains these facts. Pure (no IO, no Date).

import { normalizeReport, type NormalizedReport } from "./normalize";
import {
  quadroAvisos, riscoScore, resumoFinanceiro, deteccaoContradicoes, faixaNegociacao,
  resumoSegurabilidade, recallsPendentes,
  type RiscoScore, type ResumoFinanceiro, type Contradicao, type FaixaNegociacao,
  type ResumoSegurabilidade, type RecallItem, type QuadroItem,
} from "./analyzers";

export type Veredicto = "comprar" | "atencao" | "evitar";

export type FipeResumo = { valorAtual: number | null; variacao12mPct: number | null; tendencia: "alta" | "queda" | "estável" | null; campo_origem: string };

export type FactsBundle = {
  veiculo: NormalizedReport["veiculo"];
  fipe: FipeResumo;
  quadroAvisos: QuadroItem[];
  risco: RiscoScore;
  financeiro: ResumoFinanceiro;
  contradicoes: Contradicao[];
  negociacao: FaixaNegociacao;
  segurabilidade: ResumoSegurabilidade;
  recalls: RecallItem[];
  /** Deterministic verdict suggestion — anchors the LLM and is the offline fallback. */
  sugestaoVeredicto: { classificacao: Veredicto; motivos: string[] };
};

function fipeResumo(r: NormalizedReport): FipeResumo {
  const h = r.fipe.historicoPreco;
  if (h.length < 2) return { valorAtual: r.fipe.valorAtual, variacao12mPct: null, tendencia: null, campo_origem: "dadosBasicosDoVeiculo.informacoesFipe[0]" };
  const last12 = h.slice(-12);
  const first = last12[0].valor, last = last12[last12.length - 1].valor;
  const pct = first ? Math.round(((last - first) / first) * 1000) / 10 : 0;
  return { valorAtual: r.fipe.valorAtual, variacao12mPct: pct, tendencia: pct > 0.5 ? "alta" : pct < -0.5 ? "queda" : "estável", campo_origem: "dadosBasicosDoVeiculo.informacoesFipe[0].historicoPreco" };
}

/** Deterministic verdict from risk band, transfer-blockers, contradictions and
 *  hard red flags — never the LLM's job. */
function sugerirVeredicto(r: NormalizedReport, risco: RiscoScore, fin: ResumoFinanceiro, contra: Contradicao[]): { classificacao: Veredicto; motivos: string[] } {
  const motivos: string[] = [];
  const hardRed =
    r.csv.tipo === "SINISTRADO" ||
    r.rouboFurto.constaOcorrenciaAtiva ||
    r.indicioSinistro.presente ||
    (r.leilao.scoreLeilao ?? 0) >= 3;
  if (r.csv.tipo === "SINISTRADO") motivos.push("CSV sinistrado");
  if (r.rouboFurto.constaOcorrenciaAtiva) motivos.push("Roubo/furto ativo");
  if (r.indicioSinistro.presente) motivos.push("Indício de sinistro");
  if ((r.leilao.scoreLeilao ?? 0) >= 3) motivos.push("Score de leilão elevado");

  if (risco.banda === "alto" || hardRed) {
    return { classificacao: "evitar", motivos: motivos.length ? motivos : ["Índice de risco alto"] };
  }
  if (risco.banda === "medio" || fin.bloqueiosTransferencia.length > 0 || contra.length > 0) {
    if (fin.bloqueiosTransferencia.length) motivos.push("Bloqueio(s) de transferência");
    if (contra.length) motivos.push(`${contra.length} contradição(ões) entre bases`);
    if (!motivos.length) motivos.push("Risco médio");
    return { classificacao: "atencao", motivos };
  }
  return { classificacao: "comprar", motivos: ["Sem red flags; risco baixo"] };
}

export function buildFactsBundle(rawData: unknown): FactsBundle {
  const r = normalizeReport(rawData);
  const risco = riscoScore(r);
  const financeiro = resumoFinanceiro(r);
  const contradicoes = deteccaoContradicoes(r);
  return {
    veiculo: r.veiculo,
    fipe: fipeResumo(r),
    quadroAvisos: quadroAvisos(r),
    risco,
    financeiro,
    contradicoes,
    negociacao: faixaNegociacao(r, risco),
    segurabilidade: resumoSegurabilidade(r),
    recalls: recallsPendentes(r),
    sugestaoVeredicto: sugerirVeredicto(r, risco, financeiro, contradicoes),
  };
}
