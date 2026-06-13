// lib/api/key.ts — issue/verify programmatic API keys.
//
// A key is a 40-hex random secret shown to the operator ONCE. We persist only
// its SHA-256 hash on the customer's user row (migration 0016). The key is bound
// to that user (and thus its subscription + consumption plan), so calls metered
// with it land in the same api_usage ledger as the UI.

import "server-only";
import { randomBytes, createHash } from "node:crypto";
import * as users from "@/lib/db/users";
import * as subs from "@/lib/db/subscriptions";
import { FIPE_PRODUCT_CODE } from "./fipeConsult";

const KEY_PREFIX = "p360_"; // human-recognizable; not secret

export function hashApiKey(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

function generateRawKey(): string {
  return KEY_PREFIX + randomBytes(20).toString("hex"); // p360_ + 40 hex chars
}

export type IssueResult =
  | { ok: true; apiKey: string; prefix: string; email: string; subscriptionId: string | null }
  | { ok: false; error: string };

/** Issue (or rotate) an API key for the customer identified by e-mail. Ensures
 *  the FIPE product (202) exists and is contracted on the subscription so the
 *  key can actually consult + bill. Returns the plaintext key ONCE. */
export async function issueApiKeyForEmail(email: string, opts: { priceBrl?: number | null } = {}): Promise<IssueResult> {
  const ctx = await users.getApiContextByEmail(email);
  if (!ctx) return { ok: false, error: `Nenhum usuário com o e-mail ${email}. Crie a assinatura primeiro em /admin/assinaturas.` };

  // Make sure the FIPE consult is sellable + contracted (so reserve/record work).
  try {
    await subs.ensureApiProduct("checktudo", FIPE_PRODUCT_CODE, "Decodificador e Precificador (FIPE)", opts.priceBrl ?? null);
    if (ctx.subscriptionId) {
      await subs.addQuota({ subscriptionId: ctx.subscriptionId, api: "checktudo", productCode: FIPE_PRODUCT_CODE, granted: null });
    }
  } catch { /* best-effort; key still issues */ }

  const raw = generateRawKey();
  const prefix = raw.slice(0, 12); // e.g. p360_1a2b3c4
  await users.setApiKey(ctx.id, hashApiKey(raw), prefix);
  return { ok: true, apiKey: raw, prefix, email: ctx.email, subscriptionId: ctx.subscriptionId };
}
