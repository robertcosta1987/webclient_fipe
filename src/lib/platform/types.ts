// platform/types.ts — Zod schema for the FLATTENED vehicle payload the CRM
// consumes. The Dadocar platform returns a wrapped aggregator response
// (see ../client.ts for the flattening step); this file describes the shape
// after flattening, which is what the rest of the app deals with.

import { z } from "zod";

export const VehiclePayloadSchema = z.object({
  placa: z.string(),
  chassi: z.string().optional().default(""),
  modelo: z.string().optional().default(""),
  anoFabricacao: z.coerce.number().int().nullable().optional(),
  anoModelo: z.coerce.number().int().nullable().optional(),
  cor: z.string().optional().default(""),
  combustivel: z.string().optional().default(""),
  uf: z.string().optional().default(""),
  municipio: z.string().optional().default(""),
  tipoVeiculo: z.string().optional().default(""),
  motor: z.string().optional().default(""),
  numeroCaixaCambio: z.string().optional().default(""),
  numeroEixoTraseiroDiferencial: z.string().optional().default(""),
  procedencia: z.string().optional().default(""),
  situacaoChassi: z.string().optional().default(""),
  capacidadeDeCarga: z.string().optional().default(""),
  potencia: z.string().optional().default(""),
  numeroCilindradas: z.string().optional().default(""),
  capacidadeDePassageiros: z.string().optional().default(""),
  tipoMontagem: z.string().optional().default(""),
  quantidadeDeEixos: z.string().optional().default(""),
  carroceria: z.string().optional().default(""),
  codigoFipe: z.string().optional().default(""),
  descricao: z.string().optional().default(""),    // FIPE description
  valor: z.string().optional().default(""),         // FIPE price as string from vendor
});

export type VehiclePayload = z.infer<typeof VehiclePayloadSchema>;

/** One FIPE catalogue entry — Infocar returns 0..N of these per plate.
 *  When there's more than one, the operator picks the correct trim/year. */
export const FipeOptionSchema = z.object({
  codigoFipe: z.string().optional().default(""),
  descricao: z.string().optional().default(""),
  valor: z.string().optional().default(""),
});
export type FipeOption = z.infer<typeof FipeOptionSchema>;

/** Parse the vendor's `valor` (FIPE price) into a number.
 *
 *  Observed format: `"70,851.00"` — comma is THOUSANDS separator, dot is
 *  decimal. This is the opposite of Brazilian convention but it's what
 *  Infocar returns. Centralized here so changing it is a one-liner.
 *  Returns null if blank / unparseable.
 */
export function parseValorFipe(raw: string | null | undefined): number | null {
  if (!raw || !raw.trim()) return null;
  const clean = raw.replace(/[^\d.\-]/g, ""); // drop the thousands commas
  if (!clean) return null;
  const n = Number(clean);
  return Number.isFinite(n) ? n : null;
}
