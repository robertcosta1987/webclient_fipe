"use client";

import { useState, useTransition } from "react";
import { mintInvite } from "@/app/actions/auth";

type InviteView = { code: string; used: boolean; created_at: string; used_at: string | null };

const DATE_FMT = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
});

export function ConvitesClient({ invites }: { invites: InviteView[] }) {
  const [rows, setRows] = useState<InviteView[]>(invites);
  const [latest, setLatest] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  function generate() {
    setError(null);
    setCopied(false);
    start(async () => {
      const res = await mintInvite();
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setLatest(res.code);
      setRows((r) => [{ code: res.code, used: false, created_at: new Date().toISOString(), used_at: null }, ...r]);
    });
  }

  const registerUrl = (code: string) =>
    typeof window !== "undefined" ? `${window.location.origin}/register?invite=${encodeURIComponent(code)}` : `/register?invite=${code}`;

  async function copy() {
    if (!latest) return;
    try {
      await navigator.clipboard.writeText(registerUrl(latest));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="space-y-5">
      <fieldset className="erp-group">
        <legend className="erp-legend">Gerar convite</legend>
        <p className="text-sm" style={{ color: "var(--fg-muted)", marginBottom: 10 }}>
          Cada código permite <b>um único cadastro</b>. Envie o link de convite para a pessoa criar a conta.
        </p>
        <button type="button" onClick={generate} disabled={pending} className="btn-primary text-sm">
          {pending ? "Gerando…" : "Gerar novo convite"}
        </button>

        {error && <p className="auth-error" style={{ marginTop: 12 }}>{error}</p>}

        {latest && (
          <div className="surface" style={{ marginTop: 12, padding: 12 }}>
            <div className="text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--fg-muted)" }}>
              Novo convite
            </div>
            <div className="font-mono" style={{ fontSize: 16, color: "var(--fg-strong)", marginTop: 2 }}>{latest}</div>
            <div className="font-mono" style={{ fontSize: 12, color: "var(--fg-muted)", marginTop: 6, wordBreak: "break-all" }}>
              {registerUrl(latest)}
            </div>
            <button type="button" onClick={copy} className="btn-ghost text-xs" style={{ marginTop: 8 }}>
              {copied ? "Copiado ✓" : "Copiar link"}
            </button>
          </div>
        )}
      </fieldset>

      <fieldset className="erp-group">
        <legend className="erp-legend">Convites</legend>
        {rows.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--fg-muted)" }}>Nenhum convite ainda.</p>
        ) : (
          <div className="car-table">
            <table className="w-full">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Status</th>
                  <th>Criado em</th>
                  <th>Usado em</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.code}>
                    <td className="font-mono">{r.code}</td>
                    <td>{r.used ? "Usado" : "Disponível"}</td>
                    <td className="font-mono text-xs">{fmt(r.created_at)}</td>
                    <td className="font-mono text-xs">{r.used_at ? fmt(r.used_at) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </fieldset>
    </div>
  );
}

function fmt(s: string): string {
  try { return DATE_FMT.format(new Date(s)); } catch { return s; }
}
