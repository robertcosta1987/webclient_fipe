import { BuscarClient } from "./BuscarClient";
import { list } from "@/lib/db/carros";
import "./xp.css";

export const dynamic = "force-dynamic";

// ── Windows XP nostalgic skin toggle ────────────────────────────────────────
// Flip to `false` to instantly restore the normal Buscar look (everything in
// xp.css is scoped under `.xp-skin`, so nothing else changes). See xp.css for
// full removal steps.
const XP_THEME = true;

export default async function BuscarPage() {
  // Seed the page with the latest 50 — so opening /buscar with an empty
  // query already shows something useful instead of a blank state.
  const initial = await list();
  return (
    <section className={XP_THEME ? "xp-skin" : undefined}>
      <header className="mb-7 xp-page-header">
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
