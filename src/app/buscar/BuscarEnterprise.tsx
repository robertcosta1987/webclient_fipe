"use client";

// BuscarEnterprise.tsx — classic enterprise / ASP.NET-WebForms presentation of
// the Buscar search (tabbed window + toolbar + group boxes + sidebar + purple
// notice), styled by erp.css. Controlled by BuscarClient; holds only the
// dismissible-notice UI state. Rendered only when ENTERPRISE_THEME is on.

import { useState } from "react";
import { CarrosTable } from "@/components/CarrosTable";
import type { Carro } from "@/lib/db/carros";

type Scope = { value: string; label: string };

type Props = {
  q: string;
  scope: string;
  rows: Carro[];
  pending: boolean;
  scopes: Scope[];
  onQ: (v: string) => void;
  onScope: (v: string) => void;
  onSearch: (e: React.FormEvent) => void;
  onClear: () => void;
  onRefresh: () => void;
};

const TABS = [
  { href: "/carros-ativos", label: "Carros Ativos" },
  { href: "/buscar", label: "Buscar", active: true },
  { href: "/precos", label: "Preços" },
  { href: "/historico-kbb", label: "Histórico KBB" },
  { href: "/checktudo", label: "CheckTudo" },
];

const LINKS = [
  { href: "/carros-ativos", label: "Carros Ativos" },
  { href: "/precos", label: "Preços / KBB" },
  { href: "/historico-kbb", label: "Histórico KBB" },
  { href: "/checktudo", label: "CheckTudo" },
];

export function BuscarEnterprise(p: Props) {
  const [noticeOpen, setNoticeOpen] = useState(true);
  const scopeLabel = p.scopes.find((s) => s.value === p.scope)?.label ?? "—";

  function openLink(e: React.ChangeEvent<HTMLSelectElement>) {
    const v = e.target.value;
    if (v) window.location.href = v;
  }

  return (
    <div className="erp-app">
      {/* ── Tabs ─────────────────────────────────────────────── */}
      <nav className="erp-tabs">
        {TABS.map((t) =>
          t.active ? (
            <span key={t.href} className="erp-tab erp-tab--active">{t.label}</span>
          ) : (
            <a key={t.href} href={t.href} className="erp-tab">{t.label}</a>
          ),
        )}
      </nav>

      <form onSubmit={p.onSearch} className="erp-window">
        {/* ── Toolbar ────────────────────────────────────────── */}
        <div className="erp-toolbar">
          <button type="button" className="erp-tbtn erp-tbtn--nav" disabled title="Primeiro">⏮</button>
          <button type="button" className="erp-tbtn erp-tbtn--nav" disabled title="Anterior">◀</button>
          <button type="button" className="erp-tbtn erp-tbtn--nav" disabled title="Próximo">▶</button>
          <button type="button" className="erp-tbtn erp-tbtn--nav" disabled title="Último">⏭</button>
          <span className="erp-tsep" />
          <button type="submit" className="erp-tbtn" disabled={p.pending}>
            <IconSearch /> {p.pending ? "Buscando…" : "Buscar"}
          </button>
          <button type="button" className="erp-tbtn" onClick={p.onClear}>
            <IconNew /> Limpar
          </button>
          <button type="button" className="erp-tbtn" onClick={p.onRefresh} disabled={p.pending}>
            <IconRefresh /> Atualizar
          </button>
          <span className="erp-spacer" />
          <span className="erp-help" title="Ajuda">?</span>
        </div>

        {/* ── Body ───────────────────────────────────────────── */}
        <div className="erp-body">
          <div className="erp-main">
            <fieldset className="erp-group">
              <legend className="erp-legend"><IconSearch /> Consulta de Veículos</legend>

              <div className="erp-field">
                <label className="erp-label" htmlFor="erp-termo">Termo:</label>
                <span className="erp-control">
                  <input
                    id="erp-termo"
                    className="erp-input erp-req"
                    value={p.q}
                    onChange={(e) => p.onQ(e.target.value)}
                    placeholder="ex.: SAVEIRO, BELO HORIZONTE, 2019…"
                  />
                  <span className="erp-asterisk">*</span>
                </span>
              </div>

              <div className="erp-field">
                <label className="erp-label" htmlFor="erp-campo">Campo:</label>
                <span className="erp-control">
                  <select
                    id="erp-campo"
                    className="erp-select"
                    value={p.scope}
                    onChange={(e) => p.onScope(e.target.value)}
                  >
                    {p.scopes.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </span>
              </div>
            </fieldset>

            <fieldset className="erp-group">
              <legend className="erp-legend"><IconList /> Resultados</legend>
              <CarrosTable rows={p.rows} emptyMessage="Nenhum veículo bate com a busca." />
            </fieldset>
          </div>

          {/* ── Sidebar ──────────────────────────────────────── */}
          <aside className="erp-sidebar">
            <div className="erp-box">
              <div className="erp-box-title"><IconFolder /> Complementos</div>
              <ul className="erp-links">
                {LINKS.map((l) => (
                  <li key={l.href}>
                    <a href={l.href}><IconFolderSm /> {l.label}</a>
                  </li>
                ))}
              </ul>
            </div>

            <div className="erp-box">
              <div className="erp-box-title"><IconGlobe /> Links</div>
              <div className="erp-box-pad">
                <select className="erp-select" defaultValue="" onChange={openLink} style={{ width: "100%" }}>
                  <option value="">[Abrir ...]</option>
                  {LINKS.map((l) => (
                    <option key={l.href} value={l.href}>{l.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="erp-box">
              <div className="erp-box-title"><IconDollar /> Resumo</div>
              <div className="erp-value-row"><span>Resultados:</span><span className="erp-value">{p.rows.length}</span></div>
              <div className="erp-value-row"><span>Campo:</span><span className="erp-value">{scopeLabel}</span></div>
              <div className="erp-value-row"><span>Termo:</span><span className="erp-value">{p.q || "—"}</span></div>
            </div>
          </aside>
        </div>
      </form>

      {/* ── Purple notice ────────────────────────────────────── */}
      {noticeOpen && (
        <div className="erp-notice">
          <div className="erp-notice-head">
            Dica de Busca
            <span className="erp-notice-x" onClick={() => setNoticeOpen(false)} role="button" aria-label="Fechar">X</span>
          </div>
          <div className="erp-notice-body">
            Digite um termo e escolha o campo. Use <b>“Qualquer campo”</b> para procurar em tudo. Clique em <b>Buscar</b>.
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Inline icons (small, period-appropriate) ──────────────────────────── */
function IconSearch() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
      <circle cx="6.7" cy="6.7" r="4.3" fill="none" stroke="#2a5db0" strokeWidth="1.6" />
      <line x1="9.9" y1="9.9" x2="14" y2="14" stroke="#2a5db0" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function IconNew() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
      <path d="M4 1.5h5l3 3V14a.5.5 0 0 1-.5.5H4a.5.5 0 0 1-.5-.5V2a.5.5 0 0 1 .5-.5Z" fill="#fff" stroke="#3a6cb0" strokeWidth="1.1" />
      <path d="M9 1.6V4.5h2.9" fill="none" stroke="#3a6cb0" strokeWidth="1.1" />
    </svg>
  );
}
function IconRefresh() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
      <path d="M13 8a5 5 0 1 1-1.5-3.5" fill="none" stroke="#2e8b3d" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M13 2.5V5.2h-2.7" fill="none" stroke="#2e8b3d" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconList() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
      <rect x="2" y="2.5" width="12" height="11" rx="1" fill="#fff" stroke="#2a5db0" strokeWidth="1.1" />
      <path d="M4.5 6h7M4.5 8.5h7M4.5 11h4.5" stroke="#2a5db0" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  );
}
function IconFolder() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden>
      <path d="M1.6 4.2c0-.5.4-.9.9-.9h3l1.2 1.3h6.8c.5 0 .9.4.9.9V12c0 .5-.4.9-.9.9H2.5c-.5 0-.9-.4-.9-.9V4.2Z" fill="#f4c84b" stroke="#cf9e1f" strokeWidth="0.9" />
    </svg>
  );
}
function IconFolderSm() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" aria-hidden>
      <path d="M1.6 4.2c0-.5.4-.9.9-.9h3l1.2 1.3h6.8c.5 0 .9.4.9.9V12c0 .5-.4.9-.9.9H2.5c-.5 0-.9-.4-.9-.9V4.2Z" fill="#ffe08a" stroke="#cf9e1f" strokeWidth="0.9" />
    </svg>
  );
}
function IconGlobe() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden>
      <circle cx="8" cy="8" r="6.2" fill="#cfe6ff" stroke="#2a5db0" strokeWidth="1.1" />
      <path d="M2 8h12M8 2c2 2 2 10 0 12M8 2C6 4 6 12 8 14" fill="none" stroke="#2a5db0" strokeWidth="1" />
    </svg>
  );
}
function IconDollar() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
      <circle cx="8" cy="8" r="6.4" fill="#e7f6e7" stroke="#2e8b3d" strokeWidth="1.1" />
      <path d="M8 3.6v8.8M9.8 5.6c-.4-.7-1.1-1-1.9-1-1 0-1.8.5-1.8 1.4 0 2 3.8 1 3.8 3 0 .9-.8 1.5-1.9 1.5-.9 0-1.6-.4-2-1.1" fill="none" stroke="#2e8b3d" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  );
}
