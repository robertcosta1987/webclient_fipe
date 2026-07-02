// POST /api/admin/subscriptions — token-authed partner provisioning for the CRM.
// Creates (idempotently) a subscription scoped to the FIPE endpoint (product 202) and returns
// its programmatic API key ONCE. Bearer PLACAS_ADMIN_TOKEN (distinct from user sessions).
// Body: { name, email, company, cnpj? }  →  { ok, api_key, email, subscription_name, created }.
// Body: { action: "revoke", email }       →  disables the partner's api_access.

import { timingSafeEqual } from "node:crypto";
import { provisionPartner, revokePartner } from "@/lib/api/partnerProvision";

export const runtime = "nodejs"; // mssql needs Node, not the edge runtime
export const dynamic = "force-dynamic";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

function authorized(req: Request): boolean {
  const expected = process.env.PLACAS_ADMIN_TOKEN ?? "";
  if (!expected) return false;
  const got = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  const a = Buffer.from(got);
  const b = Buffer.from(expected);
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}

export async function POST(req: Request): Promise<Response> {
  if (!process.env.PLACAS_ADMIN_TOKEN) {
    return json({ ok: false, error: "admin desativado: PLACAS_ADMIN_TOKEN ausente" }, 503);
  }
  if (!authorized(req)) return json({ ok: false, error: "unauthorized" }, 401);

  let body: {
    action?: string;
    name?: string;
    email?: string;
    company?: string;
    cnpj?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "JSON inválido." }, 400);
  }

  if (body.action === "revoke") {
    const r = await revokePartner(String(body.email ?? ""));
    return json(r, r.ok ? 200 : 400);
  }

  const r = await provisionPartner({
    name: String(body.name ?? ""),
    email: String(body.email ?? ""),
    company: String(body.company ?? ""),
    cnpj: body.cnpj ?? null,
  });
  if (!r.ok) return json(r, 400);
  return json(
    { ok: true, api_key: r.apiKey, email: r.email, subscription_name: r.subscriptionName, created: r.created },
    201,
  );
}
