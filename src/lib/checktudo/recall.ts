// checktudo/recall.ts — pull the vehicle chassi + recall campaign text out of a
// CheckTudo product payload, for the "Veículo Listado Afetado?" analysis. Pure
// (no server/node deps) so it's shared by the server action, the backfill
// script and the client report.

function nonEmpty(v: unknown): boolean {
  return (typeof v === "string" && v.trim() !== "") || typeof v === "number";
}

function topStr(d: Record<string, unknown>, key: string): string | null {
  const found = Object.entries(d).find(([k]) => k.toLowerCase() === key.toLowerCase());
  return found && nonEmpty(found[1]) ? String(found[1]) : null;
}

export function extractRecall(data: unknown): { chassi: string | null; recallText: string } {
  const d = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  const chassi = topStr(d, "chassi");
  const recall = d.recall as { detalhes?: Array<Record<string, unknown>> } | undefined;
  const det = Array.isArray(recall?.detalhes) ? recall.detalhes : [];

  const parts: string[] = [];
  for (const x of det) {
    const defeito = nonEmpty(x.defeito) ? String(x.defeito) : "";
    const desc = nonEmpty(x.descricaoCompleta) ? String(x.descricaoCompleta) : "";
    if (defeito || desc) parts.push([defeito, desc].filter(Boolean).join(": "));
  }
  return { chassi, recallText: parts.join("\n\n").trim() };
}
