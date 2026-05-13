import { BuscarClient } from "./BuscarClient";
import { list } from "@/lib/db/carros";

export const dynamic = "force-dynamic";

export default async function BuscarPage() {
  // Seed the page with the latest 50 — so opening /buscar with an empty
  // query already shows something useful instead of a blank state.
  const initial = await list();
  return (
    <section>
      <header className="mb-7">
        <div className="flex items-center gap-3 mb-1 rise rise-d1">
          <span className="block w-1 h-6 bg-[var(--accent)]" />
          <span className="font-display uppercase tracking-[0.22em] text-xs text-[var(--accent)]">
            Operação · Consulta
          </span>
        </div>
        <h1 className="font-display uppercase tracking-[0.04em] text-[var(--fg-strong)] text-4xl leading-none rise rise-d2">
          Buscar
        </h1>
        <p className="text-sm text-[var(--fg-muted)] mt-2 rise rise-d2">
          Pesquise por campo específico ou em qualquer campo de texto. Limite: 50 resultados.
        </p>
      </header>
      <BuscarClient initial={initial} />
    </section>
  );
}
