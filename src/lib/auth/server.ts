// server.ts — server-only session cookie helpers (read/create/destroy) built
// on the runtime-agnostic sign/verify in ./session.

import "server-only";
import { cookies } from "next/headers";
import { SESSION_COOKIE, signSession, verifySession, type SessionPayload } from "./session";

const MAX_AGE_S = 60 * 60 * 24 * 7; // 7 days

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  return s;
}

export async function createSession(p: Omit<SessionPayload, "exp">): Promise<void> {
  const token = await signSession({ ...p, mustChange: p.mustChange ?? false, exp: Date.now() + MAX_AGE_S * 1000 }, secret());
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_S,
  });
}

export async function destroySession(): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token, secret());
}

/** The current user's id for tenant scoping. Throws if unauthenticated
 *  (every app route is behind middleware, so this is a safety net). */
export async function requireUserId(): Promise<string> {
  const s = await getSession();
  if (!s) throw new Error("Não autenticado.");
  return s.userId;
}

// Master users see EVERY tenant's cached consults (cross-tenant read).
const MASTER_EMAILS = new Set(["admin@3ahub.com.br"]);

export function isMasterEmail(email: string | null | undefined): boolean {
  return !!email && MASTER_EMAILS.has(email.toLowerCase());
}

/** Tenant scope for the current request: the user's own id, plus whether they
 *  are a master (who reads across all owners). For writes, always use `userId`. */
export async function requireScope(): Promise<{ userId: string; master: boolean }> {
  const s = await getSession();
  if (!s) throw new Error("Não autenticado.");
  return { userId: s.userId, master: isMasterEmail(s.email) };
}
