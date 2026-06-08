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
  const token = await signSession({ ...p, exp: Date.now() + MAX_AGE_S * 1000 }, secret());
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
