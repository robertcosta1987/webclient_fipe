// scripts/lgpd-retention.ts — LGPD retention purge/anonymize job (Art. 15/16).
//
// Deletes/anonymizes rows past their retention window. Parameterized (@cutoff),
// owner-agnostic, idempotent (re-running only touches rows still past the window).
//
//   DRY-RUN (default): only reports how many rows WOULD be affected.
//     npx tsx scripts/lgpd-retention.ts
//   APPLY:
//     npx tsx scripts/lgpd-retention.ts --apply
//   Include opt-in tasks (e.g. inactive-account anonymization):
//     npx tsx scripts/lgpd-retention.ts --apply --accounts
//
// Schedule via cron or an Azure Function timer. Windows are PROVISÓRIO — see
// src/lib/lgpd/retention.ts + docs/LGPD/OPEN_DECISIONS.md.
import { config as loadEnv } from "dotenv";
import sql from "mssql";
import { cutoffIso, loadRetention, retentionTasks } from "../src/lib/lgpd/retention";
import { scrubPayloadJson } from "../src/lib/lgpd/scrubPii";

loadEnv({ path: ".env.local" });

// Consult caches whose payloads are scrubbed of owner PII past the window (the
// rows themselves are NEVER deleted — they are the vehicle-data enrichment MOAT).
const SCRUB_TABLES = ["checktudo_consultas", "infocar_consultas", "kbb_consultas"] as const;
// SQL pre-filter: only rows whose payload likely still holds an owner-PII key.
const PII_LIKE = `(payload LIKE '%proprietario%' OR payload LIKE '%"cpf"%' OR payload LIKE '%"cnpj"%' OR payload LIKE '%documento%' OR payload LIKE '%nomeProprietario%')`;

/** Scrub owner PII from cached consult payloads older than the consult window,
 *  keeping the vehicle data. Bounded per run (batched); idempotent — a scrubbed
 *  row no longer matches PII_LIKE. */
async function scrubOldPayloads(pool: sql.ConnectionPool, days: number, now: Date, apply: boolean): Promise<number> {
  const cutoff = cutoffIso(days, now);
  let total = 0;
  for (const table of SCRUB_TABLES) {
    let tableTotal = 0;
    for (let batch = 0; batch < 200; batch++) { // safety cap: 200 * 1000 rows/run
      const rows = (await pool.request().input("cutoff", sql.DateTime2, cutoff)
        .query<{ id: string; payload: string }>(
          `SELECT TOP 1000 CAST(id AS NVARCHAR(40)) AS id, payload FROM ${table} WHERE consulted_at < @cutoff AND ${PII_LIKE} ORDER BY consulted_at ASC`,
        )).recordset;
      if (rows.length === 0) break;
      let changedThisBatch = 0;
      for (const r of rows) {
        const scrubbed = scrubPayloadJson(r.payload);
        if (scrubbed === r.payload) continue;
        if (apply) {
          await pool.request().input("id", sql.UniqueIdentifier, r.id)
            .input("payload", sql.NVarChar(sql.MAX), scrubbed)
            .query(`UPDATE ${table} SET payload = @payload WHERE id = @id`);
        }
        changedThisBatch++; tableTotal++; total++;
      }
      // Dry-run (no UPDATE) would loop forever on the same rows — stop after one batch.
      if (!apply || changedThisBatch === 0) break;
    }
    console.log(`  [${apply ? "apply" : "dry-run"}]   scrub_${table}: ${tableTotal} payload(s) scrubbed (corte < ${cutoff})`);
  }
  return total;
}

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
    requestTimeout: 120_000,
    connectionTimeout: 90_000,
  };
}

async function main() {
  const apply = process.argv.includes("--apply");
  const includeOptIn = process.argv.includes("--accounts");
  const cs = process.env.DATABASE_URL;
  if (!cs) throw new Error("DATABASE_URL is not set in .env.local");

  const now = new Date();
  const cfg = loadRetention(process.env);
  const tasks = retentionTasks(cfg).filter((t) => includeOptIn || !t.optIn);

  console.log(`> LGPD retention — mode: ${apply ? "APPLY" : "DRY-RUN"} · now: ${now.toISOString()}`);
  console.log(`> windows (dias): apilog=${cfg.apiLogPiiDays} consultas=${cfg.consultationDays} inativas=${cfg.inactiveAccountDays}`);

  const pool = await sql.connect(parseConnString(cs));
  let totalAffected = 0;
  try {
    for (const t of tasks) {
      const cutoff = cutoffIso(t.days, now);
      const count = await pool.request().input("cutoff", sql.DateTime2, cutoff)
        .query<{ n: number }>(t.countSql);
      const n = Number(count.recordset[0]?.n ?? 0);
      if (!apply) {
        console.log(`  [dry-run] ${t.key}: ${n} linha(s) afetada(s) (corte < ${cutoff})`);
        totalAffected += n;
        continue;
      }
      const res = await pool.request().input("cutoff", sql.DateTime2, cutoff).query(t.applySql);
      const done = res.rowsAffected[0] ?? 0;
      console.log(`  [apply]   ${t.key}: ${done} linha(s) (corte < ${cutoff})`);
      totalAffected += done;
    }
    // Scrub owner PII from old cached payloads (MOAT: rows are kept, never deleted).
    totalAffected += await scrubOldPayloads(pool, cfg.consultationDays, now, apply);
  } finally {
    await pool.close();
  }
  console.log(`> total: ${totalAffected} linha(s) ${apply ? "processadas" : "elegíveis"}.`);
  if (!apply) console.log("> nada foi alterado. Rode novamente com --apply para executar.");
}

main().catch((e) => { console.error("retention job failed:", (e as Error).message); process.exit(1); });
