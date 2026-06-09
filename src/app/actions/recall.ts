"use server";

// actions/recall.ts — given a vehicle CHASSI and the free-text recall campaign
// description(s) (which list affected chassi ranges, often with OCR noise), ask
// Claude whether this chassi falls inside the affected range. Returns
// sim/nao/indeterminado. Used by the CheckTudo report's "Veículo Listado
// Afetado?" field. Requires ANTHROPIC_API_KEY; degrades to "indisponivel"
// without it.

import { requireUserId } from "@/lib/auth/server";

export type RecallVerdict =
  | { ok: true; afetado: "sim" | "nao" | "indeterminado"; motivo?: string }
  | { ok: false; reason: "no_key" | "no_data" | "api_error" };

const MODEL = "claude-haiku-4-5-20251001";

export async function analyzeRecallAffected(chassi: string, recallText: string): Promise<RecallVerdict> {
  await requireUserId(); // gated to logged-in users
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { ok: false, reason: "no_key" };
  const chassiTrim = (chassi || "").trim();
  const text = (recallText || "").trim();
  if (!chassiTrim || !text) return { ok: false, reason: "no_data" };

  const prompt =
    `Você é um analista de recall veicular no Brasil. Recebe o CHASSI de um veículo e o(s) ` +
    `texto(s) de campanha(s) de recall, que costumam listar faixas/intervalos de chassis afetados ` +
    `(frequentemente com ruído de OCR, ex.: "DE 9886111... A 9886111..."). Decida se o CHASSI ` +
    `informado está DENTRO de alguma faixa afetada.\n\n` +
    `CHASSI DO VEÍCULO: ${chassiTrim}\n\n` +
    `TEXTO(S) DO RECALL:\n${text.slice(0, 6000)}\n\n` +
    `Compare considerando que chassis são alfanuméricos e a ordem segue dígito a dígito. ` +
    `Se o texto não permitir decidir com segurança, responda "indeterminado".\n` +
    `Responda APENAS com JSON, sem texto extra: {"afetado":"sim|nao|indeterminado","motivo":"frase curta em português"}`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 250,
        messages: [
          { role: "user", content: prompt },
          // Prefill the reply so the model emits pure JSON (no prose/fences).
          { role: "assistant", content: "{" },
        ],
      }),
    });
    if (!res.ok) return { ok: false, reason: "api_error" };
    const json = await res.json();
    const out: string = json?.content?.[0]?.text ?? "";
    // We prefilled "{", so prepend it; take the first complete (flat) object.
    const m = `{${out}`.match(/\{[\s\S]*?\}/);
    if (!m) return { ok: false, reason: "api_error" };
    const parsed = JSON.parse(m[0]) as { afetado?: string; motivo?: string };
    const a = String(parsed.afetado || "").toLowerCase();
    const afetado = a === "sim" ? "sim" : a === "nao" || a === "não" ? "nao" : "indeterminado";
    return { ok: true, afetado, motivo: parsed.motivo };
  } catch {
    return { ok: false, reason: "api_error" };
  }
}
