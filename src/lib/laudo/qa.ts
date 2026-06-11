// laudo/qa.ts — Phase 4: conversational Q&A grounded ONLY in the stored facts
// bundle. Same anti-hallucination rules; out-of-scope questions get a fixed
// fallback. Strictly server-side.

import "server-only";
import type { FactsBundle } from "./factsBundle";

const MODEL = process.env.LAUDO_MODEL || "claude-sonnet-4-6";
export const FORA_DE_ESCOPO = "Essa informação não está no laudo.";

const SYSTEM =
  "Você responde perguntas sobre um laudo veicular, em PT-BR, usando SOMENTE os fatos do factsBundle fornecido. " +
  "Cite o campo de origem quando possível. NUNCA invente, infira ou recalcule números. " +
  "Se a resposta não estiver nos fatos, responda exatamente: '" + FORA_DE_ESCOPO + "'. " +
  "Você não dá aconselhamento jurídico ou financeiro; isto é apoio à decisão. Seja conciso.";

export async function perguntarSobreLaudo(facts: FactsBundle, pergunta: string): Promise<{ resposta: string }> {
  const key = process.env.ANTHROPIC_API_KEY;
  const q = (pergunta || "").trim();
  if (!q) return { resposta: "Faça uma pergunta sobre o laudo." };
  if (!key) return { resposta: FORA_DE_ESCOPO };

  const user = `factsBundle:\n${JSON.stringify(facts)}\n\nPergunta: ${q.slice(0, 500)}`;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL, max_tokens: 700, system: SYSTEM, messages: [{ role: "user", content: user }] }),
    });
    if (!res.ok) return { resposta: FORA_DE_ESCOPO };
    const json = await res.json();
    const text: string = (json?.content?.[0]?.text ?? "").trim();
    return { resposta: text || FORA_DE_ESCOPO };
  } catch {
    return { resposta: FORA_DE_ESCOPO };
  }
}
