// db/users.ts — repository for auth: users + single-use invite codes.

import "server-only";
import sql from "mssql";
import { getPool } from "./pool";

export type UserRow = {
  id: string;
  email: string;
  name: string | null;
  password_hash: string;
  password_salt: string;
  role: "admin" | "user";
  status: "active" | "disabled";
  must_change_password: boolean;
  created_at: string;
};

export type InviteRow = {
  code: string;
  created_by: string | null;
  used_by: string | null;
  used_at: string | null;
  expires_at: string | null;
  created_at: string;
};

const norm = (email: string) => email.trim().toLowerCase();

export async function getUserByEmail(email: string): Promise<UserRow | null> {
  const p = await getPool();
  const r = await p.request()
    .input("email", sql.NVarChar(254), norm(email))
    .query(`SELECT TOP 1 id, email, name, password_hash, password_salt, role, status, must_change_password, created_at
            FROM users WHERE email = @email`);
  return (r.recordset[0] as UserRow | undefined) ?? null;
}

export async function countUsers(): Promise<number> {
  const p = await getPool();
  const r = await p.request().query(`SELECT COUNT(*) AS n FROM users`);
  return Number(r.recordset[0].n) || 0;
}

export async function createUser(input: {
  email: string;
  name: string | null;
  passwordHash: string;
  passwordSalt: string;
  role: "admin" | "user";
  subscriptionId?: string | null;
  mustChangePassword?: boolean;
}): Promise<{ id: string }> {
  const p = await getPool();
  const r = await p.request()
    .input("email", sql.NVarChar(254), norm(input.email))
    .input("name", sql.NVarChar(120), input.name)
    .input("hash", sql.NVarChar(256), input.passwordHash)
    .input("salt", sql.NVarChar(64), input.passwordSalt)
    .input("role", sql.NVarChar(20), input.role)
    .input("sub", sql.UniqueIdentifier, input.subscriptionId ?? null)
    .input("mcp", sql.Bit, input.mustChangePassword ? 1 : 0)
    .query(`
      INSERT INTO users (email, name, password_hash, password_salt, role, status, subscription_id, must_change_password)
      OUTPUT inserted.id
      VALUES (@email, @name, @hash, @salt, @role, 'active', @sub, @mcp);
    `);
  return { id: r.recordset[0].id as string };
}

/** Set a new password and clear the force-change flag (first-login flow). */
export async function setPassword(userId: string, passwordHash: string, passwordSalt: string): Promise<void> {
  const p = await getPool();
  await p.request()
    .input("uid", sql.UniqueIdentifier, userId)
    .input("hash", sql.NVarChar(256), passwordHash)
    .input("salt", sql.NVarChar(64), passwordSalt)
    .query(`UPDATE users SET password_hash = @hash, password_salt = @salt, must_change_password = 0 WHERE id = @uid`);
}

export async function deleteUser(id: string): Promise<void> {
  const p = await getPool();
  await p.request().input("id", sql.UniqueIdentifier, id).query(`DELETE FROM users WHERE id = @id`);
}

export async function touchLastLogin(id: string): Promise<void> {
  const p = await getPool();
  await p.request()
    .input("id", sql.UniqueIdentifier, id)
    .query(`UPDATE users SET last_login_at = SYSUTCDATETIME() WHERE id = @id`);
}

// ── Invite codes ────────────────────────────────────────────────────────────

/** Atomically claim an unused, unexpired invite. Returns true if claimed. */
export async function claimInvite(code: string, userId: string): Promise<boolean> {
  const p = await getPool();
  const r = await p.request()
    .input("code", sql.NVarChar(40), code.trim())
    .input("uid", sql.UniqueIdentifier, userId)
    .query(`
      UPDATE invite_codes
      SET used_by = @uid, used_at = SYSUTCDATETIME()
      WHERE code = @code
        AND used_by IS NULL
        AND (expires_at IS NULL OR expires_at > SYSUTCDATETIME());
    `);
  return (r.rowsAffected[0] ?? 0) === 1;
}

/** Release a previously-claimed invite (best-effort rollback). */
export async function releaseInvite(code: string): Promise<void> {
  const p = await getPool();
  await p.request()
    .input("code", sql.NVarChar(40), code.trim())
    .query(`UPDATE invite_codes SET used_by = NULL, used_at = NULL WHERE code = @code`);
}

/** Is this invite currently usable (exists, unused, unexpired)? */
export async function isInviteValid(code: string): Promise<boolean> {
  const p = await getPool();
  const r = await p.request()
    .input("code", sql.NVarChar(40), code.trim())
    .query(`
      SELECT TOP 1 1 AS ok FROM invite_codes
      WHERE code = @code AND used_by IS NULL
        AND (expires_at IS NULL OR expires_at > SYSUTCDATETIME());
    `);
  return r.recordset.length === 1;
}

export async function createInvite(code: string, createdBy: string | null): Promise<void> {
  const p = await getPool();
  await p.request()
    .input("code", sql.NVarChar(40), code)
    .input("by", sql.UniqueIdentifier, createdBy)
    .query(`INSERT INTO invite_codes (code, created_by) VALUES (@code, @by)`);
}

export async function listInvites(limit = 100): Promise<InviteRow[]> {
  const p = await getPool();
  const r = await p.request()
    .input("lim", sql.Int, limit)
    .query(`SELECT TOP (@lim) code, created_by, used_by, used_at, expires_at, created_at
            FROM invite_codes ORDER BY created_at DESC`);
  return r.recordset as InviteRow[];
}
