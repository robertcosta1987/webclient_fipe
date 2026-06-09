import Link from "next/link";
import { listRecent } from "@/lib/db/kbbConsultas";
import { HistoricoKbbList } from "./HistoricoKbbList";
import { requireUserId } from "@/lib/auth/server";

export const dynamic = "force-dynamic"; // server-rendered; no static cache

export default async function HistoricoKbbPage() {
  const ownerId = await requireUserId();
  const rows = await listRecent(ownerId, 200);
  return (
    <section>
      <header className="flex flex-wrap items-end justify-between gap-4 mb-7">
        <div>
          <div className="flex items-center gap-3 mb-1 rise rise-d1">
            <span className="block w-1 h-6 bg-[var(--accent)]" />
            <span className="font-display uppercase tracking-[0.22em] text-xs text-[var(--accent)]">
              Operação · Histórico
            </span>
          </div>
          <h1 className="font-display uppercase tracking-[0.04em] text-[var(--fg-strong)] text-4xl leading-none rise rise-d2">
            Histórico de Consultas KBB
          </h1>
          <p className="text-sm text-[var(--fg-muted)] mt-2 max-w-2xl rise rise-d2">
            {rows.length === 0 ? (
              <>Nenhuma consulta ainda. Faça uma busca em <Link href="/precos" className="underline">/precos</Link> para popular o histórico.</>
            ) : (
              <>
                <span className="font-mono text-[var(--fg)]">{rows.length}</span> consulta{rows.length === 1 ? "" : "s"} salva{rows.length === 1 ? "" : "s"}. Cada placa fica em cache por <span className="text-[var(--fg)]">90 dias</span> — repetir a busca dentro desse período não consome cota do Molicar.
              </>
            )}
          </p>
        </div>
        <Link href="/precos" className="btn-primary text-sm">
          + Nova Consulta
        </Link>
      </header>

      <HistoricoKbbList rows={rows} />
    </section>
  );
}
