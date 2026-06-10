"use client";

import { useState, useTransition } from "react";
import { createSubscription, type CreateSubResult } from "@/app/actions/provisioning";
import { CHECKTUDO_PRODUCTS } from "@/lib/checktudo/types";

type PlanType = "consultas" | "cash";
type Sel = { checked: boolean; qty: string };

export function AssinaturaForm() {
  const [nome, setNome] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [email, setEmail] = useState("");
  const [planType, setPlanType] = useState<PlanType>("consultas");
  const [cashValue, setCashValue] = useState("");
  const [sel, setSel] = useState<Record<number, Sel>>(
    () => Object.fromEntries(CHECKTUDO_PRODUCTS.map((p) => [p.code, { checked: false, qty: "" }])),
  );
  const [result, setResult] = useState<CreateSubResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  function toggle(code: number) {
    setSel((s) => ({ ...s, [code]: { ...s[code], checked: !s[code].checked } }));
  }
  function setQty(code: number, qty: string) {
    setSel((s) => ({ ...s, [code]: { ...s[code], qty } }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setCopied(false);
    const products = CHECKTUDO_PRODUCTS.filter((p) => sel[p.code].checked).map((p) => ({
      code: p.code,
      qty: planType === "consultas" ? Number(sel[p.code].qty || 0) : null,
    }));
    start(async () => {
      const res = await createSubscription({
        nome,
        empresa,
        email,
        planType,
        cashValueBrl: planType === "cash" ? Number(cashValue || 0) : null,
        products,
      });
      setResult(res);
    });
  }

  function reset() {
    setNome(""); setEmpresa(""); setEmail(""); setPlanType("consultas"); setCashValue("");
    setSel(Object.fromEntries(CHECKTUDO_PRODUCTS.map((p) => [p.code, { checked: false, qty: "" }])));
    setResult(null); setCopied(false);
  }

  async function copyPw() {
    if (!result?.ok) return;
    try { await navigator.clipboard.writeText(result.tempPassword); setCopied(true); } catch { setCopied(false); }
  }

  // Success view — show the one-time temp password.
  if (result?.ok) {
    return (
      <div className="surface p-5 space-y-4 max-w-xl">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs" style={{ background: "color-mix(in srgb, var(--success) 18%, transparent)", color: "var(--success)" }}>✓</span>
          <h2 className="font-display uppercase tracking-[0.08em] text-[var(--fg-strong)]">Assinatura criada</h2>
        </div>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <Field label="Empresa / Assinatura" value={result.subscriptionName} />
          <Field label="Subscription ID" value={result.subKey} mono />
          <Field label="E-mail (login)" value={result.email} mono />
          <Field label="Plano" value={result.planSummary} />
        </dl>
        <div className="surface p-3" style={{ borderColor: "var(--accent)" }}>
          <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--fg-muted)] mb-1">Senha temporária (entregue ao cliente)</p>
          <div className="flex items-center gap-3">
            <code className="font-mono text-lg text-[var(--fg-strong)] tracking-wide">{result.tempPassword}</code>
            <button type="button" onClick={copyPw} className="btn-ghost text-xs">{copied ? "Copiado!" : "Copiar"}</button>
          </div>
          <p className="text-[11px] text-[var(--fg-muted)] mt-2">
            O usuário <strong>deverá trocar a senha no primeiro acesso</strong>. Esta senha não será exibida novamente.
          </p>
        </div>
        <button type="button" onClick={reset} className="btn-primary text-sm">+ Nova assinatura</button>
      </div>
    );
  }

  const anyChecked = CHECKTUDO_PRODUCTS.some((p) => sel[p.code].checked);

  return (
    <form onSubmit={submit} className="space-y-5 max-w-2xl">
      {result?.ok === false && <p className="auth-error">{result.error}</p>}

      <fieldset className="erp-group">
        <legend className="erp-legend">Dados do cliente</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Nome *" value={nome} onChange={setNome} placeholder="Nome do contato" />
          <Input label="Empresa *" value={empresa} onChange={setEmpresa} placeholder="Razão social / nome fantasia" />
          <Input label="E-mail (login) *" value={email} onChange={setEmail} type="email" placeholder="cliente@empresa.com.br" />
        </div>
      </fieldset>

      <fieldset className="erp-group">
        <legend className="erp-legend">Plano de consumo</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="auth-field">
            <label htmlFor="tipo">Tipo de consumo *</label>
            <select id="tipo" value={planType} onChange={(e) => setPlanType(e.target.value as PlanType)} className="input">
              <option value="consultas">Quantidade de consultas</option>
              <option value="cash">Valor em reais (R$)</option>
            </select>
          </div>
          {planType === "cash" && (
            <Input label="Valor (R$) *" value={cashValue} onChange={setCashValue} type="number" placeholder="500.00" />
          )}
        </div>
        <p className="text-[12px] text-[var(--fg-muted)] mt-2">
          {planType === "consultas"
            ? "O cliente recebe um número de consultas por produto. Consultas em cache não descontam."
            : "O cliente pode usar os produtos marcados até atingir o valor. Consultas em cache não descontam."}
        </p>
      </fieldset>

      <fieldset className="erp-group">
        <legend className="erp-legend">Produtos {planType === "consultas" ? "e quantidades" : "liberados"}</legend>
        <div className="grid gap-2">
          {CHECKTUDO_PRODUCTS.map((p) => (
            <div key={p.code} className="flex items-center gap-3 flex-wrap">
              <label className="flex items-center gap-2 text-sm text-[var(--fg)] min-w-[18rem]">
                <input type="checkbox" checked={sel[p.code].checked} onChange={() => toggle(p.code)} />
                <span className="text-[var(--fg-strong)]">{p.name}</span>
                <span className="text-[var(--fg-faint)] font-mono text-xs">({p.code})</span>
              </label>
              {planType === "consultas" && sel[p.code].checked && (
                <label className="flex items-center gap-2 text-xs text-[var(--fg-muted)]">
                  Qtd.
                  <input
                    type="number" min={1} value={sel[p.code].qty}
                    onChange={(e) => setQty(p.code, e.target.value)}
                    className="input" style={{ width: 96 }} placeholder="20"
                  />
                </label>
              )}
            </div>
          ))}
        </div>
        {!anyChecked && <p className="text-[12px] text-[var(--fg-muted)] mt-2">Marque ao menos um produto.</p>}
      </fieldset>

      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? "Criando…" : "Criar assinatura"}
      </button>
    </form>
  );
}

function Input({ label, value, onChange, type = "text", placeholder }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
}) {
  return (
    <div className="auth-field">
      <label>{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} type={type} placeholder={placeholder} className="input" />
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-[0.16em] text-[var(--fg-muted)]">{label}</dt>
      <dd className={`text-[var(--fg-strong)] mt-0.5 break-words ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  );
}
