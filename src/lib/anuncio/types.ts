// lib/anuncio/types.ts — shapes for the "Gerar Anúncio" feature (AI sales listing).
// Plain module (no "use server"): the server action imports the schema, the
// client imports the types.

import { z } from "zod";

/** Vehicle data sent to the generator (from the page form / enriched JSON). */
export type AdInput = {
  placa: string | null;
  marca: string | null;
  modelo: string | null;       // já combinado (modelo + versão)
  versao: string | null;
  anoFabricacao: string | null;
  anoModelo: string | null;
  corVeiculo: string | null;
  combustivel: string | null;
  potencia: string | null;
  cilindradas: string | null;
  caixaCambio: string | null;
  municipio: string | null;
  valorFipe: number | null;
  fipeReferencia: string | null; // mês/ano de referência da FIPE (ex.: "06/2026")
  opcionais: string | null;      // texto livre do vendedor (ex.: "Blindado, teto solar")
};

export const AnuncioSchema = z.object({
  titulo: z.string(),
  subtitulo: z.string(),
  destaques: z.array(z.string()),
  descricao: z.string(),
  precoTexto: z.string(),
  hashtags: z.array(z.string()),
  portais: z.object({
    webmotors: z.string(),
    olx: z.string(),
    social: z.string(),
    whatsapp: z.string(),
  }),
});
export type Anuncio = z.infer<typeof AnuncioSchema>;

export type AnuncioResult = { ok: true; anuncio: Anuncio } | { ok: false; error: string };
export type PublishResult = { ok: true; url: string } | { ok: false; error: string };
