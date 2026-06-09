"use client";

// HistoricoInfocarList.tsx — collapsible list of past Infocar consultations.
//
// Each row is a clickable card showing placa + modelo + consulted_at.
// Expanding reveals a quick summary (FIPE code/value) and a deep link to
// /infocar?placa=X which cache-hits and renders the full result.

import { useState } from "react";
import Link from "next/link";
import type { InfocarConsultaRow } from "@/lib/db/infocarConsultas";
import { Plate } from "@/components/Plate";

const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

const DATE_FMT = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function HistoricoInfocarList({ rows }: { rows: InfocarConsultaRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="surface p-8 text-center text-sm text-[var(--fg-muted)]">
        Sem consultas registradas. Consulte uma placa acima para começar.
      </div>
    );
  }
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <ConsultaCard key={r.id} row={r} />
      ))}
    </ul>
  );
}

function ConsultaCard({ row }: { row: InfocarConsultaRow }) {
  const [open, setOpen] = useState(false);
  const modelo = row.modelo || "Modelo não identificado";
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
            {row.ano_modelo && <span className="text-[var(--fg-muted)] font-normal"> · {row.ano_modelo}</span>}
          </p>
          {row.codigo_fipe && (
            <p className="text-xs text-[var(--fg-muted)] truncate max-w-[42rem] font-mono">FIPE {row.codigo_fipe}</p>
          )}
        </div>

        <div className="text-right">
          <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--fg-muted)]">Consultado em</p>
          <p className="text-xs font-mono text-[var(--fg)]">{DATE_FMT.format(when)}</p>
        </div>

        <span className={`text-[var(--fg-muted)] text-xs transition-transform ${open ? "rotate-90" : ""}`}>▶</span>
      </button>

      {open && (
        <div className="border-t border-[var(--border)] p-4 grid gap-4 sm:grid-cols-[1fr_auto]">
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 text-sm">
            <Cell label="Valor FIPE" value={row.valor_fipe !== null ? BRL.format(row.valor_fipe) : "—"} mono />
            <Cell label="Código FIPE" value={row.codigo_fipe ?? "—"} mono />
            <Cell label="Fonte" value={row.source_id} />
            <Cell label="Latência upstream" value={row.upstream_latency_ms !== null ? `${row.upstream_latency_ms} ms` : "—"} mono />
            <Cell label="ID da consulta" value={row.id.slice(0, 8)} mono />
          </dl>
          <div className="flex sm:flex-col gap-2 sm:items-end">
            <Link href={`/infocar?placa=${encodeURIComponent(row.placa)}`} className="btn-primary text-xs whitespace-nowrap">
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
      <dd className={`text-[var(--fg-strong)] mt-0.5 ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  );
}

function prettyJson(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}
