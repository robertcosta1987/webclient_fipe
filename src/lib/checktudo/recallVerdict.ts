// checktudo/recallVerdict.ts — core "is this chassi inside an affected recall
// range?" check via Claude. Plain server-usable module (NOT a server action and
// NOT `server-only`, so it can also run from the backfill script). Never import
// this from a client component — it reads ANTHROPIC_API_KEY and calls the API.
//
// The model is allowed to REASON step by step (extract each range's bounds,
// align the comparable serial portion of the VIN, compare position by position)
// and then emit a parseable verdict on the last lines. Forcing instant JSON
// made the comparison unreliable.

export type RecallVerdict =
  | { ok: true; afetado: "sim" | "nao" | "indeterminado"; motivo?: string }
  | { ok: false; reason: "no_key" | "no_data" | "api_error" };

const MODEL = "claude-sonnet-4-6";

const SYSTEM =
  "Você é um especialista em recalls de veículos no Brasil. Sua única tarefa é decidir se o " +
  "CHASSI (VIN, 17 caracteres) de um veículo está DENTRO de alguma faixa de chassis afetados " +
  "listada nas campanhas de recall.\n\n" +
  "REGRAS DE COMPARAÇÃO (siga à risca):\n" +
  "1. O veículo é AFETADO se o chassi estiver dentro de QUALQUER UMA das faixas (basta uma campanha).\n" +
  "2. Cada faixa traz um limite inicial e um final (ex.: \"DE X ATÉ Y\", \"de X a Y\"). Os textos podem " +
  "ter ruído de OCR — reconstrua os limites com bom senso.\n" +
  "3. Para comparar, identifique a PARTE COMPARÁVEL: os limites e o chassi compartilham um mesmo " +
  "formato — normalmente um prefixo de fábrica/planta (letras como \"JP\", \"KP\", \"GK\") seguido de um " +
  "NÚMERO DE SÉRIE. Alinhe o chassi aos limites por esse prefixo e compare o número de série " +
  "posição a posição, da esquerda para a direita.\n" +
  "   Exemplo: VIN \"9BWDH5BZ2JP073209\" e faixa \"JP000001\" a \"JP900185\". A parte comparável do VIN " +
  "é \"JP073209\" (série 073209). Como 000001 ≤ 073209 ≤ 900185 → DENTRO da faixa → SIM.\n" +
  "4. Se a parte comparável do chassi for MENOR que o início de TODAS as faixas, ou MAIOR que o fim " +
  "de TODAS, então NÃO está afetado.\n" +
  "5. Só responda INDETERMINADO se os limites estiverem ilegíveis/ambíguos demais para alinhar com " +
  "segurança. Se der para comparar, decida SIM ou NAO.\n\n" +
  "Raciocine passo a passo: para CADA campanha, extraia os limites, extraia a parte comparável do " +
  "chassi e compare. Depois conclua.\n" +
  "Ao FINAL, escreva EXATAMENTE estas duas linhas (nada depois delas):\n" +
  "VEREDITO: SIM   |   ou VEREDITO: NAO   |   ou VEREDITO: INDETERMINADO\n" +
  "MOTIVO: <frase curta em português explicando a comparação que decidiu>";

export async function computeRecallVerdict(chassi: string, recallText: string): Promise<RecallVerdict> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { ok: false, reason: "no_key" };
  const chassiTrim = (chassi || "").trim();
  const text = (recallText || "").trim();
  if (!chassiTrim || !text) return { ok: false, reason: "no_data" };

  const user = `CHASSI DO VEÍCULO: ${chassiTrim}\n\nCAMPANHAS DE RECALL:\n${text.slice(0, 8000)}`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1200,
        system: SYSTEM,
        messages: [{ role: "user", content: user }],
      }),
    });
    if (!res.ok) return { ok: false, reason: "api_error" };
    const json = await res.json();
    const out: string = json?.content?.[0]?.text ?? "";

    // Take the LAST verdict marker (the conclusion, not a mention mid-reasoning).
    const verdicts = [...out.matchAll(/VEREDITO:\s*(SIM|N[ÃA]O|INDETERMINADO)/gi)];
    if (verdicts.length === 0) return { ok: false, reason: "api_error" };
    const v = verdicts[verdicts.length - 1][1].toUpperCase();
    const afetado = v === "SIM" ? "sim" : v.startsWith("N") ? "nao" : "indeterminado";

    const motivoMatch = out.match(/MOTIVO:\s*([^\n]+)/i);
    const motivo = motivoMatch ? motivoMatch[1].trim().slice(0, 400) : undefined;

    return { ok: true, afetado, motivo };
  } catch {
    return { ok: false, reason: "api_error" };
  }
}
