// scripts/create-api-customer.ts — provision an API-only customer end-to-end and
// issue its key, all under one billable subscription (ondemand = billed at end of
// cycle, no hard cap). Idempotent on subscription name + user e-mail.
//
// Usage:
//   npx tsx scripts/create-api-customer.ts "<Subscription Name>" <email> "<Company>" [priceBRL]

import "dotenv/config";
import sql from "mssql";
import fs from "node:fs";
import { randomBytes, createHash } from "node:crypto";

const FIPE_CODE = 202;

function parseConn(s: string): sql.config {
  const o: Record<string, string> = {};
  for (const part of s.split(";")) { const i = part.indexOf("="); if (i === -1) continue; o[part.slice(0, i).trim().toLowerCase()] = part.slice(i + 1).trim(); }
  return {
    server: (o["server"] ?? "").replace(/^tcp:/, "").split(",")[0],
    port: Number(o["server"]?.split(",")[1] ?? 1433),
    database: o["initial catalog"] ?? o["database"] ?? "",
    user: o["user id"] ?? o["uid"] ?? "", password: o["password"] ?? o["pwd"] ?? "",
    options: { encrypt: true, trustServerCertificate: false, enableArithAbort: true },
    requestTimeout: 60_000, connectionTimeout: 60_000,
  };
}

function slug(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 16) || "CLIENTE";
}

async function main() {
  const name = (process.argv[2] ?? "").trim();
  const email = (process.argv[3] ?? "").trim().toLowerCase();
  const company = (process.argv[4] ?? name).trim();
  const price = process.argv[5] !== undefined ? Number(process.argv[5]) : null;
  if (!name || !email) { console.error('Uso: npx tsx scripts/create-api-customer.ts "<Nome>" <email> "<Empresa>" [priceBRL]'); process.exit(1); }

  let cs = process.env.DATABASE_URL;
  if (!cs && fs.existsSync(".env.local")) { const m = fs.readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.*)$/m); if (m) cs = m[1].trim().replace(/^["']|["']$/g, ""); }
  if (!cs) throw new Error("DATABASE_URL não definido.");

  const pool = await sql.connect(parseConn(cs));
  try {
    // 1. Subscription (ondemand, no cap → billed end of cycle). Reuse by name.
    let subId: string;
    const existingSub = await pool.request().input("n", sql.NVarChar(120), name)
      .query(`SELECT TOP 1 CAST(id AS NVARCHAR(40)) AS id FROM subscriptions WHERE name=@n`);
    if (existingSub.recordset[0]) {
      subId = existingSub.recordset[0].id;
      console.log("• Assinatura já existe, reutilizando:", subId);
    } else {
      const subKey = `SUB-${slug(company)}-${randomBytes(2).toString("hex").toUpperCase()}`;
      const r = await pool.request()
        .input("n", sql.NVarChar(120), name).input("k", sql.NVarChar(60), subKey)
        .query(`INSERT INTO subscriptions (name, sub_key, status, plan_type, query_limit, spend_limit_brl)
                OUTPUT inserted.id, inserted.sub_key VALUES (@n, @k, 'active', 'ondemand', NULL, NULL);`);
      subId = r.recordset[0].id; console.log("• Assinatura criada:", subId, "·", r.recordset[0].sub_key, "· plano ondemand (sem teto)");
    }

    // Enable programmatic (API-key) access for THIS subscription only.
    await pool.request().input("s", sql.UniqueIdentifier, subId)
      .query(`IF COL_LENGTH('subscriptions','api_access') IS NOT NULL UPDATE subscriptions SET api_access=1 WHERE id=@s`);

    // 2. Login/metering user (API-only — login effectively disabled).
    let userId: string;
    const existingUser = await pool.request().input("e", sql.NVarChar(254), email)
      .query(`SELECT TOP 1 CAST(id AS NVARCHAR(40)) AS id FROM users WHERE email=@e`);
    if (existingUser.recordset[0]) {
      userId = existingUser.recordset[0].id;
      await pool.request().input("id", sql.UniqueIdentifier, userId).input("s", sql.UniqueIdentifier, subId)
        .query(`UPDATE users SET subscription_id=@s WHERE id=@id`);
      console.log("• Usuário já existe, vinculado à assinatura:", userId);
    } else {
      const r = await pool.request()
        .input("e", sql.NVarChar(254), email).input("n", sql.NVarChar(120), name)
        .input("h", sql.NVarChar(200), randomBytes(32).toString("hex")).input("salt", sql.NVarChar(200), randomBytes(16).toString("hex"))
        .input("s", sql.UniqueIdentifier, subId)
        .query(`INSERT INTO users (email, name, password_hash, password_salt, role, status, subscription_id, must_change_password)
                OUTPUT CAST(inserted.id AS NVARCHAR(40)) AS id VALUES (@e, @n, @h, @salt, 'user', 'active', @s, 0);`);
      userId = r.recordset[0].id; console.log("• Usuário (API) criado:", userId);
    }

    // 3. CRM row (best-effort).
    try {
      const ex = await pool.request().input("s", sql.UniqueIdentifier, subId).query(`SELECT TOP 1 1 AS ok FROM customers WHERE subscription_id=@s`);
      if (!ex.recordset[0]) {
        await pool.request().input("n", sql.NVarChar(160), name).input("c", sql.NVarChar(160), company).input("e", sql.NVarChar(254), email)
          .input("s", sql.UniqueIdentifier, subId).input("u", sql.UniqueIdentifier, userId)
          .query(`INSERT INTO customers (name, company, email, subscription_id, user_id, status) VALUES (@n, @c, @e, @s, @u, 'active');`);
        console.log("• Cliente (CRM) criado.");
      }
    } catch (e) { console.log("• CRM ignorado:", (e as Error).message); }

    // 4. Ensure FIPE product priced + contracted.
    await pool.request().input("price", sql.Decimal(12, 2), price)
      .query(`MERGE api_products AS t USING (SELECT 'checktudo' AS api, ${FIPE_CODE} AS code) AS s ON (t.api=s.api AND t.code=s.code)
              WHEN NOT MATCHED THEN INSERT (api, code, name, unit_price_brl) VALUES ('checktudo', ${FIPE_CODE}, 'Decodificador e Precificador (FIPE)', COALESCE(@price,0))
              WHEN MATCHED AND @price IS NOT NULL THEN UPDATE SET unit_price_brl=@price;`);
    await pool.request().input("s", sql.UniqueIdentifier, subId)
      .query(`IF NOT EXISTS (SELECT 1 FROM subscription_quotas WHERE subscription_id=@s AND api='checktudo' AND product_code=${FIPE_CODE})
                INSERT INTO subscription_quotas (subscription_id, api, product_code, granted) VALUES (@s, 'checktudo', ${FIPE_CODE}, NULL);`);
    const pr = await pool.request().query(`SELECT unit_price_brl FROM api_products WHERE api='checktudo' AND code=${FIPE_CODE}`);

    // 5. Issue + assign the API key (rotates if re-run).
    const rawKey = "p360_" + randomBytes(20).toString("hex");
    await pool.request().input("id", sql.UniqueIdentifier, userId)
      .input("h", sql.NVarChar(64), createHash("sha256").update(rawKey, "utf8").digest("hex")).input("p", sql.NVarChar(16), rawKey.slice(0, 12))
      .query(`UPDATE users SET api_key_hash=@h, api_key_prefix=@p, api_key_created_at=SYSUTCDATETIME() WHERE id=@id`);

    console.log(`\n✓ Cliente "${name}" pronto. Preço por consulta FIPE: R$ ${Number(pr.recordset[0].unit_price_brl).toFixed(2)} · cobrança: fim de ciclo (ondemand).`);
    console.log("\n  API KEY (copie agora — não será exibida de novo):\n");
    console.log("    " + rawKey + "\n");
    console.log("  Uso:");
    console.log(`    curl -H "Authorization: Bearer ${rawKey}" \\`);
    console.log(`      https://www.placas360.com.br/api/v1/fipe/plate/ABC1D23\n`);
  } finally {
    await pool.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
