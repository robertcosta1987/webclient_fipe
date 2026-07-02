import "server-only";

// partnerProvision.ts — idempotent provisioning of a PARTNER subscription limited to the
// FIPE endpoint (product 202). Used by the token-authed admin route the CRM calls, so a
// dealership that buys "Placas 360" in the CRM gets a programmatic key that can ONLY do the
// FIPE-by-plate consult (202) — no other CheckTudo consult is reachable via the partner API.

import { randomBytes } from "node:crypto";
import { hashPassword } from "@/lib/auth/password";
import * as users from "@/lib/db/users";
import * as subs from "@/lib/db/subscriptions";
import * as customers from "@/lib/db/customers";
import { issueApiKeyForEmail } from "@/lib/api/key";
import { FIPE_PRODUCT_CODE } from "@/lib/api/fipeConsult";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PW = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

function tempPassword(len = 14): string {
  const b = randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += PW[b[i]! % PW.length];
  return out;
}
function slug(s: string): string {
  return (
    s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 12) ||
    "CLIENTE"
  );
}

export type PartnerProvisionInput = {
  name: string;
  email: string;
  company: string;
  cnpj?: string | null;
};

export type PartnerProvisionResult =
  | { ok: true; apiKey: string; email: string; subscriptionName: string; created: boolean }
  | { ok: false; error: string };

/**
 * Provision (idempotent) a partner subscription scoped to product 202 and return its API key.
 * New e-mail → create subscription (ondemand, billed by the CRM) + user; existing e-mail → reuse.
 * Always: contract ONLY 202, enable `api_access`, issue the key. Re-running rotates the key.
 */
export async function provisionPartner(input: PartnerProvisionInput): Promise<PartnerProvisionResult> {
  const email = (input.email ?? "").trim().toLowerCase();
  const company = (input.company ?? input.name ?? "").trim();
  if (!EMAIL_RE.test(email)) return { ok: false, error: "E-mail inválido." };
  if (!company) return { ok: false, error: "Informe a empresa." };

  let created = false;
  const ctx = await users.getApiContextByEmail(email);
  let subscriptionId: string | null = ctx?.subscriptionId ?? null;

  if (!ctx) {
    const subKey = `SUB-${slug(company)}-${randomBytes(2).toString("hex").toUpperCase()}`;
    const sub = await subs.createSubscription({
      name: company,
      subKey,
      planType: "ondemand", // open-ended; the CRM meters/bills FIPE consults
      queryLimit: null,
      spendLimitBrl: null,
    });
    subscriptionId = sub.id;
    const { hash, salt } = await hashPassword(tempPassword());
    const u = await users.createUser({
      email,
      name: input.name?.trim() || company,
      passwordHash: hash,
      passwordSalt: salt,
      role: "user",
      subscriptionId,
      mustChangePassword: true,
    });
    created = true;
    try {
      await customers.createCustomer({
        name: input.name?.trim() || company,
        company,
        cnpj: (input.cnpj ?? "").replace(/\D/g, "") || null,
        email,
        subscriptionId,
        userId: u.id,
      });
    } catch {
      /* CRM registry row is non-critical */
    }
  }

  // Contract ONLY the FIPE product (202) + enable programmatic access. issueApiKeyForEmail also
  // ensures 202 is contracted (partner cost pricing) and returns the raw key once.
  if (subscriptionId) {
    try {
      await subs.addQuota({ subscriptionId, api: "checktudo", productCode: FIPE_PRODUCT_CODE, granted: null });
    } catch {
      /* keep going */
    }
    try {
      await subs.setApiAccess(subscriptionId, true);
    } catch {
      /* keep going */
    }
  }

  const r = await issueApiKeyForEmail(email);
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, apiKey: r.apiKey, email, subscriptionName: company, created };
}

/** Deprovision: disable programmatic access for the partner (key stops working). */
export async function revokePartner(email: string): Promise<{ ok: boolean; error?: string }> {
  const e = (email ?? "").trim().toLowerCase();
  const ctx = await users.getApiContextByEmail(e);
  if (!ctx?.subscriptionId) return { ok: true };
  await subs.setApiAccess(ctx.subscriptionId, false);
  return { ok: true };
}
