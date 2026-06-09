"use client";

// ChecktudoHistory.tsx — collapsible list of past CheckTudo consultations,
// shown inline on the /checktudo page (the "saved searches"). Each row deep-links
// back into a cache-hit consult for the same placa + product. Mirrors the
// /historico-kbb list.

import { useState } from "react";
import Link from "next/link";
import type { ChecktudoConsultaRow } from "@/lib/db/checktudoConsultas";
import { Plate } from "@/components/Plate";
import { recallAfetadoLabel } from "./CheckTudoClient";

const DATE_FMT = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
});

export function ChecktudoHistory({ rows }: { rows: ChecktudoConsultaRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="surface p-6 text-center text-sm text-[var(--fg-muted)]">
        Nenhuma consulta CheckTudo ainda. Faça uma busca acima para popular o histórico.
      </div>
    );
  }
  return (
    <ul className="space-y-2">
      {rows.map((r) => <ConsultaCard key={r.id} row={r} />)}
    </ul>
  );
}

function ConsultaCard({ row }: { row: ChecktudoConsultaRow }) {
  const [open, setOpen] = useState(false);
  const modelo = [row.brand, row.model].filter(Boolean).join(" ") || "Modelo não identificado";
  const when = new Date(row.consulted_at);
  const recall = recallAfetadoLabel(row.recall_afetado);

  return (
    <li className="surface overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className="w-full flex flex-wrap items-center gap-4 p-4 text-left hover:bg-[var(--bg-elev)]/40 transition-colors"
        aria-expanded={open}
      >
        <Plate placa={row.placa} size="md" />

        <div className="flex-1 min-w-[12rem]">
          <p className="text-sm text-[var(--fg-strong)] font-medium">
            {modelo}
            {row.model_year && <span className="text-[var(--fg-muted)] font-normal"> · {row.model_year}</span>}
          </p>
          <p className="text-xs text-[var(--fg-muted)]">{row.product_name ?? `Produto ${row.product_code}`}</p>
        </div>

        {row.recall_afetado && (
          <span
            className="text-[10px] uppercase tracking-[0.1em] font-bold px-2 py-1 rounded whitespace-nowrap"
            style={{ color: recall.color, border: `1px solid ${recall.color}` }}
            title="Veículo Listado Afetado? (recall)"
          >
            Afetado: {recall.label}
          </span>
        )}

        <div className="text-right">
          <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--fg-muted)]">Consultado em</p>
          <p className="text-xs font-mono text-[var(--fg)]">{DATE_FMT.format(when)}</p>
        </div>

        <span className={`text-[var(--fg-muted)] text-xs transition-transform ${open ? "rotate-90" : ""}`}>▶</span>
      </button>

      {open && (
        <div className="border-t border-[var(--border)] p-4 grid gap-4 sm:grid-cols-[1fr_auto]">
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 text-sm">
            <Cell label="Produto" value={`${row.product_name ?? row.product_code} (${row.product_code})`} />
            <Cell label="Chassi" value={row.chassi ?? "—"} mono />
            <Cell label="Latência upstream" value={row.upstream_latency_ms !== null ? `${row.upstream_latency_ms} ms` : "—"} mono />
            <Cell label="Query ID" value={row.query_id ?? "—"} mono />
            <Cell label="ID da consulta" value={row.id.slice(0, 8)} mono />
            <div>
              <dt className="text-[10px] uppercase tracking-[0.16em] text-[var(--fg-muted)]">Veículo Listado Afetado?</dt>
              <dd className="mt-0.5 font-semibold" style={{ color: recall.color }} title={row.recall_motivo ?? undefined}>
                {recall.label}
              </dd>
            </div>
          </dl>
          <div className="flex sm:flex-col gap-2 sm:items-end">
            <Link
              href={`/checktudo?placa=${encodeURIComponent(row.placa)}&product=${row.product_code}`}
              className="btn-primary text-xs whitespace-nowrap"
            >
              Ver resultado completo →
            </Link>
            <details className="text-xs">
              <summary className="cursor-pointer text-[var(--fg-muted)] uppercase tracking-[0.16em] text-[10px]">
                Ler JSON bruto
              </summary>
              <pre className="mt-2 max-h-72 max-w-md overflow-auto bg-[var(--bg)] p-3 text-[10px] leading-snug text-[var(--fg)] font-mono">
{prettyJson(row.payload)}
              </pre>
            </details>
          </div>
        </div>
      )}
    </li>
  );
}

function Cell({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-[0.16em] text-[var(--fg-muted)]">{label}</dt>
      <dd className={`text-[var(--fg-strong)] mt-0.5 break-all ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  );
}

function prettyJson(raw: string): string {
  try { return JSON.stringify(JSON.parse(raw), null, 2); } catch { return raw; }
}
