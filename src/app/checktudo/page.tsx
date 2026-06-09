// checktudo/page.tsx — server shell for the CheckTudo page.
//
// Renders the section header + the interactive client (plate input, product
// selector, tailored renderer) and, below it, the inline saved-search history
// (the "cached/saved searches"). History is loaded server-side; a DB failure
// (e.g. migration 0003 not yet applied) degrades to an empty list rather than a
// 500.

import { Suspense } from "react";
import Link from "next/link";
import { CheckTudoClient } from "./CheckTudoClient";
import { ChecktudoHistory } from "./ChecktudoHistory";
import { listRecent, type ChecktudoConsultaRow } from "@/lib/db/checktudoConsultas";
import { requireScope } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export default async function CheckTudoPage() {
  let rows: ChecktudoConsultaRow[] = [];
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
              Operação · Dados Veiculares
            </span>
          </div>
          <h1 className="font-display uppercase tracking-[0.04em] text-[var(--fg-strong)] text-4xl leading-none rise rise-d2">
            CheckTudo
          </h1>
          <p className="text-sm text-[var(--fg-muted)] mt-2 max-w-2xl rise rise-d2">
            Consulta de dados veiculares por placa via CheckTudo. Escolha o
            produto (Veículo Total, Essencial, Decodificador, etc.) e a resposta
            é renderizada por seções. Resultados ficam salvos em cache por placa +
            produto — repetir a busca não consome nova consulta.
          </p>
        </header>
        <Suspense fallback={null}>
          <CheckTudoClient />
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
          <Link href="/historico-kbb" className="btn-ghost text-sm">
            Histórico KBB →
          </Link>
        </header>
        <ChecktudoHistory rows={rows} />
      </div>
    </section>
  );
}
