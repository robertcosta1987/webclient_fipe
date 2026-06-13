// GET /api/v1/fipe/plate/{placa} — programmatic FIPE lookup for API customers.
//
// Auth: Bearer token (or x-api-key) = the customer's API key. The subscription
// must be API-enabled (subscriptions.api_access) — otherwise the call is
// rejected, so only designated API customers can call programmatically; everyone
// else uses the authenticated web app. Metered through the same api_usage ledger
// + plan as the UI (first lookup of a plate = billable LIVE; repeats hit the
// per-tenant cache, not charged). Every call is audit-logged (api_request_logs).
//
// Example:
//   curl -H "Authorization: Bearer p360_…" https://<host>/api/v1/fipe/plate/ABC1D23

import type { NextRequest } from "next/server";
import { hashApiKey } from "@/lib/api/key";
import { findByApiKeyHash } from "@/lib/db/users";
import { runFipeConsult } from "@/lib/api/fipeConsult";
import { logApiRequest, type ApiRequestLog } from "@/lib/db/apiRequestLogs";

export const runtime = "nodejs"; // mssql needs Node, not the edge runtime
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ENDPOINT = "GET /api/v1/fipe/plate";

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

function readKey(req: NextRequest): string | null {
  const auth = req.headers.get("authorization");
  if (auth && /^Bearer\s+/i.test(auth)) return auth.replace(/^Bearer\s+/i, "").trim();
  const x = req.headers.get("x-api-key");
  return x ? x.trim() : null;
}

// Request metadata for the audit log (Vercel injects the geo headers).
function reqInfo(req: NextRequest) {
  const ip = (req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "").split(",")[0].trim() || null;
  return {
    ip,
    userAgent: (req.headers.get("user-agent") || "").slice(0, 400) || null,
    country: req.headers.get("x-vercel-ip-country") || null,
    city: (() => { try { return req.headers.get("x-vercel-ip-city") ? decodeURIComponent(req.headers.get("x-vercel-ip-city")!) : null; } catch { return req.headers.get("x-vercel-ip-city"); } })(),
  };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ placa: string }> }) {
  const startedAt = Date.now();
  const info = reqInfo(req);
  const { placa } = await params;
  const base: ApiRequestLog = {
    subscriptionId: null, userId: null, apiKeyPrefix: null, endpoint: ENDPOINT,
    placa: (placa || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10) || null,
    productCode: 202, outcome: "auth_failed", source: null, charged: false,
    errorCode: null, httpStatus: null, durationMs: null, consultaId: null, ...info,
  };
  // Await the audit-log write BEFORE responding — on serverless the function can
  // suspend after the response, dropping any fire-and-forget work.
  const done = (extra: Partial<ApiRequestLog>, status: number) =>
    logApiRequest({ ...base, ...extra, httpStatus: status, durationMs: Date.now() - startedAt });

  const rawKey = readKey(req);
  if (!rawKey) {
    await done({ outcome: "auth_failed", errorCode: "missing_key" }, 401);
    return json({ ok: false, error: "Chave de API ausente. Envie 'Authorization: Bearer <chave>'." }, 401);
  }

  const ctx = await findByApiKeyHash(hashApiKey(rawKey)).catch(() => null);
  if (!ctx) {
    await done({ outcome: "auth_failed", errorCode: "invalid_key" }, 401);
    return json({ ok: false, error: "Chave de API inválida." }, 401);
  }
  base.subscriptionId = ctx.subscriptionId;
  base.userId = ctx.id;
  base.apiKeyPrefix = ctx.apiKeyPrefix;

  if (!ctx.apiAccess) {
    await done({ outcome: "auth_failed", errorCode: "api_disabled" }, 403);
    return json({ ok: false, error: "Esta conta não está habilitada para acesso programático." }, 403);
  }

  const r = await runFipeConsult({ userId: ctx.id, placa });
  if (!r.ok) {
    await done({ outcome: "error", errorCode: "consult_failed" }, r.status);
    return json({ ok: false, error: r.error }, r.status);
  }

  // Charged only when it's a completed LIVE consult (cache hits are free).
  await done({ outcome: "ok", source: r.fromCache ? "cache" : "live", charged: !r.fromCache, consultaId: r.consultaId, placa: r.placa }, 200);
  return json({ ok: true, placa: r.placa, source: r.fromCache ? "cache" : "live", consultaId: r.consultaId, fipe: r.fipe }, 200);
}
