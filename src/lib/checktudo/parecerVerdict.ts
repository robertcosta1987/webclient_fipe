// checktudo/parecerVerdict.ts — the "Parecer de Compra" buy/risk verdict via
// Claude. Cheap by design: a compact signals object → Haiku → COMPRAR /
// ATENÇÃO / EVITAR + a one-line reason. Plain server-usable module (not a
// server action, not `server-only`) so the backfill script can use it too.
// Never import from a client component (reads ANTHROPIC_API_KEY, calls the API).

import type { ParecerSignals } from "./parecer";

export type ParecerVerdict =
  | { ok: true; veredito: "comprar" | "atencao" | "evitar"; motivo?: string }
  | { ok: false; reason: "no_key" | "no_data" | "api_error" };

const MODEL = "claude-haiku-4-5-20251001";

const SYSTEM =
  "Você avalia, para uma REVENDA de veículos no Brasil, se vale a pena comprar um carro com base em " +
  "sinais consolidados de uma consulta veicular (risco, recall, indício de sinistro, roubo/furto, leilão, " +
  "gravame/restrições, situação do chassi, nº de donos, KM/hodômetro, débitos/multas e tendência de preço FIPE).\n\n" +
  "Decida UM veredito:\n" +
  "• EVITAR — há sinal grave: indício de sinistro/perda total, roubo/furto, passagem por leilão, chassi/situação " +
  "irregular, ou gravame/restrição impeditiva (combinados ou isolados quando graves).\n" +
  "• ATENCAO — sem sinal grave, mas há ressalvas que afetam preço/negociação: muitos donos, KM alto ou " +
  "inconsistente (possível adulteração), débitos/multas, recall de segurança pendente, ou FIPE em queda.\n" +
  "• COMPRAR — sinais limpos; bom negócio.\n\n" +
  "Seja prático e direto, pensando em quem compra para revender. Cite os fatores decisivos.\n" +
  "Responda EXATAMENTE nestas duas linhas (nada depois):\n" +
  "VEREDITO: COMPRAR | ou VEREDITO: ATENCAO | ou VEREDITO: EVITAR\n" +
  "MOTIVO: <frase curta em português citando os fatores que decidiram>";

export async function computeParecer(signals: ParecerSignals): Promise<ParecerVerdict> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { ok: false, reason: "no_key" };
  const json = JSON.stringify(signals);
  if (!json || json === "{}") return { ok: false, reason: "no_data" };

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 400,
        system: SYSTEM,
        messages: [{ role: "user", content: `SINAIS DA CONSULTA (JSON):\n${json.slice(0, 4000)}` }],
      }),
    });
    if (!res.ok) return { ok: false, reason: "api_error" };
    const data = await res.json();
    const out: string = data?.content?.[0]?.text ?? "";

    const verdicts = [...out.matchAll(/VEREDITO:\s*(COMPRAR|ATEN[ÇC][ÃA]O|ATENCAO|EVITAR)/gi)];
    if (verdicts.length === 0) return { ok: false, reason: "api_error" };
    const v = verdicts[verdicts.length - 1][1].toUpperCase();
    const veredito = v.startsWith("COMPR") ? "comprar" : v.startsWith("EVIT") ? "evitar" : "atencao";
    const motivoMatch = out.match(/MOTIVO:\s*([^\n]+)/i);
    const motivo = motivoMatch ? motivoMatch[1].trim().slice(0, 480) : undefined;
    return { ok: true, veredito, motivo };
  } catch {
    return { ok: false, reason: "api_error" };
  }
}
