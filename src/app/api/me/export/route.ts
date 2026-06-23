// GET /api/me/export — the authenticated user's OWN data (access/portability,
// Art. 18 II/V). JSON by default; ?format=csv for the tabular variant. Scoped
// strictly by requireUserId(): no cross-user access. Never cached.

import type { NextRequest } from "next/server";
import { requireUserId } from "@/lib/auth/server";
import { collectUserData } from "@/lib/lgpd/export";
import { exportToCsv } from "@/lib/lgpd/csv";

export const runtime = "nodejs"; // mssql needs Node, not the edge runtime
export const dynamic = "force-dynamic";

function unauthorized(): Response {
  return new Response(JSON.stringify({ error: "Não autenticado." }), {
    status: 401,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

export async function GET(req: NextRequest): Promise<Response> {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return unauthorized();
  }

  const data = await collectUserData(userId);
  const stamp = new Date().toISOString().slice(0, 10);
  const wantsCsv = new URL(req.url).searchParams.get("format") === "csv";

  if (wantsCsv) {
    return new Response(exportToCsv(data as unknown as Record<string, unknown>), {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="meus-dados-${stamp}.csv"`,
        "cache-control": "no-store",
      },
    });
  }

  return new Response(JSON.stringify(data, null, 2), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="meus-dados-${stamp}.json"`,
      "cache-control": "no-store",
    },
  });
}
