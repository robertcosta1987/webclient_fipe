// DELETE /api/me — erase/anonymize the authenticated user's own account
// (Art. 18 VI). Programmatic counterpart to the "Excluir minha conta" UI action.
// Scoped by requireUserId(); honours Art. 16 (fiscal records are anonymized,
// not destroyed — see lib/lgpd/erase.ts). Ends the session on success.

import { requireUserId, destroySession } from "@/lib/auth/server";
import { eraseAccount } from "@/lib/lgpd/erase";

export const runtime = "nodejs"; // mssql needs Node, not the edge runtime
export const dynamic = "force-dynamic";

export async function DELETE(): Promise<Response> {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return new Response(JSON.stringify({ error: "Não autenticado." }), {
      status: 401,
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
    });
  }

  const summary = await eraseAccount(userId);
  await destroySession();
  return new Response(JSON.stringify({ ok: true, summary }), {
    status: 200,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}
