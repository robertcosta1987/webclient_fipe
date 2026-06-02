// precos/page.tsx — server shell for the KBB / Preços page.
//
// The actual interactivity (plate input, fetch, render) lives in the client
// component; this file is just the section header pattern used elsewhere in
// the app for consistency.

import { Suspense } from "react";
import { PrecosClient } from "./PrecosClient";

export const dynamic = "force-dynamic";

export default function PrecosPage() {
  return (
    <section>
      <header className="mb-7">
        <div className="flex items-center gap-3 mb-1 rise rise-d1">
          <span className="block w-1 h-6 bg-[var(--accent)]" />
          <span className="font-display uppercase tracking-[0.22em] text-xs text-[var(--accent)]">
            Operação · Cotação
          </span>
        </div>
        <h1 className="font-display uppercase tracking-[0.04em] text-[var(--fg-strong)] text-4xl leading-none rise rise-d2">
          KBB / Preços
        </h1>
        <p className="text-sm text-[var(--fg-muted)] mt-2 max-w-2xl rise rise-d2">
          Consulta de preços por placa via Molicar (decoder + KBB). Mostra as
          5 faixas KBB (zero-km, varejo, particular, troca, atacado) com
          mínimo, máximo e preço justo, além do preço Molicar e dos dados do
          veículo. Resultados ficam em cache por 90 dias e disponíveis em
          <span className="font-mono"> /historico-kbb</span>.
        </p>
      </header>
      <Suspense fallback={null}>
        <PrecosClient />
      </Suspense>
    </section>
  );
}
