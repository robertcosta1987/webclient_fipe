// db/consents.ts — append-only record of data-subject consent (Art. 8º §6). Used
// to prove WHICH policy version a user accepted and WHEN.

import "server-only";
import sql from "mssql";
import { getPool } from "./pool";

export type ConsentRow = {
  id: string;
  kind: string;
  policy_version: string;
  granted: boolean;
  granted_at: string;
};

/** Record a consent event. Best-effort: a logging failure must not break the
 *  surrounding flow (e.g. registration), but the caller decides that. */
export async function recordConsent(input: {
  userId: string;
  kind: string;
  policyVersion: string;
  ip?: string | null;
}): Promise<void> {
  const p = await getPool();
  await p.request()
    .input("uid", sql.UniqueIdentifier, input.userId)
    .input("kind", sql.NVarChar(40), input.kind)
    .input("ver", sql.NVarChar(20), input.policyVersion)
    .input("ip", sql.NVarChar(64), input.ip ?? null)
    .query(`INSERT INTO user_consents (user_id, kind, policy_version, granted, ip)
            VALUES (@uid, @kind, @ver, 1, @ip)`);
}

/** The caller's own consent history, for the data export (Art. 18 II). */
export async function listByUser(userId: string): Promise<ConsentRow[]> {
  const p = await getPool();
  const r = await p.request()
    .input("uid", sql.UniqueIdentifier, userId)
    .query(`SELECT CAST(id AS NVARCHAR(40)) AS id, kind, policy_version, granted, granted_at
            FROM user_consents WHERE user_id = @uid ORDER BY granted_at DESC`);
  return r.recordset as ConsentRow[];
}

/** Remove a user's consent records on account erasure (Art. 18 VI). They carry
 *  the user_id + IP, so they go with the account. Returns rows affected. */
export async function deleteAllByUser(userId: string): Promise<number> {
  const p = await getPool();
  const r = await p.request()
    .input("uid", sql.UniqueIdentifier, userId)
    .query(`DELETE FROM user_consents WHERE user_id = @uid`);
  return r.rowsAffected[0] ?? 0;
}
