// infocar/page.tsx — "Infocar": FIPE / vehicle-data lookup by plate via the
// Infocar function, plus inline owner-scoped consultation history (mirrors the
// Tabela KBB and CheckTudo pages). History is kept indefinitely.

import { Suspense } from "react";
import Link from "next/link";
import { InfocarClient } from "./InfocarClient";
import { HistoricoInfocarList } from "./HistoricoInfocarList";
import { listRecent, type InfocarConsultaRow } from "@/lib/db/infocarConsultas";
import { requireScope } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export default async function InfocarPage() {
  let rows: InfocarConsultaRow[] = [];
  try {
    const { userId, master } = await requireScope();
    rows = await listRecent(master ? null : userId, 200);
  } catch {
    rows = [];
  }

  return (
    <section className="space-y-10">
      <div>
        <header className="mb-7">
          <div className="flex items-center gap-3 mb-1 rise rise-d1">
            <span className="block w-1 h-6 bg-[var(--accent)]" />
            <span className="font-display uppercase tracking-[0.22em] text-xs text-[var(--accent)]">
              Operação · Consulta
            </span>
          </div>
          <h1 className="font-display uppercase tracking-[0.04em] text-[var(--fg-strong)] text-4xl leading-none rise rise-d2">
            Infocar
          </h1>
          <p className="text-sm text-[var(--fg-muted)] mt-2 max-w-2xl rise rise-d2">
            Consulta de veículo por placa via Infocar — dados cadastrais, ficha do
            veículo e a tabela FIPE (código, descrição e valor). Resultados ficam
            salvos em cache por placa, mantidos por tempo indeterminado.
          </p>
        </header>
        <Suspense fallback={null}>
          <InfocarClient />
        </Suspense>
      </div>

      <div>
        <header className="flex flex-wrap items-end justify-between gap-4 mb-4">
          <div>
            <h2 className="font-display uppercase tracking-[0.04em] text-[var(--fg-strong)] text-2xl leading-none">
              Consultas salvas
            </h2>
            <p className="text-sm text-[var(--fg-muted)] mt-1">
              {rows.length === 0 ? (
                <>Nenhuma consulta ainda.</>
              ) : (
                <>
                  <span className="font-mono text-[var(--fg)]">{rows.length}</span> consulta
                  {rows.length === 1 ? "" : "s"} em cache.
                </>
              )}
            </p>
          </div>
          <Link href="/precos" className="btn-ghost text-sm">
            Tabela KBB →
          </Link>
        </header>
        <HistoricoInfocarList rows={rows} />
      </div>
    </section>
  );
}
