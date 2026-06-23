// db/apiRequestLogs.ts — per-request audit log for the programmatic API. One row
// per call (including rejected attempts), mirroring the web path's tracking so
// every call can be checked as legit and reconciled against charges.

import "server-only";
import sql from "mssql";
import { getPool } from "./pool";

export type ApiRequestLog = {
  subscriptionId: string | null;
  userId: string | null;
  apiKeyPrefix: string | null;
  endpoint: string | null;
  placa: string | null;
  productCode: number | null;
  outcome: "ok" | "error" | "auth_failed";
  source: "live" | "cache" | null;
  charged: boolean;
  errorCode: string | null;
  httpStatus: number | null;
  durationMs: number | null;
  ip: string | null;
  userAgent: string | null;
  country: string | null;
  city: string | null;
  consultaId: string | null;
};

/** Best-effort insert — never throws into the request path. */
export async function logApiRequest(e: ApiRequestLog): Promise<void> {
  try {
    const p = await getPool();
    await p.request()
      .input("sub", sql.UniqueIdentifier, e.subscriptionId)
      .input("uid", sql.UniqueIdentifier, e.userId)
      .input("pfx", sql.NVarChar(16), e.apiKeyPrefix)
      .input("ep", sql.NVarChar(80), e.endpoint)
      .input("placa", sql.NVarChar(10), e.placa)
      .input("code", sql.SmallInt, e.productCode)
      .input("outcome", sql.NVarChar(20), e.outcome)
      .input("source", sql.NVarChar(10), e.source)
      .input("charged", sql.Bit, e.charged)
      .input("err", sql.NVarChar(60), e.errorCode)
      .input("status", sql.Int, e.httpStatus)
      .input("dur", sql.Int, e.durationMs)
      .input("ip", sql.NVarChar(64), e.ip)
      .input("ua", sql.NVarChar(400), e.userAgent)
      .input("country", sql.NVarChar(8), e.country)
      .input("city", sql.NVarChar(80), e.city)
      .input("consulta", sql.UniqueIdentifier, e.consultaId)
      .query(`INSERT INTO api_request_logs
        (subscription_id, user_id, api_key_prefix, endpoint, placa, product_code, outcome, source, charged, error_code, http_status, duration_ms, ip, user_agent, country, city, consulta_id)
        VALUES (@sub, @uid, @pfx, @ep, @placa, @code, @outcome, @source, @charged, @err, @status, @dur, @ip, @ua, @country, @city, @consulta)`);
  } catch { /* logging must never break the response */ }
}

/** The caller's own API-request log lines for the data export (Art. 18 II/V).
 *  Scoped by user_id; capped so an export stays bounded. */
export async function listByUser(userId: string, limit = 5000): Promise<Record<string, unknown>[]> {
  const p = await getPool();
  const r = await p.request()
    .input("uid", sql.UniqueIdentifier, userId)
    .input("lim", sql.Int, limit)
    .query(`SELECT TOP (@lim) created_at, endpoint, placa, product_code, outcome, source,
                   charged, http_status, duration_ms, ip, user_agent, country, city
            FROM api_request_logs WHERE user_id = @uid ORDER BY created_at DESC`);
  return r.recordset as Record<string, unknown>[];
}

/** Anonymize a user's API-request logs on erasure (Art. 18 VI). The rows are
 *  kept for fiscal reconciliation of charges (Art. 16) but the personal columns
 *  (plate, IP, user-agent, geo) are stripped. Returns rows affected. */
export async function anonymizeByUser(userId: string): Promise<number> {
  const p = await getPool();
  const r = await p.request()
    .input("uid", sql.UniqueIdentifier, userId)
    .query(`UPDATE api_request_logs
            SET placa = NULL, ip = NULL, user_agent = NULL, country = NULL, city = NULL
            WHERE user_id = @uid`);
  return r.rowsAffected[0] ?? 0;
}
