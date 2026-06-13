// GET /api/v1/fipe/plate/{placa} — programmatic FIPE lookup for API customers.
//
// Auth: Bearer token (or x-api-key header) = the customer's API key. The call is
// metered through the same api_usage ledger + consumption plan as the UI: the
// customer's first lookup of a plate is a billable LIVE consult; their repeats
// hit the per-tenant cache (counted, not charged). Returns FIPE price, FIPE code
// and 12-month history (CheckTudo querycode 202).
//
// Example:
//   curl -H "Authorization: Bearer p360_…" \
//     https://<host>/api/v1/fipe/plate/ABC1D23

import type { NextRequest } from "next/server";
import { hashApiKey } from "@/lib/api/key";
import { findByApiKeyHash } from "@/lib/db/users";
import { runFipeConsult } from "@/lib/api/fipeConsult";

export const runtime = "nodejs"; // mssql needs Node, not the edge runtime
export const dynamic = "force-dynamic";
export const maxDuration = 60;

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

export async function GET(req: NextRequest, { params }: { params: Promise<{ placa: string }> }) {
  const rawKey = readKey(req);
  if (!rawKey) return json({ ok: false, error: "Chave de API ausente. Envie 'Authorization: Bearer <chave>'." }, 401);

  const ctx = await findByApiKeyHash(hashApiKey(rawKey)).catch(() => null);
  if (!ctx) return json({ ok: false, error: "Chave de API inválida." }, 401);

  const { placa } = await params;
  const r = await runFipeConsult({ userId: ctx.id, placa });
  if (!r.ok) return json({ ok: false, error: r.error }, r.status);

  return json({
    ok: true,
    placa: r.placa,
    source: r.fromCache ? "cache" : "live",
    consultaId: r.consultaId,
    fipe: r.fipe,
  }, 200);
}
