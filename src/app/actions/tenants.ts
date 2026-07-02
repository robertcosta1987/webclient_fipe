"use server";

// actions/tenants.ts — admin CRUD over tenants (subscriptions) for /admin/tenants.
// Admin/master only. Edit plan/name, toggle programmatic access, rotate the API key, delete.

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/server";
import * as tenants from "@/lib/db/tenants";
import { setApiAccess } from "@/lib/db/subscriptions";
import { issueApiKeyForEmail } from "@/lib/api/key";
import type { PlanType } from "@/lib/db/subscriptions";

async function requireAdmin(): Promise<boolean> {
  const s = await getSession();
  return Boolean(s && s.role === "admin");
}

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function updateTenantAction(input: {
  id: string;
  name?: string;
  planType?: PlanType;
  queryLimit?: number | null;
  spendLimitBrl?: number | null;
}): Promise<ActionResult> {
  if (!(await requireAdmin())) return { ok: false, error: "Acesso negado." };
  if (!input.id) return { ok: false, error: "id ausente." };
  const name = input.name?.trim();
  if (name !== undefined && !name) return { ok: false, error: "Informe o nome." };
  await tenants.updateTenant(input.id, {
    name,
    planType: input.planType,
    queryLimit: input.queryLimit ?? null,
    spendLimitBrl: input.spendLimitBrl ?? null,
  });
  revalidatePath("/admin/tenants");
  return { ok: true };
}

export async function setTenantApiAccessAction(id: string, enabled: boolean): Promise<ActionResult> {
  if (!(await requireAdmin())) return { ok: false, error: "Acesso negado." };
  if (!id) return { ok: false, error: "id ausente." };
  await setApiAccess(id, enabled);
  revalidatePath("/admin/tenants");
  return { ok: true };
}

export type RotateResult = { ok: true; apiKey: string } | { ok: false; error: string };

export async function rotateTenantKeyAction(email: string): Promise<RotateResult> {
  if (!(await requireAdmin())) return { ok: false, error: "Acesso negado." };
  const e = (email ?? "").trim().toLowerCase();
  if (!e) return { ok: false, error: "E-mail do usuário ausente." };
  const r = await issueApiKeyForEmail(e);
  if (!r.ok) return { ok: false, error: r.error };
  revalidatePath("/admin/tenants");
  return { ok: true, apiKey: r.apiKey };
}

export async function deleteTenantAction(id: string): Promise<ActionResult> {
  if (!(await requireAdmin())) return { ok: false, error: "Acesso negado." };
  if (!id) return { ok: false, error: "id ausente." };
  await tenants.deleteTenant(id);
  revalidatePath("/admin/tenants");
  return { ok: true };
}
