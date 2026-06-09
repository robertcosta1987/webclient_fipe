// precos/page.tsx — "Tabela KBB": KBB/Molicar lookup + inline saved-search
// history (mirrors the CheckTudo page). History is owner-scoped.

import { Suspense } from "react";
import Link from "next/link";
import { PrecosClient } from "./PrecosClient";
import { HistoricoKbbList } from "@/app/historico-kbb/HistoricoKbbList";
import { listRecent, type KbbConsultaRow } from "@/lib/db/kbbConsultas";
import { requireScope } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export default async function PrecosPage() {
  let rows: KbbConsultaRow[] = [];
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
              Operação · Cotação
            </span>
          </div>
          <h1 className="font-display uppercase tracking-[0.04em] text-[var(--fg-strong)] text-4xl leading-none rise rise-d2">
            Tabela KBB
          </h1>
          <p className="text-sm text-[var(--fg-muted)] mt-2 max-w-2xl rise rise-d2">
            Consulta de preços por placa via Molicar (decoder + KBB). Mostra as
            faixas KBB (zero-km, varejo, particular, troca, atacado), o preço
            Molicar e os dados do veículo. Resultados ficam salvos em cache por placa.
          </p>
        </header>
        <Suspense fallback={null}>
          <PrecosClient />
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
          <Link href="/checktudo" className="btn-ghost text-sm">
            Checa Tudo →
          </Link>
        </header>
        <HistoricoKbbList rows={rows} />
      </div>
    </section>
  );
}
