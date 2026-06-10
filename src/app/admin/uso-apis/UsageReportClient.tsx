"use client";

import { useState } from "react";
import type { ApiUsage } from "@/lib/db/subscriptions";

const API_LABELS: Record<string, string> = {
  checktudo: "CheckTudo",
  kbb: "Tabela KBB",
  infocar: "Infocar",
};

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const DATE_FMT = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
});
function fmtDate(s: string | null): string {
  return s ? DATE_FMT.format(new Date(s)) : "—";
}

export function UsageReportClient({ apis }: { apis: ApiUsage[] }) {
  if (apis.length === 0) {
    return (
      <div className="surface p-8 text-center text-sm text-[var(--fg-muted)]">
        Nenhum consumo faturável registrado ainda. As consultas ao vivo na API
        CheckTudo aparecerão aqui assim que forem executadas.
      </div>
    );
  }
  return (
    <ul className="space-y-3">
      {apis.map((api) => (
        <ApiCard key={api.api} api={api} />
      ))}
    </ul>
  );
}

function ApiCard({ api }: { api: ApiUsage }) {
  const [open, setOpen] = useState(true);
  return (
    <li className="surface overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className="w-full flex flex-wrap items-center gap-4 p-4 text-left hover:bg-[var(--bg-elev)]/40 transition-colors"
        aria-expanded={open}
      >
        <span className={`text-[var(--fg-muted)] text-xs transition-transform ${open ? "rotate-90" : ""}`}>▶</span>
        <div className="flex-1 min-w-[12rem]">
          <div className="font-display uppercase tracking-[0.08em] text-[var(--fg-strong)]">
            {API_LABELS[api.api] ?? api.api}
          </div>
          <div className="text-xs text-[var(--fg-muted)]">{api.subscriptions.length} assinatura(s)</div>
        </div>
        <Metric label="Ao vivo (cobr.)" value={String(api.liveQty)} />
        <Metric label="Cache (grátis)" value={String(api.cachedQty)} />
        <Metric label="A cobrar" value={BRL.format(api.revenueBrl)} accent />
      </button>

      {open && (
        <div className="border-t border-[var(--border)] p-4 space-y-2">
          {api.subscriptions.map((sub) => (
            <SubscriptionRow key={sub.subscriptionId ?? "none"} sub={sub} />
          ))}
        </div>
      )}
    </li>
  );
}

function SubscriptionRow({ sub }: { sub: ApiUsage["subscriptions"][number] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="surface overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className="w-full flex flex-wrap items-center gap-4 p-3 text-left hover:bg-[var(--bg-elev)]/40 transition-colors"
        aria-expanded={open}
      >
        <span className={`text-[var(--fg-muted)] text-[10px] transition-transform ${open ? "rotate-90" : ""}`}>▶</span>
        <div className="flex-1 min-w-[12rem]">
          <div className="text-sm text-[var(--fg-strong)] font-medium">{sub.name}</div>
          <div className="text-[11px] text-[var(--fg-muted)] font-mono">
            {sub.subKey ?? "—"}
            <span className="text-[var(--fg-faint)]"> · {sub.products.length} produto(s)</span>
          </div>
        </div>
        <Metric label="Ao vivo" value={String(sub.liveQty)} small />
        <Metric label="Cache" value={String(sub.cachedQty)} small />
        <Metric label="A cobrar" value={BRL.format(sub.revenueBrl)} accent small />
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--fg-muted)]">Último uso</p>
          <p className="text-[11px] font-mono text-[var(--fg)]">{fmtDate(sub.lastAt)}</p>
        </div>
      </button>

      {open && (
        <div className="border-t border-[var(--border)] p-3">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-[0.16em] text-[var(--fg-muted)]">
                <th className="text-left font-normal py-1">Produto</th>
                <th className="text-left font-normal py-1">Código</th>
                <th className="text-right font-normal py-1">Ao vivo</th>
                <th className="text-right font-normal py-1">Cache</th>
                <th className="text-right font-normal py-1">A cobrar</th>
              </tr>
            </thead>
            <tbody>
              {sub.products.map((p) => (
                <tr key={p.code} className="border-t border-[var(--hairline)]">
                  <td className="py-1.5 text-[var(--fg-strong)]">{p.name}</td>
                  <td className="py-1.5 font-mono text-[var(--fg-muted)]">{p.code}</td>
                  <td className="py-1.5 text-right font-mono text-[var(--fg)]">{p.liveQty}</td>
                  <td className="py-1.5 text-right font-mono text-[var(--fg-muted)]">{p.cachedQty}</td>
                  <td className="py-1.5 text-right font-mono text-[var(--fg-strong)]">{BRL.format(p.revenueBrl)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[11px] text-[var(--fg-faint)]">
            Primeira consulta: {fmtDate(sub.firstAt)} · Última: {fmtDate(sub.lastAt)} · Cache servido (não cobrado): <span className="font-mono">{sub.cachedQty}</span> consulta(s){sub.cachedValueBrl > 0 && <> · valor equivalente {BRL.format(sub.cachedValueBrl)} <span className="text-[var(--success)]">economizado</span></>}
          </p>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, accent, small }: { label: string; value: string; accent?: boolean; small?: boolean }) {
  return (
    <div className="text-right">
      <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--fg-muted)]">{label}</p>
      <p
        className={`font-mono ${small ? "text-sm" : "text-base"}`}
        style={{ color: accent ? "var(--accent)" : "var(--fg-strong)" }}
      >
        {value}
      </p>
    </div>
  );
}
