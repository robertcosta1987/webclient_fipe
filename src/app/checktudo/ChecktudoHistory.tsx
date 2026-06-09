"use client";

// ChecktudoHistory.tsx — collapsible list of past CheckTudo consultations,
// shown inline on the /checktudo page (the "saved searches"). Each row deep-links
// back into a cache-hit consult for the same placa + product. Mirrors the
// /historico-kbb list.

import { useState } from "react";
import type { ChecktudoConsultaRow } from "@/lib/db/checktudoConsultas";
import type { ChecktudoLookupResult } from "@/app/actions/checktudo";
import { Plate } from "@/components/Plate";
import { ChecktudoReport } from "./CheckTudoClient";

type OkResult = Extract<ChecktudoLookupResult, { ok: true }>;

/** Rebuild a full report shape from a stored consult row (no re-consult). */
function rowToResult(row: ChecktudoConsultaRow): OkResult {
  let data: Record<string, unknown> = {};
  try { data = JSON.parse(row.payload); } catch { data = {}; }
  return {
    ok: true,
    placa: row.placa,
    product: { code: row.product_code, name: row.product_name ?? `Produto ${row.product_code}` },
    data,
    queryId: row.query_id,
    upstreamLatencyMs: row.upstream_latency_ms,
    raw: data,
    fromCache: false,
    cachedAt: null,
    consultedAt: row.consulted_at,
    recallAfetado: row.recall_afetado,
    recallMotivo: row.recall_motivo,
    consultaId: row.id,
  };
}

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
  const [full, setFull] = useState(false);
  const modelo = [row.brand, row.model].filter(Boolean).join(" ") || "Modelo não identificado";
  const when = new Date(row.consulted_at);

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

        <div className="text-right">
          <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--fg-muted)]">Consultado em</p>
          <p className="text-xs font-mono text-[var(--fg)]">{DATE_FMT.format(when)}</p>
        </div>

        <span className={`text-[var(--fg-muted)] text-xs transition-transform ${open ? "rotate-90" : ""}`}>▶</span>
      </button>

      {open && (
        <div className="border-t border-[var(--border)] p-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 text-sm">
              <Cell label="Produto" value={`${row.product_name ?? row.product_code} (${row.product_code})`} />
              <Cell label="Chassi" value={row.chassi ?? "—"} mono />
              <Cell label="Latência upstream" value={row.upstream_latency_ms !== null ? `${row.upstream_latency_ms} ms` : "—"} mono />
              <Cell label="Query ID" value={row.query_id ?? "—"} mono />
              <Cell label="ID da consulta" value={row.id.slice(0, 8)} mono />
            </dl>
            <div className="flex sm:flex-col gap-2 sm:items-end">
              <button
                type="button"
                onClick={() => setFull((s) => !s)}
                className="btn-primary text-xs whitespace-nowrap"
                aria-expanded={full}
              >
                {full ? "Ocultar resultado" : "Ver resultado completo →"}
              </button>
            </div>
          </div>

          {full && (
            <div className="pt-2 border-t border-[var(--border)]">
              <ChecktudoReport r={rowToResult(row)} pending={false} onForceRefresh={() => {}} />
            </div>
          )}
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
