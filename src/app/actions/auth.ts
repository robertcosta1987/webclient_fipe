"use server";

// actions/auth.ts — register (invite-gated), login, logout, and admin invite
// minting. Registration is closed: a valid single-use invite code is required.
// The first user ever created becomes 'admin'.

import { randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession, getSession } from "@/lib/auth/server";
import * as users from "@/lib/db/users";
import { recordConsent } from "@/lib/db/consents";
import { CONSENT_PRIVACY_POLICY, PRIVACY_POLICY_VERSION } from "@/lib/lgpd/policy";

export type AuthResult = { error: string } | undefined;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PW = 8;

export async function register(formData: FormData): Promise<AuthResult> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const invite = String(formData.get("invite") ?? "").trim();
  // Explicit, unbundled consent (no pre-ticked box) — Art. 8º. The checkbox must
  // be checked to proceed; we record the version accepted below.
  const consent = formData.get("consent");

  if (!EMAIL_RE.test(email)) return { error: "Informe um e-mail válido." };
  if (password.length < MIN_PW) return { error: `A senha precisa ter pelo menos ${MIN_PW} caracteres.` };
  if (!invite) return { error: "Informe o código de convite." };
  if (consent !== "on") return { error: "É necessário aceitar a Política de Privacidade para continuar." };

  try {
    if (!(await users.isInviteValid(invite))) {
      return { error: "Código de convite inválido, expirado ou já utilizado." };
    }
    if (await users.getUserByEmail(email)) {
      return { error: "Já existe uma conta com este e-mail." };
    }

    const { hash, salt } = await hashPassword(password);
    const role = (await users.countUsers()) === 0 ? "admin" : "user";
    const { id } = await users.createUser({
      email,
      name: name || null,
      passwordHash: hash,
      passwordSalt: salt,
      role,
    });

    // Atomically consume the invite; if it lost a race, roll the user back.
    if (!(await users.claimInvite(invite, id))) {
      await users.deleteUser(id);
      return { error: "Código de convite inválido, expirado ou já utilizado." };
    }

    // Record consent (Art. 8º §6: prove which policy version was accepted).
    // Best-effort: a logging failure must not undo a completed registration.
    try {
      const ip = ((await headers()).get("x-forwarded-for") || "").split(",")[0].trim() || null;
      await recordConsent({ userId: id, kind: CONSENT_PRIVACY_POLICY, policyVersion: PRIVACY_POLICY_VERSION, ip });
    } catch { /* consent log is best-effort */ }

    await createSession({ userId: id, role, email });
  } catch (err) {
    // UNIQUE violation on email (race) or any unexpected DB error.
    const msg = (err as Error)?.message ?? "";
    if (/unique|duplicate/i.test(msg)) return { error: "Já existe uma conta com este e-mail." };
    return { error: "Não foi possível concluir o cadastro. Tente novamente." };
  }
  redirect("/precos");
}

export async function login(formData: FormData): Promise<AuthResult> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Informe e-mail e senha." };

  let mustChange = false;
  try {
    const user = await users.getUserByEmail(email);
    // Same generic message whether the user is missing, disabled, or the
    // password is wrong — don't leak which accounts exist.
    const GENERIC = "E-mail ou senha incorretos.";
    if (!user || user.status !== "active") return { error: GENERIC };
    const ok = await verifyPassword(password, user.password_hash, user.password_salt);
    if (!ok) return { error: GENERIC };

    mustChange = Boolean(user.must_change_password);
    await users.touchLastLogin(user.id);
    await createSession({ userId: user.id, role: user.role, email: user.email, mustChange });
  } catch {
    return { error: "Falha ao entrar. Tente novamente." };
  }
  redirect(mustChange ? "/trocar-senha" : "/precos");
}

/** First-login (or voluntary) password change. Clears the force-change flag and
 *  re-issues the session without it. */
export async function changePassword(formData: FormData): Promise<AuthResult> {
  const session = await getSession();
  if (!session) return { error: "Sessão expirada. Entre novamente." };

  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < MIN_PW) return { error: `A senha precisa ter pelo menos ${MIN_PW} caracteres.` };
  if (password !== confirm) return { error: "As senhas não conferem." };

  try {
    const { hash, salt } = await hashPassword(password);
    await users.setPassword(session.userId, hash, salt);
    await createSession({ userId: session.userId, role: session.role, email: session.email, mustChange: false });
  } catch {
    return { error: "Não foi possível alterar a senha. Tente novamente." };
  }
  redirect("/precos");
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/login");
}

/** Admin-only: mint a new single-use invite code and return it. */
export async function mintInvite(): Promise<{ code: string } | { error: string }> {
  const session = await getSession();
  if (!session || session.role !== "admin") return { error: "Acesso negado." };
  const code = formatCode(randomBytes(9));
  try {
    await users.createInvite(code, session.userId);
  } catch {
    return { error: "Não foi possível gerar o convite." };
  }
  return { code };
}

// 9 random bytes → 18 hex chars grouped XXXX-XXXX-XXXX-XXXX-XX (uppercase).
function formatCode(bytes: Buffer): string {
  const hex = bytes.toString("hex").toUpperCase();
  return (hex.match(/.{1,4}/g) ?? [hex]).join("-");
}
