import { BuscarClient } from "./BuscarClient";
import { list } from "@/lib/db/carros";

export const dynamic = "force-dynamic";

export default async function BuscarPage() {
  // Seed the page with the latest 50 — so opening /buscar with an empty
  // query already shows something useful instead of a blank state.
  const initial = await list();
  return (
    <section>
      <header className="mb-4">
        <h1 className="text-xl font-semibold tracking-tight">Buscar</h1>
        <p className="text-sm text-slate-500">
          Pesquise por campo específico ou em qualquer campo de texto. Limite: 50 resultados.
        </p>
      </header>
      <BuscarClient initial={initial} />
    </section>
  );
}
