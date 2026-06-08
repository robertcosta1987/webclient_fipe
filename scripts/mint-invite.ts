// scripts/mint-invite.ts — bootstrap helper: insert a single-use invite code
// directly into the DB and print it. Use it to create the FIRST account (which
// becomes admin); afterwards admins mint codes in-app at /admin/convites.
//
//   pnpm tsx scripts/mint-invite.ts        # 1 code
//   pnpm tsx scripts/mint-invite.ts 3      # 3 codes
import { randomBytes } from "node:crypto";
import { config as loadEnv } from "dotenv";
import sql from "mssql";

loadEnv({ path: ".env.local" });

function parseConnString(s: string): sql.config {
  const out: Record<string, string> = {};
  for (const part of s.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    out[part.slice(0, eq).trim().toLowerCase()] = part.slice(eq + 1).trim();
  }
  return {
    server: out["server"]?.replace(/^tcp:/, "").split(",")[0] ?? "",
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

function code(): string {
  const hex = randomBytes(9).toString("hex").toUpperCase();
  return (hex.match(/.{1,4}/g) ?? [hex]).join("-");
}

async function main() {
  const n = Math.max(1, Number(process.argv[2] || "1"));
  const cs = process.env.DATABASE_URL;
  if (!cs) throw new Error("DATABASE_URL is not set in .env.local");
  const pool = await sql.connect(parseConnString(cs));
  console.log(`> minting ${n} invite code(s):\n`);
  for (let i = 0; i < n; i++) {
    const c = code();
    await pool.request().input("code", sql.NVarChar(40), c).query(
      `INSERT INTO invite_codes (code) VALUES (@code)`,
    );
    console.log(`   ${c}`);
  }
  console.log(`\n> share: /register?invite=<code>`);
  await pool.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
