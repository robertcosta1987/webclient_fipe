"use client";

import { useState, useTransition } from "react";
import { CarrosTable } from "@/components/CarrosTable";
import type { Carro } from "@/lib/db/carros";
import { searchCarros } from "@/app/actions/carros";

const SCOPES: Array<{ value: string; label: string }> = [
  { value: "qualquer", label: "Qualquer campo" },
  { value: "placa", label: "Placa" },
  { value: "chassi", label: "Chassi" },
  { value: "modelo", label: "Modelo" },
  { value: "cor", label: "Cor" },
  { value: "municipio", label: "Município" },
  { value: "uf", label: "UF" },
  { value: "combustivel", label: "Combustível" },
  { value: "ano_modelo", label: "Ano do modelo" },
  { value: "codigo_fipe", label: "Código FIPE" },
];

export function BuscarClient({ initial }: { initial: Carro[] }) {
  const [q, setQ] = useState("");
  const [scope, setScope] = useState<string>("qualquer");
  const [rows, setRows] = useState<Carro[]>(initial);
  const [pending, start] = useTransition();

  function runSearch(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      // Cast: server action accepts the union; we trust the dropdown to
      // emit only valid values.
      const next = await searchCarros(q, scope as Parameters<typeof searchCarros>[1]);
      setRows(next);
    });
  }

  return (
    <div className="space-y-4">
      <form onSubmit={runSearch} className="flex flex-wrap gap-2 items-end bg-white border border-slate-200 rounded-lg p-3">
        <div className="flex-1 min-w-[16rem]">
          <label className="block text-xs text-slate-600 mb-1">Termo</label>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ex.: SAVEIRO, BELO HORIZONTE, 2019…"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-600 mb-1">Campo</label>
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
          >
            {SCOPES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={pending}
          className="px-4 py-2 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium shadow-sm disabled:opacity-50"
        >
          {pending ? "Buscando…" : "Buscar"}
        </button>
        <button
          type="button"
          onClick={() => { setQ(""); setScope("qualquer"); setRows(initial); }}
          className="px-3 py-2 rounded-md text-sm text-slate-600 hover:bg-slate-100"
        >
          Limpar
        </button>
      </form>
      <CarrosTable rows={rows} emptyMessage="Nenhum veículo bate com a busca." />
    </div>
  );
}
