"use client";

import { useState, useTransition } from "react";
import type { Carro } from "@/lib/db/carros";
import { deleteCarro, updateCarro } from "@/app/actions/carros";
import { Plate } from "@/components/Plate";

type Props = {
  rows: Carro[];
  /** Plate of a row that should briefly flash on mount (e.g. "just added"). */
  highlightPlaca?: string;
  emptyMessage?: string;
};

const fmtBRL = (n: number | null) =>
  n == null ? "—" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

const fmtDate = (s: string) => {
  try {
    return new Date(s).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
  } catch {
    return s;
  }
};

export function CarrosTable({ rows, highlightPlaca, emptyMessage }: Props) {
  if (rows.length === 0) {
    return (
      <div className="surface rise rise-d3 px-6 py-16 text-center text-[var(--fg-muted)] text-sm border-dashed">
        <div className="font-display uppercase tracking-[0.2em] text-base text-[var(--fg)] mb-1">
          Garagem vazia
        </div>
        <p>{emptyMessage ?? "Nenhum veículo encontrado."}</p>
      </div>
    );
  }
  return (
    <div className="car-table rise rise-d3">
      <table className="w-full">
        <thead>
          <tr>
            <th>Placa</th>
            <th>Modelo</th>
            <th className="w-16">Ano</th>
            <th>Cor</th>
            <th>Município / UF</th>
            <th className="text-right">Valor FIPE</th>
            <th>Criado</th>
            <th className="text-right">Ações</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <Row key={r.id} row={r} flash={r.placa === highlightPlaca} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Row({ row, flash }: { row: Carro; flash: boolean }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Carro>(row);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function set<K extends keyof Carro>(k: K, v: Carro[K]) {
    setDraft((d) => ({ ...d, [k]: v }));
  }

  function save() {
    setErr(null);
    start(async () => {
      const res = await updateCarro(row.id, {
        modelo: draft.modelo ?? null,
        ano_modelo: draft.ano_modelo ?? null,
        cor: draft.cor ?? null,
        municipio: draft.municipio ?? null,
        uf: draft.uf ?? null,
        valor_fipe: draft.valor_fipe ?? null,
      });
      if (!res.ok) setErr(res.error);
      else setEditing(false);
    });
  }

  function remove() {
    if (!confirm(`Excluir ${row.placa}? Esta ação não pode ser desfeita.`)) return;
    setErr(null);
    start(async () => {
      const res = await deleteCarro(row.id);
      if (!res.ok) setErr(res.error);
    });
  }

  return (
    <tr className={flash ? "flash-once" : undefined}>
      <td>
        <Plate placa={row.placa} size="sm" />
      </td>
      <td>
        {editing ? (
          <input value={draft.modelo ?? ""} onChange={(e) => set("modelo", e.target.value)} className="input py-1" />
        ) : (
          <span className="text-[var(--fg)]">{row.modelo ?? "—"}</span>
        )}
      </td>
      <td>
        {editing ? (
          <input
            type="number"
            value={draft.ano_modelo ?? ""}
            onChange={(e) => set("ano_modelo", e.target.value === "" ? null : Number(e.target.value))}
            className="input py-1 w-20"
          />
        ) : (
          <span className="font-mono text-[var(--fg-muted)]">{row.ano_modelo ?? "—"}</span>
        )}
      </td>
      <td>
        {editing ? (
          <input value={draft.cor ?? ""} onChange={(e) => set("cor", e.target.value)} className="input py-1" />
        ) : (
          row.cor ?? "—"
        )}
      </td>
      <td>
        {editing ? (
          <div className="flex gap-1">
            <input
              value={draft.municipio ?? ""}
              onChange={(e) => set("municipio", e.target.value)}
              className="input py-1"
              placeholder="município"
            />
            <input
              value={draft.uf ?? ""}
              onChange={(e) => set("uf", e.target.value.slice(0, 2).toUpperCase())}
              className="input py-1 w-16"
              placeholder="UF"
            />
          </div>
        ) : (
          <span className="text-[var(--fg-muted)]">{[row.municipio, row.uf].filter(Boolean).join(" / ") || "—"}</span>
        )}
      </td>
      <td className="text-right tabular-nums">
        {editing ? (
          <input
            type="number"
            step="0.01"
            value={draft.valor_fipe ?? ""}
            onChange={(e) => set("valor_fipe", e.target.value === "" ? null : Number(e.target.value))}
            className="input py-1 text-right"
          />
        ) : (
          <span className="font-mono text-[var(--fg)]">{fmtBRL(row.valor_fipe)}</span>
        )}
      </td>
      <td className="text-[var(--fg-faint)] font-mono text-xs">{fmtDate(row.criado_em)}</td>
      <td className="text-right whitespace-nowrap">
        {err && <span className="text-xs text-[var(--danger)] mr-2">{err}</span>}
        {editing ? (
          <>
            <button onClick={save} disabled={pending} className="btn-primary text-xs px-2 py-1 ml-2">
              Salvar
            </button>
            <button onClick={() => { setDraft(row); setEditing(false); setErr(null); }} disabled={pending} className="btn-ghost text-xs ml-1">
              Cancelar
            </button>
          </>
        ) : (
          <>
            <button onClick={() => setEditing(true)} className="btn-ghost text-xs">Editar</button>
            <button onClick={remove} disabled={pending} className="btn-danger text-xs ml-1">Excluir</button>
          </>
        )}
      </td>
    </tr>
  );
}
