"use client";

import { useState, useTransition } from "react";
import type { Carro } from "@/lib/db/carros";
import { deleteCarro, updateCarro } from "@/app/actions/carros";

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
    return new Date(s).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return s;
  }
};

export function CarrosTable({ rows, highlightPlaca, emptyMessage }: Props) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-12 text-center text-slate-500 text-sm">
        {emptyMessage ?? "Nenhum veículo encontrado."}
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wide">
          <tr>
            <th className="text-left px-3 py-2">Placa</th>
            <th className="text-left px-3 py-2">Modelo</th>
            <th className="text-left px-3 py-2">Ano</th>
            <th className="text-left px-3 py-2">Cor</th>
            <th className="text-left px-3 py-2">Município / UF</th>
            <th className="text-right px-3 py-2">Valor FIPE</th>
            <th className="text-left px-3 py-2">Criado em</th>
            <th className="text-right px-3 py-2">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
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
    <tr className={flash ? "animate-[flash_1.2s_ease-out_1]" : undefined}>
      <td className="px-3 py-2 font-mono">{row.placa}</td>
      <td className="px-3 py-2">
        {editing ? (
          <input value={draft.modelo ?? ""} onChange={(e) => set("modelo", e.target.value)} className={cellInput} />
        ) : (
          row.modelo ?? "—"
        )}
      </td>
      <td className="px-3 py-2 w-20">
        {editing ? (
          <input
            type="number"
            value={draft.ano_modelo ?? ""}
            onChange={(e) => set("ano_modelo", e.target.value === "" ? null : Number(e.target.value))}
            className={cellInput}
          />
        ) : (
          row.ano_modelo ?? "—"
        )}
      </td>
      <td className="px-3 py-2">
        {editing ? (
          <input value={draft.cor ?? ""} onChange={(e) => set("cor", e.target.value)} className={cellInput} />
        ) : (
          row.cor ?? "—"
        )}
      </td>
      <td className="px-3 py-2">
        {editing ? (
          <div className="flex gap-1">
            <input
              value={draft.municipio ?? ""}
              onChange={(e) => set("municipio", e.target.value)}
              className={cellInput}
              placeholder="município"
            />
            <input
              value={draft.uf ?? ""}
              onChange={(e) => set("uf", e.target.value.slice(0, 2).toUpperCase())}
              className={`${cellInput} w-14`}
              placeholder="UF"
            />
          </div>
        ) : (
          [row.municipio, row.uf].filter(Boolean).join(" / ") || "—"
        )}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">
        {editing ? (
          <input
            type="number"
            step="0.01"
            value={draft.valor_fipe ?? ""}
            onChange={(e) => set("valor_fipe", e.target.value === "" ? null : Number(e.target.value))}
            className={`${cellInput} text-right`}
          />
        ) : (
          fmtBRL(row.valor_fipe)
        )}
      </td>
      <td className="px-3 py-2 text-slate-500">{fmtDate(row.criado_em)}</td>
      <td className="px-3 py-2 text-right whitespace-nowrap">
        {err && <span className="text-xs text-rose-600 mr-2">{err}</span>}
        {editing ? (
          <>
            <button onClick={save} disabled={pending} className={btnPrimary}>Salvar</button>
            <button onClick={() => { setDraft(row); setEditing(false); setErr(null); }} disabled={pending} className={btnGhost}>
              Cancelar
            </button>
          </>
        ) : (
          <>
            <button onClick={() => setEditing(true)} className={btnGhost}>Editar</button>
            <button onClick={remove} disabled={pending} className={btnDanger}>Excluir</button>
          </>
        )}
      </td>
    </tr>
  );
}

const cellInput = "w-full rounded border border-slate-300 px-2 py-1 text-sm focus:border-emerald-500 focus:outline-none";
const btnGhost = "ml-2 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100 rounded";
const btnPrimary = "ml-2 px-2 py-1 text-xs bg-emerald-600 text-white hover:bg-emerald-700 rounded disabled:opacity-50";
const btnDanger = "ml-2 px-2 py-1 text-xs text-rose-700 hover:bg-rose-50 rounded";
