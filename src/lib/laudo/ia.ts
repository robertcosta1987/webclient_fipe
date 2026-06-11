// laudo/ia.ts — Phase 3: AI synthesis over the (already computed) facts bundle.
// The model only writes narrative; it must not recompute or invent numbers.
// Strictly server-side (reads ANTHROPIC_API_KEY). Falls back to a deterministic
// narrative if the key/model is unavailable or the response can't be parsed —
// so the report always renders.

import "server-only";
import { z } from "zod";
import type { FactsBundle, Veredicto } from "./factsBundle";

const MODEL = process.env.LAUDO_MODEL || "claude-sonnet-4-6";

const DISCLAIMER =
  "Este laudo é apoio à decisão, gerado a partir de bases consultadas; não é aconselhamento jurídico ou financeiro e não substitui vistoria presencial.";

const SYSTEM =
  "Você é um analista de laudo veicular. Escreva em PT-BR. Use SOMENTE os fatos fornecidos no factsBundle. " +
  "Cite o campo de origem de cada afirmação. Quando um dado não existir, escreva 'não consta' — nunca infira nem invente. " +
  "NUNCA recalcule nem crie números (eles já vêm prontos). Você não dá aconselhamento jurídico ou financeiro; isto é apoio à decisão. " +
  "Responda em JSON estrito, sem markdown.";

export const LaudoIASchema = z.object({
  veredicto: z.object({
    classificacao: z.enum(["comprar", "atencao", "evitar"]),
    resumo: z.string(),
    justificativa: z.array(z.string()),
  }),
  explicacaoRisco: z.string(),
  destaques: z.array(z.string()),
  alertas: z.array(z.string()),
  faixaNegociacaoTexto: z.string(),
  segurabilidadeTexto: z.string(),
  disclaimer: z.string(),
});
export type LaudoIA = z.infer<typeof LaudoIASchema>;

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

/** Deterministic narrative from the facts — no LLM. Also the fallback. */
export function fallbackLaudo(facts: FactsBundle): LaudoIA {
  const v: Veredicto = facts.sugestaoVeredicto.classificacao;
  const flagsRuins = facts.quadroAvisos.filter((q) => q.sim === true).map((q) => q.label);
  const alertas = [
    ...flagsRuins.map((l) => `${l} (verificado nas bases).`),
    ...facts.contradicoes.map((c) => `Contradição: ${c.descricao}`),
    ...facts.financeiro.bloqueiosTransferencia.map((b) => `Bloqueio de transferência: ${b.tipo} — ${b.descricao}.`),
  ];
  const neg = "indisponivel" in facts.negociacao
    ? "Faixa de negociação indisponível: valor FIPE não consta."
    : `Referência FIPE ${BRL.format(facts.negociacao.referenciaFipe)}; faixa sugerida ${BRL.format(facts.negociacao.min)}–${BRL.format(facts.negociacao.max)} considerando o risco apurado.`;
  return {
    veredicto: {
      classificacao: v,
      resumo: v === "comprar" ? "Sem red flags relevantes; risco baixo." : v === "atencao" ? "Há pontos de atenção a verificar antes de fechar." : "Red flags relevantes; recomenda-se evitar ou negociar com cautela.",
      justificativa: facts.sugestaoVeredicto.motivos,
    },
    explicacaoRisco: `Índice de risco ${facts.risco.score}/100 (${facts.risco.banda}). Fatores: ${facts.risco.breakdown.map((b) => `${b.fator} +${b.contribuicao}`).join("; ") || "nenhum fator de risco relevante"}.`,
    destaques: [
      facts.veiculo.marcaModelo ? `Veículo: ${facts.veiculo.marcaModelo}${facts.veiculo.anoModelo ? ` (${facts.veiculo.anoModelo})` : ""}.` : "Veículo: não consta.",
      facts.fipe.valorAtual != null ? `FIPE atual ${BRL.format(facts.fipe.valorAtual)}${facts.fipe.tendencia ? `, tendência ${facts.fipe.tendencia}` : ""}.` : "FIPE: não consta.",
    ],
    alertas: alertas.length ? alertas : ["Nenhum alerta relevante nas bases consultadas."],
    faixaNegociacaoTexto: neg,
    segurabilidadeTexto: facts.segurabilidade.observacao || "Segurabilidade não consta.",
    disclaimer: DISCLAIMER,
  };
}

function stripFences(s: string): string {
  return s.replace(/^\s*```(?:json)?/i, "").replace(/```\s*$/i, "").trim();
}

export async function gerarRelatorioIA(facts: FactsBundle): Promise<{ laudo: LaudoIA; fonte: "ia" | "fallback" }> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { laudo: fallbackLaudo(facts), fonte: "fallback" };

  const user =
    "factsBundle (fatos já calculados; NÃO recalcule):\n" +
    JSON.stringify(facts) +
    "\n\nResponda em JSON estrito com as chaves: veredicto{classificacao,resumo,justificativa[]}, explicacaoRisco, destaques[], alertas[], faixaNegociacaoTexto, segurabilidadeTexto, disclaimer. " +
    "Seja conciso: cada texto com 1–2 frases; no máximo 4 itens por lista.";

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL, max_tokens: 3000, system: SYSTEM, messages: [{ role: "user", content: user }] }),
    });
    if (!res.ok) return { laudo: fallbackLaudo(facts), fonte: "fallback" };
    const json = await res.json();
    const text: string = json?.content?.[0]?.text ?? "";
    const parsed = LaudoIASchema.safeParse(JSON.parse(stripFences(text)));
    if (!parsed.success) return { laudo: fallbackLaudo(facts), fonte: "fallback" };
    // Guardrail: the model must not override the deterministic classification.
    const laudo = parsed.data;
    laudo.veredicto.classificacao = facts.sugestaoVeredicto.classificacao;
    if (!laudo.disclaimer?.trim()) laudo.disclaimer = DISCLAIMER;
    return { laudo, fonte: "ia" };
  } catch {
    return { laudo: fallbackLaudo(facts), fonte: "fallback" };
  }
}
