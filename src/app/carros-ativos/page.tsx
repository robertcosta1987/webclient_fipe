import { CarrosTable } from "@/components/CarrosTable";
import { list } from "@/lib/db/carros";
import { requireUserId } from "@/lib/auth/server";

export const dynamic = "force-dynamic"; // server-rendered; no static cache

type SearchParams = Promise<{ novo?: string; placa?: string }>;

export default async function CarrosAtivosPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const ownerId = await requireUserId();
  const rows = await list(ownerId);
  const highlight = sp.novo || sp.placa;
  return (
    <section>
      <header className="flex items-end justify-between mb-7">
        <div>
          <div className="flex items-center gap-3 mb-1 rise rise-d1">
            <span className="block w-1 h-6 bg-[var(--accent)]" />
            <span className="font-display uppercase tracking-[0.22em] text-xs text-[var(--accent)]">
              Operação · Estoque
            </span>
          </div>
          <h1 className="font-display uppercase tracking-[0.04em] text-[var(--fg-strong)] text-4xl leading-none rise rise-d2">
            Carros Ativos
          </h1>
          <p className="text-sm text-[var(--fg-muted)] mt-2 rise rise-d2">
            {rows.length === 0
              ? "Nenhum veículo cadastrado ainda. Use “+ Adicionar Veículo” para começar."
              : <>
                  <span className="font-mono text-[var(--fg)]">{rows.length}</span> veículo{rows.length === 1 ? "" : "s"} no pátio.
                </>}
          </p>
        </div>
      </header>
      <CarrosTable rows={rows} highlightPlaca={highlight ?? undefined} />
    </section>
  );
}
