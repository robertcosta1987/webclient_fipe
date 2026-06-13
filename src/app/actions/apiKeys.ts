"use server";

// actions/apiKeys.ts — admin issues/rotates a customer's programmatic API key.
// Returns the plaintext key ONCE (only its hash is stored). Admin/master only.

import { getSession } from "@/lib/auth/server";
import { issueApiKeyForEmail } from "@/lib/api/key";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type IssueApiKeyResult =
  | { ok: true; apiKey: string; prefix: string; email: string; hasSubscription: boolean }
  | { ok: false; error: string };

export async function issueApiKey(input: { email: string; priceBrl?: number | null }): Promise<IssueApiKeyResult> {
  const session = await getSession();
  if (!session || session.role !== "admin") return { ok: false, error: "Acesso negado." };

  const email = (input.email ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return { ok: false, error: "Informe um e-mail válido." };

  let price: number | null = null;
  if (input.priceBrl !== null && input.priceBrl !== undefined && `${input.priceBrl}` !== "") {
    price = Number(input.priceBrl);
    if (!Number.isFinite(price) || price < 0) return { ok: false, error: "Preço inválido (deixe em branco para manter o atual)." };
  }

  const r = await issueApiKeyForEmail(email, { priceBrl: price });
  if (!r.ok) return r;
  return { ok: true, apiKey: r.apiKey, prefix: r.prefix, email: r.email, hasSubscription: r.subscriptionId !== null };
}
