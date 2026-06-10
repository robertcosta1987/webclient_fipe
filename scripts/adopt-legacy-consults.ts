// scripts/adopt-legacy-consults.ts — give the unowned/legacy consults an owner.
//
// Tenant isolation means a regular user only sees consults saved under their own
// owner_id. Consults made before owner_id existed (owner_id IS NULL) — or under
// an account that was since deleted (owner_id not in `users`) — are therefore
// invisible to everyone but the master. This one-off assigns those rows to a
// chosen user so they show up in that user's history. Active users' rows
// (admin, other tenants) are left untouched.
//
// Idempotent: once adopted, the rows belong to a real user and won't match again.
//
//   npx tsx scripts/adopt-legacy-consults.ts                       # default email below
//   npx tsx scripts/adopt-legacy-consults.ts vaner@moneycar.com.br # adopt to another user
import { config as loadEnv } from "dotenv";
import sql from "mssql";

loadEnv({ path: ".env.local" });

const DEFAULT_EMAIL = "rcosta1987@icloud.com";
const TABLES = ["checktudo_consultas", "kbb_consultas", "infocar_consultas"];

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
  const email = (process.argv[2] ?? DEFAULT_EMAIL).trim().toLowerCase();
  const pool = await sql.connect(parse(process.env.DATABASE_URL!));

  const u = await pool.request().input("e", sql.NVarChar(254), email)
    .query(`SELECT TOP 1 CAST(id AS NVARCHAR(40)) id, role FROM users WHERE LOWER(email) = @e`);
  const target = u.recordset[0];
  if (!target) throw new Error(`No user with email ${email}`);
  console.log(`> adopting unowned/legacy consults to ${email} (${target.id}, role=${target.role})\n`);

  let total = 0;
  for (const t of TABLES) {
    const r = await pool.request().input("owner", sql.UniqueIdentifier, target.id).query(`
      UPDATE ${t}
      SET owner_id = @owner
      WHERE owner_id IS NULL
         OR owner_id NOT IN (SELECT id FROM users);
    `);
    const n = r.rowsAffected[0] ?? 0;
    total += n;
    console.log(`  ${t}: adopted ${n} row(s)`);
  }

  console.log(`\n> done. ${total} row(s) now owned by ${email}.`);
  await pool.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
