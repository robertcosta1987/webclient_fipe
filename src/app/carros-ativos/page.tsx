import { CarrosTable } from "@/components/CarrosTable";
import { list } from "@/lib/db/carros";

export const dynamic = "force-dynamic"; // server-rendered; no static cache

type SearchParams = Promise<{ novo?: string; placa?: string }>;

export default async function CarrosAtivosPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const rows = await list();
  const highlight = sp.novo || sp.placa;
  return (
    <section>
      <header className="flex items-end justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Carros Ativos</h1>
          <p className="text-sm text-slate-500">
            {rows.length === 0
              ? "Nenhum veículo cadastrado ainda. Use “+ Adicionar Veículo” para começar."
              : `${rows.length} veículo${rows.length === 1 ? "" : "s"} cadastrado${rows.length === 1 ? "" : "s"}.`}
          </p>
        </div>
      </header>
      <CarrosTable rows={rows} highlightPlaca={highlight ?? undefined} />
    </section>
  );
}
