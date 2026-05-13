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
      const next = await searchCarros(q, scope as Parameters<typeof searchCarros>[1]);
      setRows(next);
    });
  }

  return (
    <div className="space-y-5">
      <form onSubmit={runSearch} className="surface flex flex-wrap gap-3 items-end p-4 rise rise-d3">
        <div className="flex-1 min-w-[18rem]">
          <label className="block text-[10px] uppercase tracking-[0.16em] text-[var(--fg-muted)] mb-1">Termo</label>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ex.: SAVEIRO, BELO HORIZONTE, 2019…"
            className="input"
          />
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-[0.16em] text-[var(--fg-muted)] mb-1">Campo</label>
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            className="input"
          >
            {SCOPES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={pending}
          className="btn-primary text-sm"
        >
          {pending ? "Buscando…" : "Buscar"}
        </button>
        <button
          type="button"
          onClick={() => { setQ(""); setScope("qualquer"); setRows(initial); }}
          className="btn-ghost text-sm"
        >
          Limpar
        </button>
      </form>
      <CarrosTable rows={rows} emptyMessage="Nenhum veículo bate com a busca." />
    </div>
  );
}
