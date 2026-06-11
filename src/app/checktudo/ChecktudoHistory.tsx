"use client";

// ChecktudoHistory.tsx — collapsible list of past CheckTudo consultations,
// shown inline on the /checktudo page (the "saved searches"). Each row deep-links
// back into a cache-hit consult for the same placa + product. Mirrors the
// /historico-kbb list.

import { useState } from "react";
import type { ChecktudoConsultaRow } from "@/lib/db/checktudoConsultas";
import type { ChecktudoLookupResult } from "@/app/actions/checktudo";
import { Plate } from "@/components/Plate";
import { ChecktudoReport, parecerLabel, HoverInfo } from "./CheckTudoClient";

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
    parecerVeredito: row.parecer_veredito,
    parecerMotivo: row.parecer_motivo,
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
  const parecer = parecerLabel(row.parecer_veredito);

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

        {row.recall_afetado === "sim" && (
          <HoverInfo content={row.recall_motivo?.trim() || "Chassi dentro de uma faixa de recall afetada."} focusable={false}>
            <span
              className="cursor-help inline-block text-[11px] uppercase tracking-[0.08em] font-bold px-2.5 py-1 rounded whitespace-nowrap"
              style={{ color: "#fff", background: "var(--danger)" }}
            >
              RECALL
            </span>
          </HoverInfo>
        )}

        {row.parecer_veredito && (
          row.parecer_motivo?.trim() ? (
            <HoverInfo content={row.parecer_motivo} focusable={false}>
              <span
                className="cursor-help inline-block text-[11px] uppercase tracking-[0.08em] font-bold px-2.5 py-1 rounded whitespace-nowrap"
                style={{ color: parecer.color, background: parecer.bg, border: `1px solid ${parecer.color}` }}
              >
                {parecer.label}
              </span>
            </HoverInfo>
          ) : (
            <span
              className="text-[11px] uppercase tracking-[0.08em] font-bold px-2.5 py-1 rounded whitespace-nowrap"
              style={{ color: parecer.color, background: parecer.bg, border: `1px solid ${parecer.color}` }}
            >
              {parecer.label}
            </span>
          )
        )}

        <div className="text-right">
          <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--fg-muted)]">Consultado em</p>
          <p className="text-xs font-mono text-[var(--fg)]">{DATE_FMT.format(when)}</p>
        </div>

        <span className={`text-[var(--fg-muted)] text-xs transition-transform ${open ? "rotate-90" : ""}`}>▶</span>
      </button>

      {open && (
        <div className="border-t border-[var(--border)] p-4 space-y-4">
          {/* Full RECALL + buy-recommendation descriptions, shown inline once
              expanded — no hover needed here. */}
          {(row.recall_afetado === "sim" || row.parecer_veredito) && (
            <div className="space-y-3">
              {row.recall_afetado === "sim" && (
                <div className="surface p-3" style={{ borderColor: "var(--danger)" }}>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] uppercase tracking-[0.08em] font-bold px-2.5 py-1 rounded" style={{ color: "#fff", background: "var(--danger)" }}>RECALL</span>
                    <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--fg-muted)]">Chassi afetado</span>
                  </div>
                  <p className="text-sm text-[var(--fg)] mt-2">{row.recall_motivo?.trim() || "Chassi dentro de uma faixa de recall afetada."}</p>
                </div>
              )}
              {row.parecer_veredito && (
                <div className="surface p-3" style={{ background: parecer.bg, borderColor: parecer.color }}>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] uppercase tracking-[0.08em] font-bold px-2.5 py-1 rounded" style={{ color: parecer.color, background: parecer.bg, border: `1px solid ${parecer.color}` }}>{parecer.label}</span>
                    <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--fg-muted)]">Parecer de Compra</span>
                  </div>
                  {row.parecer_motivo?.trim() && <p className="text-sm text-[var(--fg)] mt-2">{row.parecer_motivo}</p>}
                </div>
              )}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 text-sm">
              <Cell label="Produto" value={`${row.product_name ?? row.product_code} (${row.product_code})`} />
              <Cell label="Chassi" value={row.chassi ?? "—"} mono />
              <Cell label="Latência upstream" value={row.upstream_latency_ms !== null ? `${row.upstream_latency_ms} ms` : "—"} mono />
              <Cell label="Query ID" value={row.query_id ?? "—"} mono />
              <Cell label="ID da consulta" value={row.id.slice(0, 8)} mono />
            </dl>
            <div className="flex flex-wrap gap-2 sm:justify-end sm:items-start">
              <a href={`/laudo/${row.id}`} className="btn-primary text-xs whitespace-nowrap">
                Ver laudo inteligente →
              </a>
              <button
                type="button"
                onClick={() => setFull((s) => !s)}
                className="btn-ghost text-xs whitespace-nowrap"
                aria-expanded={full}
              >
                {full ? "Ocultar resultado" : "Ver resultado completo →"}
              </button>
            </div>
          </div>

          {full && (
            <div className="pt-2 border-t border-[var(--border)]">
              <ChecktudoReport r={rowToResult(row)} embedded pending={false} onForceRefresh={() => {}} />
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
