// types.ts — schema + constants for the CheckTudo function response.
//
// The CheckTudo function returns a unified envelope; the inner `data` is the
// product's responseJSON and its shape varies per querycode, so we keep it
// permissive (`unknown`) and let the page's dictionary-driven renderer walk it.

import { z } from "zod";

/** Selectable products — mirrors PRODUCTS in the function's checktudo.js. */
export const CHECKTUDO_PRODUCTS: ReadonlyArray<{ code: number; name: string }> = [
  { code: 66, name: "Veículo Total" },
  { code: 67, name: "Veículo Essencial" },
  { code: 13, name: "Decodificador e Precificador" },
  { code: 71, name: "Dados Cadastrais do Veículo" },
  { code: 76, name: "Decodificador + Histórico FIPE" },
  { code: 241, name: "Decodificador V.4" },
];

export const CHECKTUDO_DEFAULT_PRODUCT = 66;

export function isValidProduct(code: number): boolean {
  return CHECKTUDO_PRODUCTS.some((p) => p.code === code);
}

export function productName(code: number): string {
  return CHECKTUDO_PRODUCTS.find((p) => p.code === code)?.name ?? `Consulta ${code}`;
}

/** The function's success/failure envelope. `data` stays permissive. */
export const ChecktudoEnvelopeSchema = z
  .object({
    ok: z.boolean(),
    product: z.object({ code: z.number(), name: z.string() }).optional(),
    queryId: z.string().nullable().optional(),
    refClass: z.string().nullable().optional(),
    data: z.unknown().optional(),
    latency_ms: z.number().nullable().optional(),
    cached_upstream: z.boolean().optional(),
    poll_attempts: z.number().nullable().optional(),
    error: z.string().optional(),
    message: z.string().optional(),
    upstream_status: z.number().nullable().optional(),
  })
  .passthrough();

export type ChecktudoEnvelope = z.infer<typeof ChecktudoEnvelopeSchema>;

/** Arbitrary nested object returned under `data`. */
export type ChecktudoData = Record<string, unknown>;
