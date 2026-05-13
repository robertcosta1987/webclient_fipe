// db/pool.ts — single mssql connection pool shared across the Node process.
//
// SQL Serverless: when the DB has been paused (>1h idle), the first
// connection takes 30-60s to wake up. We bake that into the request
// timeout. After warm-up subsequent calls are fast.
//
// We don't paper over the cold start in the UI — the autofill modal
// shows a spinner that covers both the platform call and the duplicate
// check, so a slow first DB query just looks like a slow lookup.

import "server-only";
import sql from "mssql";

let _pool: sql.ConnectionPool | null = null;
let _pending: Promise<sql.ConnectionPool> | null = null;

function parseConnString(s: string): sql.config {
  const out: Record<string, string> = {};
  for (const part of s.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    out[part.slice(0, eq).trim().toLowerCase()] = part.slice(eq + 1).trim();
  }
  const server = out["server"]?.replace(/^tcp:/, "").split(",")[0] ?? "";
  return {
    server,
    port: Number(out["server"]?.split(",")[1] ?? 1433),
    database: out["initial catalog"] ?? out["database"] ?? "",
    user: out["user id"] ?? out["uid"] ?? "",
    password: out["password"] ?? out["pwd"] ?? "",
    options: {
      encrypt: (out["encrypt"] ?? "true").toLowerCase() === "true",
      trustServerCertificate: (out["trustservercertificate"] ?? "false").toLowerCase() === "true",
      enableArithAbort: true,
    },
    pool: { min: 0, max: 4, idleTimeoutMillis: 30_000 },
    requestTimeout: 120_000,
    connectionTimeout: 90_000,
  };
}

export async function getPool(): Promise<sql.ConnectionPool> {
  if (_pool && _pool.connected) return _pool;
  if (_pending) return _pending;
  const cs = process.env.DATABASE_URL;
  if (!cs) throw new Error("DATABASE_URL is not set");
  const cfg = parseConnString(cs);
  _pending = sql
    .connect(cfg)
    .then((p) => {
      _pool = p;
      _pending = null;
      return p;
    })
    .catch((e) => {
      _pending = null;
      throw e;
    });
  return _pending;
}

/** Warm the connection so the first user-facing query doesn't pay the
 *  Serverless cold-start tax. Fire-and-forget at module boot. */
export async function warmPool(): Promise<void> {
  try {
    const p = await getPool();
    await p.request().query("SELECT 1");
  } catch {
    // swallow — boot warm-up failure shouldn't crash the app
  }
}
