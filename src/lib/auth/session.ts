// session.ts — stateless signed-cookie sessions. Runtime-agnostic: uses only
// Web Crypto + TextEncoder + btoa/atob so it works in BOTH the edge middleware
// and Node server components/actions. No secrets are stored server-side; the
// cookie is an HMAC-SHA256-signed token { userId, role, email, exp }.

export type SessionPayload = {
  userId: string;
  role: string;
  email: string;
  exp: number; // epoch ms
};

export const SESSION_COOKIE = "dc_session";

function bytesToB64url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlToBytes(s: string): Uint8Array {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function getKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret) as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function signSession(payload: SessionPayload, secret: string): Promise<string> {
  const body = bytesToB64url(new TextEncoder().encode(JSON.stringify(payload)));
  const key = await getKey(secret);
  const sig = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body) as BufferSource),
  );
  return `${body}.${bytesToB64url(sig)}`;
}

export async function verifySession(token: string | undefined, secret: string): Promise<SessionPayload | null> {
  if (!token || !secret) return null;
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  try {
    const key = await getKey(secret);
    const ok = await crypto.subtle.verify(
      "HMAC",
      key,
      b64urlToBytes(sig) as BufferSource,
      new TextEncoder().encode(body) as BufferSource,
    );
    if (!ok) return null;
    const payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(body))) as SessionPayload;
    if (!payload?.exp || Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}
