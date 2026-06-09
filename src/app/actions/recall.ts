"use server";

// actions/recall.ts — server action wrapper around the recall verdict core.
// Used by the CheckTudo report's live "Veículo Listado Afetado?" field.

import { requireUserId } from "@/lib/auth/server";
import { computeRecallVerdict, type RecallVerdict } from "@/lib/checktudo/recallVerdict";

export type { RecallVerdict };

export async function analyzeRecallAffected(chassi: string, recallText: string): Promise<RecallVerdict> {
  await requireUserId(); // gated to logged-in users
  return computeRecallVerdict(chassi, recallText);
}
