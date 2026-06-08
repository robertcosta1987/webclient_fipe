import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/server";
import { listInvites } from "@/lib/db/users";
import { ConvitesClient } from "./ConvitesClient";

export const dynamic = "force-dynamic";

export default async function ConvitesPage() {
  const session = await getSession();
  if (!session || session.role !== "admin") redirect("/carros-ativos");

  const invites = await listInvites(200);
  const view = invites.map((i) => ({
    code: i.code,
    used: Boolean(i.used_by),
    created_at: typeof i.created_at === "string" ? i.created_at : new Date(i.created_at).toISOString(),
    used_at: i.used_at ? (typeof i.used_at === "string" ? i.used_at : new Date(i.used_at).toISOString()) : null,
  }));

  return (
    <section>
      <header className="mb-7">
        <div className="flex items-center gap-3 mb-1 rise rise-d1">
          <span className="block w-1 h-6 bg-[var(--accent)]" />
          <span className="font-display uppercase tracking-[0.22em] text-xs text-[var(--accent)]">
            Administração · Acesso
          </span>
        </div>
        <h1 className="font-display uppercase tracking-[0.04em] text-[var(--fg-strong)] text-4xl leading-none rise rise-d2">
          Convites
        </h1>
        <p className="text-sm text-[var(--fg-muted)] mt-2 rise rise-d2">
          Gere códigos de convite para liberar novos cadastros. Cada código vale um único acesso.
        </p>
      </header>
      <ConvitesClient invites={view} />
    </section>
  );
}
