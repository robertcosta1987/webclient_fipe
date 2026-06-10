"use client";

import { useState, useTransition } from "react";
import { createSubscription, type CreateSubResult } from "@/app/actions/provisioning";
import { CHECKTUDO_PRODUCTS } from "@/lib/checktudo/types";

type PlanType = "consultas" | "cash" | "ondemand";

export function AssinaturaForm() {
  const [nome, setNome] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [email, setEmail] = useState("");
  const [planType, setPlanType] = useState<PlanType>("consultas");
  const [value, setValue] = useState(""); // queries (consultas) | R$ (cash/ondemand)
  const [selected, setSelected] = useState<Record<number, boolean>>(
    () => Object.fromEntries(CHECKTUDO_PRODUCTS.map((p) => [p.code, false])),
  );
  const [result, setResult] = useState<CreateSubResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  function toggle(code: number) {
    setSelected((s) => ({ ...s, [code]: !s[code] }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setCopied(false);
    const products = CHECKTUDO_PRODUCTS.filter((p) => selected[p.code]).map((p) => p.code);
    start(async () => {
      const res = await createSubscription({
        nome,
        empresa,
        email,
        planType,
        queryLimit: planType === "consultas" ? Number(value || 0) : null,
        cashValueBrl: planType === "consultas" ? null : value === "" ? null : Number(value),
        products,
      });
      setResult(res);
    });
  }

  function reset() {
    setNome(""); setEmpresa(""); setEmail(""); setPlanType("consultas"); setValue("");
    setSelected(Object.fromEntries(CHECKTUDO_PRODUCTS.map((p) => [p.code, false])));
    setResult(null); setCopied(false);
  }

  async function copyPw() {
    if (!result?.ok) return;
    try { await navigator.clipboard.writeText(result.tempPassword); setCopied(true); } catch { setCopied(false); }
  }

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

        <p className="text-[12px]" style={{ color: result.apim.created ? "var(--success)" : "var(--fg-muted)" }}>
          {result.apim.created
            ? "APIM: assinatura criada no API Management ✓"
            : `APIM: não criada — ${result.apim.reason ?? "indisponível"} (assinatura criada no app).`}
        </p>

        <button type="button" onClick={reset} className="btn-primary text-sm">+ Nova assinatura</button>
      </div>
    );
  }

  const anyChecked = CHECKTUDO_PRODUCTS.some((p) => selected[p.code]);

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
            <select id="tipo" value={planType} onChange={(e) => { setPlanType(e.target.value as PlanType); setValue(""); }} className="input">
              <option value="consultas">Quantidade de Consultas</option>
              <option value="cash">Valor em Reais</option>
              <option value="ondemand">On-Demand / Em aberto</option>
            </select>
          </div>

          {planType === "consultas" && (
            <Input label="Quantidade de consultas (limite total) *" value={value} onChange={setValue} type="number" placeholder="20" />
          )}
          {planType === "cash" && (
            <Input label="Valor (R$) *" value={value} onChange={setValue} type="number" placeholder="500.00" />
          )}
          {planType === "ondemand" && (
            <Input label="Teto de uso (R$) — opcional" value={value} onChange={setValue} type="number" placeholder="(opcional) ex.: 1000.00" />
          )}
        </div>
        <p className="text-[12px] text-[var(--fg-muted)] mt-2">
          {planType === "consultas" && "Limite rígido: o total de consultas ao vivo não pode passar deste número. Consultas em cache não descontam."}
          {planType === "cash" && "Crédito pré-pago: as consultas ao vivo descontam até atingir o valor. Consultas em cache não descontam."}
          {planType === "ondemand" && "Em aberto, faturado no fim do ciclo. O teto em R$ é opcional — se preenchido, bloqueia ao ser atingido para evitar gasto excessivo. Consultas em cache não descontam."}
        </p>
      </fieldset>

      <fieldset className="erp-group">
        <legend className="erp-legend">Produtos contratados</legend>
        <div className="grid gap-2">
          {CHECKTUDO_PRODUCTS.map((p) => (
            <label key={p.code} className="flex items-center gap-2 text-sm text-[var(--fg)]">
              <input type="checkbox" checked={selected[p.code]} onChange={() => toggle(p.code)} />
              <span className="text-[var(--fg-strong)]">{p.name}</span>
              <span className="text-[var(--fg-faint)] font-mono text-xs">({p.code})</span>
            </label>
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
