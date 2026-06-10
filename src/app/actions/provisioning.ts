"use server";

// actions/provisioning.ts — admin "Adicionar Assinatura": create a customer +
// subscription + login user in one step. Returns a one-time temporary password
// for the admin to hand to the customer; the user is forced to change it on
// first login.

import { randomBytes } from "node:crypto";
import { hashPassword } from "@/lib/auth/password";
import { getSession } from "@/lib/auth/server";
import * as users from "@/lib/db/users";
import * as subs from "@/lib/db/subscriptions";
import * as customers from "@/lib/db/customers";
import { isValidProduct, productName } from "@/lib/checktudo/types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type CreateSubInput = {
  nome: string;
  empresa: string;
  email: string;
  planType: "consultas" | "cash";
  cashValueBrl?: number | null;
  products: { code: number; qty?: number | null }[];
};

export type CreateSubResult =
  | { ok: true; email: string; tempPassword: string; subscriptionName: string; subKey: string; planSummary: string }
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
  if (!EMAIL_RE.test(email)) return { ok: false, error: "Informe um e-mail válido." };
  if (input.planType !== "consultas" && input.planType !== "cash") return { ok: false, error: "Selecione o tipo de consumo." };

  const products = (input.products ?? []).filter((p) => isValidProduct(p.code));
  if (products.length === 0) return { ok: false, error: "Selecione ao menos um produto." };

  if (input.planType === "consultas") {
    for (const p of products) {
      const q = Number(p.qty);
      if (!Number.isInteger(q) || q < 1) return { ok: false, error: `Informe a quantidade de consultas para ${productName(p.code)}.` };
    }
  }
  let spendLimit: number | null = null;
  if (input.planType === "cash") {
    spendLimit = Number(input.cashValueBrl);
    if (!Number.isFinite(spendLimit) || spendLimit <= 0) return { ok: false, error: "Informe um valor em reais maior que zero." };
  }

  if (await users.getUserByEmail(email)) return { ok: false, error: "Já existe uma conta com este e-mail." };

  const subKey = `SUB-${slug(empresa)}-${randomBytes(2).toString("hex").toUpperCase()}`;
  const pw = tempPassword();

  let subscriptionId: string;
  try {
    const sub = await subs.createSubscription({ name: empresa, subKey, planType: input.planType, spendLimitBrl: spendLimit });
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

  // CRM registry + product entitlements (best-effort after the user exists).
  try {
    await customers.createCustomer({ name: nome, company: empresa, email, subscriptionId, userId });
  } catch { /* CRM row is non-critical; continue */ }

  for (const p of products) {
    const granted = input.planType === "consultas" ? Number(p.qty) : null;
    try {
      await subs.addQuota({ subscriptionId, api: "checktudo", productCode: p.code, granted });
    } catch { /* keep going; admin can re-run if a product fails */ }
  }

  const planSummary =
    input.planType === "consultas"
      ? `Consultas: ${products.map((p) => `${productName(p.code)} ×${Number(p.qty)}`).join(", ")}`
      : `Valor: ${BRL.format(spendLimit!)} · Produtos: ${products.map((p) => productName(p.code)).join(", ")}`;

  return { ok: true, email, tempPassword: pw, subscriptionName: empresa, subKey, planSummary };
}
