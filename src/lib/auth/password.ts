// password.ts — password hashing with Node's built-in scrypt (no native deps,
// safe on Vercel's Node runtime). Per-user random salt; timing-safe compare.

import "server-only";
import { scrypt, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt) as (pw: string, salt: string, keylen: number) => Promise<Buffer>;
const KEYLEN = 64;

export async function hashPassword(password: string): Promise<{ hash: string; salt: string }> {
  const salt = randomBytes(16).toString("hex");
  const dk = await scryptAsync(password, salt, KEYLEN);
  return { hash: dk.toString("hex"), salt };
}

export async function verifyPassword(password: string, hash: string, salt: string): Promise<boolean> {
  const dk = await scryptAsync(password, salt, KEYLEN);
  const expected = Buffer.from(hash, "hex");
  if (expected.length !== dk.length) return false;
  return timingSafeEqual(expected, dk);
}
