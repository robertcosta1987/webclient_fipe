// scripts/backfill-parecer.ts — compute and persist the "Parecer de Compra"
// buy/risk verdict for every saved CheckTudo consult that doesn't have one yet.
// Reuses each row's already-stored recall verdict as a signal. Run once after
// deploying the feature.
//
//   pnpm tsx scripts/backfill-parecer.ts          # only rows missing a parecer
//   pnpm tsx scripts/backfill-parecer.ts --all     # recompute every row
import { config as loadEnv } from "dotenv";
import sql from "mssql";
import { extractParecerSignals, hasParecerSignals } from "../src/lib/checktudo/parecer";
import { computeParecer } from "../src/lib/checktudo/parecerVerdict";

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

type Row = { id: string; placa: string; payload: string; recall_afetado: string | null; recall_motivo: string | null };

async function main() {
  const all = process.argv.includes("--all");
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not set in .env.local");
  const pool = await sql.connect(parse(process.env.DATABASE_URL!));
  const where = all ? "" : "WHERE parecer_veredito IS NULL";
  const r = await pool.request().query(
    `SELECT id, placa, payload, recall_afetado, recall_motivo FROM checktudo_consultas ${where}`,
  );
  console.log(`> ${r.recordset.length} consult(s) to analyze${all ? " (recompute all)" : ""}\n`);

  let updated = 0, skipped = 0, failed = 0;
  for (const row of r.recordset as Row[]) {
    let data: unknown;
    try { data = JSON.parse(row.payload); } catch { failed++; continue; }
    const signals = extractParecerSignals(data, { afetado: row.recall_afetado, motivo: row.recall_motivo });
    if (!hasParecerSignals(signals)) { skipped++; continue; }

    const v = await computeParecer(signals);
    if (!v.ok) { console.log(`  ${row.placa} ${row.id.slice(0, 8)}: skipped (${v.reason})`); failed++; continue; }
    await pool.request()
      .input("id", sql.UniqueIdentifier, row.id)
      .input("v", sql.NVarChar(20), v.veredito)
      .input("m", sql.NVarChar(500), (v.motivo ?? "").slice(0, 500))
      .query(`UPDATE checktudo_consultas SET parecer_veredito = @v, parecer_motivo = @m WHERE id = @id`);
    updated++;
    console.log(`  ${row.placa} ${row.id.slice(0, 8)}: ${v.veredito} — ${v.motivo ?? ""}`);
  }

  console.log(`\n> done. updated=${updated} sem-sinais=${skipped} falhas=${failed}`);
  await pool.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
