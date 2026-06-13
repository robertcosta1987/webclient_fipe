"use client";

// ApiKeyForm — issue/rotate a customer's programmatic API key (FIPE /api/v1).
// The plaintext key is shown once; only its hash is stored.

import { useState, useTransition } from "react";
import { issueApiKey, type IssueApiKeyResult } from "@/app/actions/apiKeys";

export function ApiKeyForm() {
  const [email, setEmail] = useState("");
  const [price, setPrice] = useState("");
  const [result, setResult] = useState<IssueApiKeyResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setResult(null); setCopied(false);
    start(async () => {
      const r = await issueApiKey({ email, priceBrl: price.trim() === "" ? null : Number(price) });
      setResult(r);
    });
  }
  function copyKey() {
    if (result?.ok) { navigator.clipboard?.writeText(result.apiKey).then(() => setCopied(true)).catch(() => {}); }
  }

  return (
    <div className="surface p-5 space-y-4 max-w-2xl mt-10">
      <div className="flex items-center gap-2">
        <span className="block w-1 h-5 bg-[var(--accent)]" />
        <h2 className="font-display uppercase tracking-[0.08em] text-[var(--fg-strong)]">Acesso por API (FIPE)</h2>
      </div>
      <p className="text-[13px] text-[var(--fg-muted)]">
        Emite uma <strong>chave de API</strong> para um cliente já existente consultar a FIPE pela placa em
        <code className="mx-1">GET /api/v1/fipe/plate/{"{placa}"}</code>. O uso é medido e cobrado pelo mesmo plano da assinatura
        (relatório em <code>/admin/uso-apis</code>). Emitir de novo <strong>rotaciona</strong> a chave.
      </p>

      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-[1fr_auto_auto] sm:items-end">
        <div>
          <label htmlFor="apikey-email">E-mail do cliente *</label>
          <input id="apikey-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="cliente@empresa.com" className="input" required />
        </div>
        <div>
          <label htmlFor="apikey-price">Preço/consulta (R$)</label>
          <input id="apikey-price" type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="manter" className="input w-28" />
        </div>
        <button type="submit" disabled={pending} className="btn-primary text-sm">{pending ? "Emitindo…" : "Gerar chave"}</button>
      </form>

      {result?.ok === false && <p className="auth-error">{result.error}</p>}

      {result?.ok && (
        <div className="surface p-3 space-y-2" style={{ borderColor: "var(--accent)" }}>
          <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--fg-muted)]">Chave de API — copie agora, não será exibida de novo</p>
          <div className="flex items-center gap-3 flex-wrap">
            <code className="font-mono text-sm text-[var(--fg-strong)] break-all">{result.apiKey}</code>
            <button type="button" onClick={copyKey} className="btn-ghost text-xs">{copied ? "Copiado!" : "Copiar"}</button>
          </div>
          <p className="text-[11px] text-[var(--fg-muted)]">Cliente: {result.email}{!result.hasSubscription && " · ⚠ sem assinatura vinculada — uso não será limitado/cobrado por plano"}</p>
        </div>
      )}
    </div>
  );
}
