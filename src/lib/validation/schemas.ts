// lib/validation/schemas.ts — server-side input validation (zod) for handlers that
// write personal data (Art. 46 — segurança; defesa contra entradas malformadas).
// Pure (no DB), so the schemas are unit-testable.

import { z } from "zod";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Registration / account creation input. */
export const registerSchema = z.object({
  name: z.string().trim().max(120).optional().default(""),
  email: z.string().trim().toLowerCase().regex(EMAIL_RE, "E-mail inválido").max(254),
  password: z.string().min(8, "Senha muito curta").max(200),
  invite: z.string().trim().min(1).max(40),
});

/** Admin-provisioned customer identity (the PII subset). */
export const customerIdentitySchema = z.object({
  nome: z.string().trim().min(1).max(120),
  empresa: z.string().trim().min(1).max(160),
  email: z.string().trim().toLowerCase().regex(EMAIL_RE, "E-mail inválido").max(254),
});

// A free-form vehicle payload arrives as an object of optional fields. We don't
// enumerate every column here (they vary by source); instead we bound EVERY value
// to a safe type/length, rejecting oversized or wrong-typed input. SQL values are
// always parameterized downstream — this is an extra guard, not the only one.
const fieldValue = z.union([z.string().max(2000), z.number(), z.boolean(), z.null()]);

/** Validate a vehicle write payload (carros_ativos / test_vehicles). Keys are
 *  bounded; values are bounded scalars. Returns true when safe. */
export function isValidVehicleWrite(payload: unknown): boolean {
  const schema = z.record(z.string().max(64), fieldValue);
  return schema.safeParse(payload).success;
}

/** Validate a partial-update patch (only bounded scalar values allowed). */
export function isValidPatch(patch: unknown): boolean {
  return z.record(z.string().max(64), fieldValue).safeParse(patch).success;
}
