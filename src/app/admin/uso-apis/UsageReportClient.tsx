"use client";

import { useState } from "react";
import type { ApiUsage, SubscriptionUsage } from "@/lib/db/subscriptions";

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
  const label = API_LABELS[api.api] ?? api.api;
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
          <div className="font-display uppercase tracking-[0.08em] text-[var(--fg-strong)]">{label}</div>
          <div className="text-xs text-[var(--fg-muted)]">{api.subscriptions.length} assinatura(s)</div>
        </div>
        <Metric label="Ao vivo (cobr.)" value={String(api.liveQty)} />
        <Metric label="Cache (grátis)" value={String(api.cachedQty)} />
        <Metric label="A cobrar" value={BRL.format(api.revenueBrl)} accent />
      </button>

      {open && (
        <div className="border-t border-[var(--border)] p-4 space-y-2">
          {api.subscriptions.map((sub) => (
            <SubscriptionRow key={sub.subscriptionId ?? "none"} apiLabel={label} sub={sub} />
          ))}
        </div>
      )}
    </li>
  );
}

function SubscriptionRow({ apiLabel, sub }: { apiLabel: string; sub: SubscriptionUsage }) {
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
            <span className="text-[var(--fg-faint)]"> · {sub.users.length} usuário(s) · {sub.products.length} produto(s)</span>
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
        <div className="border-t border-[var(--border)] p-3 space-y-4">
          {/* Per-user breakdown — a subscription can have more than one user. */}
          <div>
            <h4 className="text-[10px] uppercase tracking-[0.16em] text-[var(--accent)] mb-1">Por usuário</h4>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-[0.16em] text-[var(--fg-muted)]">
                  <th className="text-left font-normal py-1">Usuário</th>
                  <th className="text-right font-normal py-1">Ao vivo</th>
                  <th className="text-right font-normal py-1">Cache</th>
                  <th className="text-right font-normal py-1">A cobrar</th>
                  <th className="text-right font-normal py-1">Último uso</th>
                </tr>
              </thead>
              <tbody>
                {sub.users.map((u) => (
                  <tr key={(u.userId ?? "") + u.email} className="border-t border-[var(--hairline)]">
                    <td className="py-1.5 text-[var(--fg-strong)] break-all">{u.email}</td>
                    <td className="py-1.5 text-right font-mono text-[var(--fg)]">{u.liveQty}</td>
                    <td className="py-1.5 text-right font-mono text-[var(--fg-muted)]">{u.cachedQty}</td>
                    <td className="py-1.5 text-right font-mono text-[var(--fg-strong)]">{BRL.format(u.revenueBrl)}</td>
                    <td className="py-1.5 text-right font-mono text-[var(--fg-muted)] text-xs">{fmtDate(u.lastAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Per-product breakdown (across all users of the subscription). */}
          <div>
            <h4 className="text-[10px] uppercase tracking-[0.16em] text-[var(--accent)] mb-1">Por produto</h4>
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
          </div>

          <p className="text-[11px] text-[var(--fg-faint)]">
            Primeira consulta: {fmtDate(sub.firstAt)} · Última: {fmtDate(sub.lastAt)} · Cache servido (não cobrado): <span className="font-mono">{sub.cachedQty}</span> consulta(s){sub.cachedValueBrl > 0 && <> · valor equivalente {BRL.format(sub.cachedValueBrl)} <span className="text-[var(--success)]">economizado</span></>}
          </p>

          <div>
            <button
              type="button"
              onClick={() => exportSubscriptionPdf(apiLabel, sub)}
              className="btn-primary text-xs"
            >
              Exportar PDF ↧
            </button>
          </div>
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

// Build a self-contained, print-friendly HTML document for one subscription and
// open it in a new window; the browser's print dialog ("Save as PDF") does the
// export. No extra dependencies.
function exportSubscriptionPdf(apiLabel: string, sub: SubscriptionUsage) {
  const w = window.open("", "_blank", "width=900,height=1000");
  if (!w) {
    window.alert("Não foi possível abrir a janela de exportação. Permita pop-ups e tente novamente.");
    return;
  }
  const esc = (s: string) =>
    s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
  const gen = new Date().toLocaleString("pt-BR");

  const userRows = sub.users.length
    ? sub.users.map((u) =>
        `<tr><td>${esc(u.email)}</td><td class="n">${u.liveQty}</td><td class="n">${u.cachedQty}</td><td class="n">${esc(BRL.format(u.revenueBrl))}</td><td>${esc(fmtDate(u.lastAt))}</td></tr>`).join("")
    : `<tr><td colspan="5">Sem dados</td></tr>`;
  const prodRows = sub.products.length
    ? sub.products.map((p) =>
        `<tr><td>${esc(p.name)}</td><td class="n">${p.code}</td><td class="n">${p.liveQty}</td><td class="n">${p.cachedQty}</td><td class="n">${esc(BRL.format(p.revenueBrl))}</td></tr>`).join("")
    : `<tr><td colspan="5">Sem dados</td></tr>`;

  const html =
    `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">` +
    `<title>Uso — ${esc(sub.name)} — ${esc(apiLabel)}</title><style>` +
    `*{box-sizing:border-box}body{font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0b1326;margin:32px}` +
    `h1{font-size:20px;margin:0 0 4px}.sub{color:#555;font-size:12px;margin:0 0 16px}` +
    `.cards{display:flex;gap:12px;margin:16px 0;flex-wrap:wrap}.card{border:1px solid #ddd;border-radius:8px;padding:10px 14px;min-width:130px}` +
    `.card .l{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#777}.card .v{font-size:18px;font-weight:700}` +
    `h2{font-size:13px;text-transform:uppercase;letter-spacing:.08em;color:#0891b2;margin:20px 0 6px}` +
    `table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #e2e2e2;padding:6px 8px;text-align:left}th{background:#f4f7fc}` +
    `td.n,th.n{text-align:right;font-variant-numeric:tabular-nums}.foot{margin-top:24px;color:#888;font-size:11px}` +
    `.btn{display:inline-block;margin:8px 0 16px;padding:8px 14px;border:1px solid #0891b2;color:#0891b2;border-radius:8px;cursor:pointer;background:#fff;font-size:13px}` +
    `@media print{.noprint{display:none}}</style></head><body>` +
    `<h1>Relatório de Uso — ${esc(apiLabel)}</h1>` +
    `<p class="sub">Assinatura: <strong>${esc(sub.name)}</strong>${sub.subKey ? ` · ${esc(sub.subKey)}` : ""} · gerado em ${esc(gen)}</p>` +
    `<div class="cards">` +
    `<div class="card"><div class="l">Ao vivo (cobradas)</div><div class="v">${sub.liveQty}</div></div>` +
    `<div class="card"><div class="l">Cache (não cobr.)</div><div class="v">${sub.cachedQty}</div></div>` +
    `<div class="card"><div class="l">A cobrar</div><div class="v">${esc(BRL.format(sub.revenueBrl))}</div></div>` +
    `</div>` +
    `<button class="btn noprint" onclick="window.print()">Imprimir / Salvar PDF</button>` +
    `<h2>Por usuário</h2><table><thead><tr><th>Usuário</th><th class="n">Ao vivo</th><th class="n">Cache</th><th class="n">A cobrar</th><th>Último uso</th></tr></thead><tbody>${userRows}</tbody></table>` +
    `<h2>Por produto</h2><table><thead><tr><th>Produto</th><th class="n">Código</th><th class="n">Ao vivo</th><th class="n">Cache</th><th class="n">A cobrar</th></tr></thead><tbody>${prodRows}</tbody></table>` +
    `<p class="foot">Período: ${esc(fmtDate(sub.firstAt))} — ${esc(fmtDate(sub.lastAt))}. Consultas servidas do cache não são cobradas (valor equivalente: ${esc(BRL.format(sub.cachedValueBrl))}). Placas360 · Dadocar.</p>` +
    `<script>window.onload=function(){setTimeout(function(){window.print();},250);};</script>` +
    `</body></html>`;

  w.document.open();
  w.document.write(html);
  w.document.close();
}
