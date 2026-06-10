// scripts/seed-internal-subscription.ts — create an app-side subscription, assign
// a user to it, and backfill the usage ledger from that user's existing CheckTudo
// consults so the Usage Report shows the subscription with historical data.
//
// Each existing checktudo_consultas row = one real (live) vendor call that
// happened, so it's backfilled as source='live' at its original timestamp.
// Idempotent: a consult already present in api_usage (by consulta_id) is skipped.
//
//   npx tsx scripts/seed-internal-subscription.ts
//   npx tsx scripts/seed-internal-subscription.ts <email> <name> <subKey>
import { config as loadEnv } from "dotenv";
import sql from "mssql";

loadEnv({ path: ".env.local" });

const EMAIL = (process.argv[2] ?? "admin@3ahub.com.br").trim().toLowerCase();
const NAME = process.argv[3] ?? "TestSubInternal";
const SUBKEY = process.argv[4] ?? "SUB-TESTINTERNAL-001";

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
  const pool = await sql.connect(parse(process.env.DATABASE_URL!));

  // 1. Upsert the subscription.
  let subId = (await pool.request().input("n", sql.NVarChar(120), NAME)
    .query(`SELECT TOP 1 CAST(id AS NVARCHAR(40)) id FROM subscriptions WHERE name = @n`)).recordset[0]?.id;
  if (!subId) {
    subId = (await pool.request()
      .input("n", sql.NVarChar(120), NAME)
      .input("k", sql.NVarChar(60), SUBKEY)
      .query(`INSERT INTO subscriptions (name, sub_key, status) OUTPUT CAST(inserted.id AS NVARCHAR(40)) id VALUES (@n, @k, 'active')`)).recordset[0].id;
    console.log(`> created subscription ${NAME} (${SUBKEY}) = ${subId}`);
  } else {
    console.log(`> subscription ${NAME} already exists = ${subId}`);
  }

  // 2. Find the user, assign the subscription.
  const u = (await pool.request().input("e", sql.NVarChar(254), EMAIL)
    .query(`SELECT TOP 1 CAST(id AS NVARCHAR(40)) id FROM users WHERE LOWER(email) = @e`)).recordset[0];
  if (!u) throw new Error(`No user with email ${EMAIL}`);
  await pool.request().input("s", sql.UniqueIdentifier, subId).input("uid", sql.UniqueIdentifier, u.id)
    .query(`UPDATE users SET subscription_id = @s WHERE id = @uid`);
  console.log(`> assigned ${EMAIL} (${u.id}) -> ${NAME}`);

  // 2b. Reassign this user's EXISTING usage rows to the subscription (rows
  //     recorded before the assignment snapshotted a NULL/old subscription).
  const reassigned = await pool.request().input("s", sql.UniqueIdentifier, subId).input("uid", sql.UniqueIdentifier, u.id)
    .query(`UPDATE api_usage SET subscription_id = @s WHERE user_id = @uid AND (subscription_id IS NULL OR subscription_id <> @s)`);
  console.log(`> reassigned ${reassigned.rowsAffected[0] ?? 0} existing usage row(s) -> ${NAME}`);

  // 3. Backfill the usage ledger from this user's CheckTudo consults (live),
  //    skipping any consult already metered.
  const r = await pool.request()
    .input("s", sql.UniqueIdentifier, subId)
    .input("uid", sql.UniqueIdentifier, u.id)
    .input("e", sql.NVarChar(254), EMAIL)
    .query(`
      INSERT INTO api_usage (subscription_id, user_id, user_email, api, product_code, product_name, consulta_id, placa, unit_price_brl, counted_at, source)
      SELECT @s, @uid, @e, 'checktudo', c.product_code, COALESCE(p.name, c.product_name), c.id, c.placa, p.unit_price_brl, c.consulted_at, 'live'
      FROM checktudo_consultas c
      LEFT JOIN api_products p ON p.api = 'checktudo' AND p.code = c.product_code
      WHERE c.owner_id = @uid
        AND NOT EXISTS (SELECT 1 FROM api_usage au WHERE au.consulta_id = c.id);
    `);
  console.log(`> backfilled ${r.rowsAffected[0] ?? 0} consult(s) into api_usage (source=live) under ${NAME}`);

  await pool.close();
  console.log("> done.");
}

main().catch((e) => { console.error(e); process.exit(1); });
