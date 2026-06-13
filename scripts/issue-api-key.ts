// scripts/issue-api-key.ts — issue (or rotate) a programmatic API key for a
// customer, so they can call GET /api/v1/fipe/plate/{placa}. Self-contained (raw
// mssql) so it doesn't pull "server-only" modules.
//
// Usage:
//   npx tsx scripts/issue-api-key.ts <email> [priceBRL]
//   npx tsx scripts/issue-api-key.ts cliente@empresa.com 0.50
//
// The customer/user must already exist (create it in /admin/assinaturas). The
// key is printed ONCE — only its SHA-256 hash is stored.

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
    user: o["user id"] ?? o["uid"] ?? "",
    password: o["password"] ?? o["pwd"] ?? "",
    options: { encrypt: true, trustServerCertificate: false, enableArithAbort: true },
    requestTimeout: 60_000, connectionTimeout: 60_000,
  };
}

async function main() {
  const email = (process.argv[2] ?? "").trim().toLowerCase();
  const priceArg = process.argv[3];
  const price = priceArg !== undefined ? Number(priceArg) : null;
  if (!email) { console.error("Uso: npx tsx scripts/issue-api-key.ts <email> [priceBRL]"); process.exit(1); }
  if (price !== null && (!Number.isFinite(price) || price < 0)) { console.error("priceBRL inválido."); process.exit(1); }

  let cs = process.env.DATABASE_URL;
  if (!cs && fs.existsSync(".env.local")) { const m = fs.readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.*)$/m); if (m) cs = m[1].trim().replace(/^["']|["']$/g, ""); }
  if (!cs) throw new Error("DATABASE_URL não definido.");

  const pool = await sql.connect(parseConn(cs));
  try {
    const u = await pool.request().input("e", sql.NVarChar(254), email)
      .query(`SELECT TOP 1 CAST(id AS NVARCHAR(40)) AS id, CAST(subscription_id AS NVARCHAR(40)) AS sub FROM users WHERE email=@e`);
    const row = u.recordset[0];
    if (!row) { console.error(`Nenhum usuário com o e-mail ${email}. Crie a assinatura em /admin/assinaturas primeiro.`); process.exit(1); }

    // Ensure the FIPE product is sellable (+ price) and contracted on the sub.
    await pool.request()
      .input("n", sql.NVarChar(120), "Decodificador e Precificador (FIPE)")
      .input("price", sql.Decimal(12, 2), price)
      .query(`MERGE api_products AS t USING (SELECT 'checktudo' AS api, ${FIPE_CODE} AS code) AS s
              ON (t.api=s.api AND t.code=s.code)
              WHEN NOT MATCHED THEN INSERT (api, code, name, unit_price_brl) VALUES ('checktudo', ${FIPE_CODE}, @n, COALESCE(@price,0))
              WHEN MATCHED AND @price IS NOT NULL THEN UPDATE SET unit_price_brl=@price;`);
    if (row.sub) {
      await pool.request().input("s", sql.UniqueIdentifier, row.sub)
        .query(`IF NOT EXISTS (SELECT 1 FROM subscription_quotas WHERE subscription_id=@s AND api='checktudo' AND product_code=${FIPE_CODE})
                  INSERT INTO subscription_quotas (subscription_id, api, product_code, granted) VALUES (@s, 'checktudo', ${FIPE_CODE}, NULL);`);
    }

    const rawKey = "p360_" + randomBytes(20).toString("hex");
    const hash = createHash("sha256").update(rawKey, "utf8").digest("hex");
    const prefix = rawKey.slice(0, 12);
    await pool.request().input("id", sql.UniqueIdentifier, row.id).input("h", sql.NVarChar(64), hash).input("p", sql.NVarChar(16), prefix)
      .query(`UPDATE users SET api_key_hash=@h, api_key_prefix=@p, api_key_created_at=SYSUTCDATETIME() WHERE id=@id`);

    console.log("\n✓ Chave de API emitida para", email);
    if (!row.sub) console.log("  ⚠ Este usuário não tem assinatura vinculada — o uso não será limitado/cobrado por plano.");
    console.log("\n  API KEY (copie agora — não será exibida de novo):\n");
    console.log("    " + rawKey + "\n");
    console.log("  Exemplo de uso:");
    console.log(`    curl -H "Authorization: Bearer ${rawKey}" \\`);
    console.log(`      https://<seu-host>/api/v1/fipe/plate/ABC1D23\n`);
  } finally {
    await pool.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
