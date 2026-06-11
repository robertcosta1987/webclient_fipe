"use server";

// actions/provisioning.ts — admin "Adicionar Assinatura": create a customer +
// subscription + login user in one step, plus a matching APIM subscription.
// Returns a one-time temporary password for the admin to hand to the customer;
// the user is forced to change it on first login.

import { randomBytes } from "node:crypto";
import { hashPassword } from "@/lib/auth/password";
import { getSession } from "@/lib/auth/server";
import * as users from "@/lib/db/users";
import * as subs from "@/lib/db/subscriptions";
import * as customers from "@/lib/db/customers";
import { createApimSubscription } from "@/lib/apim";
import { isValidProduct, productName } from "@/lib/checktudo/types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type PlanType = "consultas" | "cash" | "ondemand";

export type CreateSubInput = {
  nome: string;
  empresa: string;
  cnpj: string;
  email: string;
  planType: PlanType;
  queryLimit?: number | null;    // consultas — total query hard cap
  cashValueBrl?: number | null;  // cash — mandatory budget; ondemand — OPTIONAL cap
  products: number[];            // contracted product codes
};

export type CreateSubResult =
  | {
      ok: true;
      email: string;
      tempPassword: string;
      subscriptionName: string;
      subKey: string;
      planSummary: string;
      apim: { created: boolean; reason?: string };
    }
  | { ok: false; error: string };

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

// Readable temp password — no ambiguous chars (0/O, 1/l/I).
const PW_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
function tempPassword(len = 12): string {
  const b = randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += PW_ALPHABET[b[i] % PW_ALPHABET.length];
  return out;
}

// CNPJ validation (14 digits + two check digits). Returns the normalized
// 14-digit string, or null if invalid.
function normalizeCnpj(raw: string): string | null {
  const d = (raw ?? "").replace(/\D/g, "");
  if (d.length !== 14) return null;
  if (/^(\d)\1{13}$/.test(d)) return null; // reject 00000000000000 etc.
  const check = (len: number): number => {
    let sum = 0, pos = len - 7;
    for (let i = len; i >= 1; i--) {
      sum += Number(d[len - i]) * pos--;
      if (pos < 2) pos = 9;
    }
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  if (check(12) !== Number(d[12])) return null;
  if (check(13) !== Number(d[13])) return null;
  return d;
}

function slug(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 12) || "CLIENTE";
}

export async function createSubscription(input: CreateSubInput): Promise<CreateSubResult> {
  const session = await getSession();
  if (!session || session.role !== "admin") return { ok: false, error: "Acesso negado." };

  const nome = (input.nome ?? "").trim();
  const empresa = (input.empresa ?? "").trim();
  const email = (input.email ?? "").trim().toLowerCase();
  if (!nome) return { ok: false, error: "Informe o nome." };
  if (!empresa) return { ok: false, error: "Informe a empresa." };
  const cnpj = normalizeCnpj(input.cnpj ?? "");
  if (!cnpj) return { ok: false, error: "Informe um CNPJ válido (14 dígitos)." };
  if (!EMAIL_RE.test(email)) return { ok: false, error: "Informe um e-mail válido." };

  const planType = input.planType;
  if (planType !== "consultas" && planType !== "cash" && planType !== "ondemand") {
    return { ok: false, error: "Selecione o tipo de consumo." };
  }

  const products = (input.products ?? []).filter((c) => isValidProduct(c));
  if (products.length === 0) return { ok: false, error: "Selecione ao menos um produto." };

  // Per-plan value validation.
  let queryLimit: number | null = null;
  let spendLimit: number | null = null;
  if (planType === "consultas") {
    queryLimit = Number(input.queryLimit);
    if (!Number.isInteger(queryLimit) || queryLimit < 1) return { ok: false, error: "Informe a quantidade de consultas (limite) — número inteiro maior que zero." };
  } else if (planType === "cash") {
    spendLimit = Number(input.cashValueBrl);
    if (!Number.isFinite(spendLimit) || spendLimit <= 0) return { ok: false, error: "Informe um valor em reais maior que zero." };
  } else {
    // ondemand — cap is OPTIONAL.
    if (input.cashValueBrl === null || input.cashValueBrl === undefined || `${input.cashValueBrl}` === "") {
      spendLimit = null;
    } else {
      spendLimit = Number(input.cashValueBrl);
      if (!Number.isFinite(spendLimit) || spendLimit <= 0) return { ok: false, error: "O teto de uso (opcional) deve ser um valor em reais maior que zero, ou deixe em branco." };
    }
  }

  if (await users.getUserByEmail(email)) return { ok: false, error: "Já existe uma conta com este e-mail." };

  const subKey = `SUB-${slug(empresa)}-${randomBytes(2).toString("hex").toUpperCase()}`;
  const pw = tempPassword();

  let subscriptionId: string;
  try {
    const sub = await subs.createSubscription({ name: empresa, subKey, planType, queryLimit, spendLimitBrl: spendLimit });
    subscriptionId = sub.id;
  } catch {
    return { ok: false, error: "Não foi possível criar a assinatura. Tente novamente." };
  }

  let userId: string;
  try {
    const { hash, salt } = await hashPassword(pw);
    const created = await users.createUser({
      email,
      name: nome,
      passwordHash: hash,
      passwordSalt: salt,
      role: "user",
      subscriptionId,
      mustChangePassword: true,
    });
    userId = created.id;
  } catch (e) {
    const msg = (e as Error)?.message ?? "";
    if (/unique|duplicate/i.test(msg)) return { ok: false, error: "Já existe uma conta com este e-mail." };
    return { ok: false, error: "Não foi possível criar o usuário. Tente novamente." };
  }

  // CRM registry + contracted products (best-effort after the user exists).
  try {
    await customers.createCustomer({ name: nome, company: empresa, cnpj, email, subscriptionId, userId });
  } catch { /* CRM row is non-critical; continue */ }

  for (const code of products) {
    try {
      await subs.addQuota({ subscriptionId, api: "checktudo", productCode: code, granted: null });
    } catch { /* keep going */ }
  }

  // Create the matching APIM subscription (best-effort; gated on Azure creds).
  let apim = { created: false, reason: "Não configurado." } as { created: boolean; reason?: string };
  try {
    apim = await createApimSubscription({ id: subKey, displayName: empresa });
  } catch (e) {
    apim = { created: false, reason: `Falha: ${(e as Error).message}` };
  }

  const productList = products.map((c) => productName(c)).join(", ");
  const planSummary =
    planType === "consultas"
      ? `Quantidade de consultas: ${queryLimit} (limite total) · Produtos: ${productList}`
      : planType === "cash"
        ? `Valor em reais: ${BRL.format(spendLimit!)} · Produtos: ${productList}`
        : `On-Demand / Em aberto${spendLimit !== null ? ` · teto ${BRL.format(spendLimit)}` : " · sem teto"} · Produtos: ${productList}`;

  return { ok: true, email, tempPassword: pw, subscriptionName: empresa, subKey, planSummary, apim };
}
