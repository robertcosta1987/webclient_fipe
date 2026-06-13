"use server";

// Gera um anúncio de venda (copy persuasiva) a partir dos dados do veículo, via
// Claude (ANTHROPIC_API_KEY). Fase 1: só texto — remoção de fundo, mockups e link
// Azure entram depois. Não inventa dados que não foram fornecidos.

import { requireScope } from "@/lib/auth/server";
import { AnuncioSchema, type AdInput, type AnuncioResult } from "@/lib/anuncio/types";

const MODEL = process.env.ANUNCIO_MODEL || "claude-sonnet-4-6";

const SYSTEM =
  "Você é um redator publicitário especialista em anúncios de veículos usados no Brasil. " +
  "Escreva em PT-BR, persuasivo, confiável e honesto. Use SOMENTE os dados fornecidos — " +
  "NUNCA invente quilometragem, número de donos, estado de conservação, itens ou preço de venda. " +
  "Destaque procedência, marca/modelo, ano, motorização e o valor de referência FIPE. " +
  "Responda em JSON estrito, sem markdown.";

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export async function gerarAnuncio(input: AdInput): Promise<AnuncioResult> {
  try { await requireScope(); } catch { return { ok: false, error: "Sessão expirada. Faça login novamente." }; }
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { ok: false, error: "IA não configurada (ANTHROPIC_API_KEY ausente)." };

  const fipeTxt = input.valorFipe != null ? BRL.format(input.valorFipe) : "não consta";
  const user =
    "Dados do veículo (use só o que está aqui; campos vazios = não consta, não invente):\n" +
    JSON.stringify({ ...input, valorFipeFormatado: fipeTxt }) +
    "\n\nGere um anúncio de venda. Responda em JSON com as chaves: " +
    "titulo (curto e chamativo), subtitulo (1 frase), destaques (3 a 6 bullets curtos), " +
    "descricao (2 parágrafos persuasivos e honestos), precoTexto (1 frase usando o valor FIPE como referência, SEM inventar preço de venda), " +
    "hashtags (5 a 8, cada uma começando com #), " +
    "portais (objeto com webmotors, olx, social, whatsapp — cada um um texto pronto para colar naquele canal, no tom adequado).";

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL, max_tokens: 2500, system: SYSTEM, messages: [{ role: "user", content: user }] }),
    });
    if (!res.ok) return { ok: false, error: "Falha ao gerar o anúncio. Tente novamente." };
    const json = await res.json();
    const text: string = json?.content?.[0]?.text ?? "";
    const m = text.match(/\{[\s\S]*\}/);
    const parsed = AnuncioSchema.safeParse(JSON.parse(m ? m[0] : text));
    if (!parsed.success) return { ok: false, error: "Não foi possível interpretar o anúncio gerado." };
    return { ok: true, anuncio: parsed.data };
  } catch {
    return { ok: false, error: "Erro ao gerar o anúncio." };
  }
}
