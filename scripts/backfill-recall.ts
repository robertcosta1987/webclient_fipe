// scripts/backfill-recall.ts — compute and persist the "Veículo Listado
// Afetado?" recall verdict for every saved CheckTudo consult that doesn't have
// one yet. Run once after deploying the recall feature.
//
//   pnpm tsx scripts/backfill-recall.ts            # only rows missing a verdict
//   pnpm tsx scripts/backfill-recall.ts --all      # recompute every row
import { config as loadEnv } from "dotenv";
import sql from "mssql";
import { extractRecall } from "../src/lib/checktudo/recall";
import { computeRecallVerdict } from "../src/lib/checktudo/recallVerdict";

loadEnv({ path: ".env.local" });

function parse(s: string): sql.config {
  const o: Record<string, string> = {};
  for (const part of s.split(";")) { const i = part.indexOf("="); if (i > -1) o[part.slice(0, i).trim().toLowerCase()] = part.slice(i + 1).trim(); }
  return {
    server: o["server"]?.replace(/^tcp:/, "").split(",")[0] ?? "",
    port: Number(o["server"]?.split(",")[1] ?? 1433),
    database: o["initial catalog"] ?? "",
    user: o["user id"] ?? "", password: o["password"] ?? "",
    options: { encrypt: true, trustServerCertificate: false, enableArithAbort: true },
    requestTimeout: 120_000, connectionTimeout: 90_000,
  };
}

async function main() {
  const all = process.argv.includes("--all");
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not set in .env.local");
  const pool = await sql.connect(parse(process.env.DATABASE_URL!));
  const where = all ? "" : "WHERE recall_afetado IS NULL";
  const r = await pool.request().query(`SELECT id, placa, payload FROM checktudo_consultas ${where}`);
  console.log(`> ${r.recordset.length} consult(s) to analyze${all ? " (recompute all)" : ""}\n`);

  let updated = 0, noRecall = 0, failed = 0;
  for (const row of r.recordset as Array<{ id: string; placa: string; payload: string }>) {
    let data: unknown;
    try { data = JSON.parse(row.payload); } catch { failed++; continue; }
    const { chassi, recallText } = extractRecall(data);
    if (!chassi || !recallText) { noRecall++; continue; } // nothing to decide

    const v = await computeRecallVerdict(chassi, recallText);
    if (!v.ok) { console.log(`  ${row.placa} ${row.id.slice(0, 8)}: skipped (${v.reason})`); failed++; continue; }
    await pool.request()
      .input("id", sql.UniqueIdentifier, row.id)
      .input("a", sql.NVarChar(20), v.afetado)
      .input("m", sql.NVarChar(400), (v.motivo ?? "").slice(0, 400))
      .query(`UPDATE checktudo_consultas SET recall_afetado = @a, recall_motivo = @m WHERE id = @id`);
    updated++;
    console.log(`  ${row.placa} ${row.id.slice(0, 8)}: ${v.afetado}`);
  }

  console.log(`\n> done. updated=${updated} sem-recall=${noRecall} falhas=${failed}`);
  await pool.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
