"use server";

// actions/laudo.ts — server actions for the AI vehicle-history laudo.
//   getLaudo(id)            → facts (always recomputed in code) + AI narrative
//                             (cached per consulta id; generated once).
//   perguntarLaudo(id, q)   → grounded Q&A over the stored facts.

import { requireScope } from "@/lib/auth/server";
import * as ct from "@/lib/db/checktudoConsultas";
import { buildFactsBundle, type FactsBundle } from "@/lib/laudo/factsBundle";
import { gerarRelatorioIA, type LaudoIA } from "@/lib/laudo/ia";
import { perguntarSobreLaudo } from "@/lib/laudo/qa";

export type LaudoResult =
  | { ok: true; facts: FactsBundle; laudo: LaudoIA; fonte: "ia" | "fallback" | "cache" }
  | { ok: false; error: string };

export async function getLaudo(consultaId: string): Promise<LaudoResult> {
  const { userId, master } = await requireScope();
  const row = await ct.getForLaudo(consultaId, master ? null : userId).catch(() => null);
  if (!row) return { ok: false, error: "Consulta não encontrada." };

  // Facts are deterministic and cheap — always recompute from the raw data.
  const facts = buildFactsBundle(row.data);

  if (row.laudoIa) {
    try { return { ok: true, facts, laudo: JSON.parse(row.laudoIa) as LaudoIA, fonte: "cache" }; }
    catch { /* fall through to regenerate */ }
  }

  const { laudo, fonte } = await gerarRelatorioIA(facts);
  try { await ct.saveLaudo(consultaId, JSON.stringify(facts), JSON.stringify(laudo)); } catch { /* non-fatal */ }
  return { ok: true, facts, laudo, fonte };
}

export async function perguntarLaudo(consultaId: string, pergunta: string): Promise<{ resposta: string }> {
  const { userId, master } = await requireScope();
  const row = await ct.getForLaudo(consultaId, master ? null : userId).catch(() => null);
  if (!row) return { resposta: "Consulta não encontrada." };

  let facts: FactsBundle;
  if (row.laudoFacts) {
    try { facts = JSON.parse(row.laudoFacts) as FactsBundle; }
    catch { facts = buildFactsBundle(row.data); }
  } else {
    facts = buildFactsBundle(row.data);
  }
  return perguntarSobreLaudo(facts, pergunta);
}
