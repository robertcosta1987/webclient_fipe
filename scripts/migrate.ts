// scripts/migrate.ts — apply every .sql file in db/migrations in lexical order.
// Splits on T-SQL "GO" batch separators (mssql can't run multi-batch text in
// one go). No migration-state tracking — migrations are written to be
// idempotent (IF NOT EXISTS guards), which is sufficient for a demo schema
// of one table.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { config as loadEnv } from "dotenv";
import sql from "mssql";

loadEnv({ path: ".env.local" });

function parseConnString(s: string): sql.config {
  // Accept either ADO.NET form or the simpler key=val we generated.
  // We keep this tiny because the connection string is operator-pasted.
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
    requestTimeout: 120_000, // serverless cold-start can take 30-60s
    connectionTimeout: 90_000,
  };
}

async function main() {
  const cs = process.env.DATABASE_URL;
  if (!cs) throw new Error("DATABASE_URL is not set in .env.local");

  const cfg = parseConnString(cs);
  console.log(`> connecting to ${cfg.server}:${cfg.port}/${cfg.database} as ${cfg.user}`);
  const pool = await sql.connect(cfg);

  const dir = join(process.cwd(), "db", "migrations");
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  console.log(`> ${files.length} migration file(s) to apply`);

  for (const f of files) {
    console.log(`> applying ${f}`);
    const body = readFileSync(join(dir, f), "utf8");
    // Split on lines that are exactly "GO" (case-insensitive, optional whitespace).
    const batches = body.split(/^\s*GO\s*$/gim).map((b) => b.trim()).filter(Boolean);
    for (const [i, batch] of batches.entries()) {
      try {
        await pool.request().batch(batch);
      } catch (e) {
        console.error(`  ✖ batch ${i + 1}/${batches.length} failed:`, (e as Error).message);
        throw e;
      }
    }
    console.log(`  ✓ ${batches.length} batch(es)`);
  }
  await pool.close();
  console.log("> done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
