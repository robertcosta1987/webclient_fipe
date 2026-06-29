// lib/lgpd/scrubPii.ts — remove the vehicle OWNER's personal data from a cached
// consult payload while keeping all VEHICLE data (the enrichment MOAT). Pure and
// recursive so it can be unit-tested and reused by both the erasure flow and the
// retention job. We strip whole owner keys (and their nested content) by name —
// vehicle fields use marca/modelo/descricao/fipe/etc., never these keys.

// Owner-identifying keys (compared case-insensitively). Removing the key removes
// any nested name/CPF/doc under it too.
const OWNER_PII_KEYS = new Set<string>([
  "proprietario",
  "proprietarioatual",
  "proprietarios",
  "historicoproprietarios",
  "nomeproprietario",
  "cpf",
  "cpfcnpj",
  "cnpj",
  "documento",
  "rg",
  "nomemae",
  "datanascimento",
  "nascimento",
]);

function isOwnerKey(key: string): boolean {
  return OWNER_PII_KEYS.has(key.toLowerCase().replace(/[\s_-]/g, ""));
}

/** Return a deep copy of `value` with every owner-PII key removed. Vehicle data
 *  is untouched. Safe on any JSON shape (objects, arrays, primitives, null). */
export function scrubOwnerPii<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((v) => scrubOwnerPii(v)) as unknown as T;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (isOwnerKey(k)) continue; // drop owner key entirely
      out[k] = scrubOwnerPii(v);
    }
    return out as unknown as T;
  }
  return value;
}

/** True if the payload still contains any owner-PII key (used to decide whether a
 *  stored row needs scrubbing). */
export function hasOwnerPii(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasOwnerPii);
  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (isOwnerKey(k)) return true;
      if (hasOwnerPii(v)) return true;
    }
  }
  return false;
}

/** Scrub a JSON string payload; returns the scrubbed JSON string, or the original
 *  string unchanged if it isn't parseable. */
export function scrubPayloadJson(payloadJson: string): string {
  let parsed: unknown;
  try { parsed = JSON.parse(payloadJson); } catch { return payloadJson; }
  return JSON.stringify(scrubOwnerPii(parsed));
}
