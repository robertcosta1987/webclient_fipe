// admin/tenants/page.tsx — "Assinaturas / Tenants". Admin/master only. See, edit, create
// (via /admin/assinaturas) and delete every tenant (subscription + customer + login + key).

import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/server";
import { listTenants } from "@/lib/db/tenants";
import { TenantsClient } from "./TenantsClient";

export const dynamic = "force-dynamic";

export default async function TenantsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/precos");

  const rows = await listTenants();

  return (
    <section>
      <header className="mb-7 flex items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="block w-1 h-6 bg-[var(--accent)]" />
            <span className="font-display uppercase tracking-[0.22em] text-xs text-[var(--accent)]">
              Administração · Tenants
            </span>
          </div>
          <h1 className="font-display uppercase tracking-[0.04em] text-[var(--fg-strong)] text-4xl leading-none">
            Assinaturas
          </h1>
          <p className="text-sm text-[var(--fg-muted)] mt-2 max-w-2xl">
            Todos os clientes (assinatura + empresa + login + chave de API). Edite o plano, ligue/desligue
            o acesso programático, rotacione a chave ou exclua. {rows.length} tenant(s).
          </p>
        </div>
        <Link
          href="/admin/assinaturas"
          className="shrink-0 rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-black hover:opacity-90"
        >
          + Nova assinatura
        </Link>
      </header>
      <TenantsClient rows={rows} />
    </section>
  );
}
