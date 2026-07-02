"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { TenantRow } from "@/lib/db/tenants";
import {
  updateTenantAction,
  setTenantApiAccessAction,
  rotateTenantKeyAction,
  deleteTenantAction,
} from "@/app/actions/tenants";

const PLAN_LABEL: Record<string, string> = {
  consultas: "Consultas",
  cash: "Pré-pago (R$)",
  ondemand: "Sob demanda",
};

export function TenantsClient({ rows }: { rows: TenantRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState<TenantRow | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => router.refresh();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) setError(r.error ?? "Erro.");
      else refresh();
    });

  function rotate(t: TenantRow) {
    if (!t.email) {
      setError("Tenant sem usuário de login — não é possível rotacionar a chave.");
      return;
    }
    start(async () => {
      setError(null);
      const r = await rotateTenantKeyAction(t.email!);
      if (!r.ok) setError(r.error);
      else {
        setBanner(`Nova chave de API para ${t.email}: ${r.apiKey}`);
        refresh();
      }
    });
  }

  function remove(t: TenantRow) {
    if (!confirm(`Excluir o tenant "${t.name}" e seu usuário/empresa/chave? Ação irreversível.`)) return;
    run(() => deleteTenantAction(t.id));
  }

  return (
    <div className="flex flex-col gap-3">
      {banner ? (
        <div className="rounded-md border border-[var(--accent)] bg-[var(--accent)]/10 p-3 text-sm">
          <div className="mb-1 text-[var(--fg-muted)]">Guarde — exibida apenas uma vez:</div>
          <code className="block break-all">{banner}</code>
          <button className="mt-2 text-xs text-[var(--fg-muted)] underline" onClick={() => setBanner(null)}>
            Ocultar
          </button>
        </div>
      ) : null}
      {error ? <div className="rounded-md border border-red-500/40 bg-red-500/10 p-2 text-sm text-red-400">{error}</div> : null}

      <div className="overflow-x-auto rounded-lg border border-[var(--line,#2a2a2a)]">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wider text-[var(--fg-muted)]">
            <tr className="border-b border-[var(--line,#2a2a2a)]">
              <th className="px-3 py-2">Assinatura / Empresa</th>
              <th className="px-3 py-2">Login</th>
              <th className="px-3 py-2">Chave</th>
              <th className="px-3 py-2">Plano</th>
              <th className="px-3 py-2">Produtos</th>
              <th className="px-3 py-2">API</th>
              <th className="px-3 py-2 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-[var(--fg-muted)]">
                  Nenhum tenant ainda.
                </td>
              </tr>
            ) : (
              rows.map((t) => (
                <tr key={t.id} className="border-b border-[var(--line,#2a2a2a)]/60 align-top">
                  <td className="px-3 py-2">
                    <div className="font-medium text-[var(--fg-strong)]">{t.name}</div>
                    <div className="text-xs text-[var(--fg-muted)]">
                      {t.company ?? "—"}{t.cnpj ? ` · ${t.cnpj}` : ""}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-[var(--fg-muted)]">{t.email ?? "—"}</td>
                  <td className="px-3 py-2">
                    <code className="text-xs">{t.apiKeyPrefix ? `${t.apiKeyPrefix}…` : "—"}</code>
                  </td>
                  <td className="px-3 py-2 text-[var(--fg-muted)]">
                    {t.planType ? PLAN_LABEL[t.planType] ?? t.planType : "—"}
                  </td>
                  <td className="px-3 py-2 text-[var(--fg-muted)]">{t.productCodes || "—"}</td>
                  <td className="px-3 py-2">
                    <button
                      disabled={pending}
                      onClick={() => run(() => setTenantApiAccessAction(t.id, !t.apiAccess))}
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        t.apiAccess ? "bg-green-500/15 text-green-400" : "bg-neutral-500/15 text-neutral-400"
                      }`}
                    >
                      {t.apiAccess ? "Ativa" : "Inativa"}
                    </button>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-2">
                      <button className="rounded border border-[var(--line,#3a3a3a)] px-2 py-1 text-xs hover:bg-white/5" onClick={() => setEditing(t)}>
                        Editar
                      </button>
                      <button disabled={pending} className="rounded border border-[var(--line,#3a3a3a)] px-2 py-1 text-xs hover:bg-white/5" onClick={() => rotate(t)}>
                        Rotacionar chave
                      </button>
                      <button disabled={pending} className="rounded border border-red-500/40 px-2 py-1 text-xs text-red-400 hover:bg-red-500/10" onClick={() => remove(t)}>
                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {editing ? (
        <EditModal
          tenant={editing}
          pending={pending}
          onClose={() => setEditing(null)}
          onSave={(input) =>
            start(async () => {
              setError(null);
              const r = await updateTenantAction({ id: editing.id, ...input });
              if (!r.ok) setError(r.error);
              else {
                setEditing(null);
                refresh();
              }
            })
          }
        />
      ) : null}
    </div>
  );
}

function EditModal({
  tenant,
  pending,
  onClose,
  onSave,
}: {
  tenant: TenantRow;
  pending: boolean;
  onClose: () => void;
  onSave: (input: { name: string; planType: "consultas" | "cash" | "ondemand"; queryLimit: number | null; spendLimitBrl: number | null }) => void;
}) {
  const [name, setName] = useState(tenant.name);
  const [planType, setPlanType] = useState<"consultas" | "cash" | "ondemand">((tenant.planType as never) ?? "ondemand");
  const [queryLimit, setQueryLimit] = useState(tenant.queryLimit?.toString() ?? "");
  const [spend, setSpend] = useState(tenant.spendLimitBrl?.toString() ?? "");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border border-[var(--line,#2a2a2a)] bg-[var(--bg,#111)] p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-3 font-display uppercase tracking-wide text-[var(--fg-strong)]">Editar tenant</h3>
        <label className="block text-xs text-[var(--fg-muted)] mb-1">Nome da assinatura</label>
        <input className="mb-3 w-full rounded-md border border-[var(--line,#333)] bg-transparent px-3 py-2 text-sm" value={name} onChange={(e) => setName(e.target.value)} />
        <label className="block text-xs text-[var(--fg-muted)] mb-1">Plano</label>
        <select className="mb-3 w-full rounded-md border border-[var(--line,#333)] bg-transparent px-3 py-2 text-sm" value={planType} onChange={(e) => setPlanType(e.target.value as never)}>
          <option value="ondemand">Sob demanda</option>
          <option value="consultas">Consultas (limite)</option>
          <option value="cash">Pré-pago (R$)</option>
        </select>
        {planType === "consultas" ? (
          <>
            <label className="block text-xs text-[var(--fg-muted)] mb-1">Limite de consultas</label>
            <input type="number" min="0" className="mb-3 w-full rounded-md border border-[var(--line,#333)] bg-transparent px-3 py-2 text-sm" value={queryLimit} onChange={(e) => setQueryLimit(e.target.value)} />
          </>
        ) : (
          <>
            <label className="block text-xs text-[var(--fg-muted)] mb-1">Teto de uso (R$) — opcional no sob demanda</label>
            <input type="number" min="0" step="0.01" className="mb-3 w-full rounded-md border border-[var(--line,#333)] bg-transparent px-3 py-2 text-sm" value={spend} onChange={(e) => setSpend(e.target.value)} />
          </>
        )}
        <div className="mt-2 flex justify-end gap-2">
          <button className="rounded-md border border-[var(--line,#333)] px-3 py-1.5 text-sm" onClick={onClose}>
            Cancelar
          </button>
          <button
            disabled={pending}
            className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-black hover:opacity-90"
            onClick={() =>
              onSave({
                name: name.trim(),
                planType,
                queryLimit: planType === "consultas" ? (queryLimit ? Number(queryLimit) : null) : null,
                spendLimitBrl: planType !== "consultas" ? (spend ? Number(spend) : null) : null,
              })
            }
          >
            {pending ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}
