// scripts/backfill-infocar.ts — seed infocar_consultas from carros_ativos.
//
// Before the dedicated /infocar page existed, the only persisted Infocar (FIPE)
// results were the vehicle rows saved in carros_ativos via the "add car" flow.
// This one-off backfill reconstructs an Infocar consultation row from each saved
// car so those historical lookups show up in the new /infocar history/cache.
//
// Idempotent: a plate that already has an infocar_consultas row (for the same
// owner) is skipped, so re-running — or running after live consults — is safe.
//
//   npm run db:migrate                 # create the table first
//   npx tsx scripts/backfill-infocar.ts
import { config as loadEnv } from "dotenv";
import sql from "mssql";

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

type CarRow = {
  placa: string; chassi: string | null; modelo: string | null;
  ano_fabricacao: number | null; ano_modelo: number | null;
  cor: string | null; combustivel: string | null; uf: string | null; municipio: string | null;
  tipo_veiculo: string | null; motor: string | null; numero_caixa_cambio: string | null;
  numero_eixo_traseiro_diferencial: string | null; procedencia: string | null; situacao_chassi: string | null;
  capacidade_de_carga: string | null; potencia: string | null; numero_cilindradas: string | null;
  capacidade_de_passageiros: string | null; tipo_montagem: string | null; quantidade_de_eixos: string | null;
  carroceria: string | null; codigo_fipe: string | null; descricao_fipe: string | null;
  valor_fipe: number | null; criado_em: Date; owner_id: string | null;
};

function str(v: unknown): string { return v === null || v === undefined ? "" : String(v); }
function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v); return Number.isFinite(n) ? n : null;
}

async function main() {
  const pool = await sql.connect(parse(process.env.DATABASE_URL!));

  const cars = (await pool.request().query(`
    SELECT placa, chassi, modelo, ano_fabricacao, ano_modelo, cor, combustivel, uf, municipio,
           tipo_veiculo, motor, numero_caixa_cambio, numero_eixo_traseiro_diferencial, procedencia,
           situacao_chassi, capacidade_de_carga, potencia, numero_cilindradas, capacidade_de_passageiros,
           tipo_montagem, quantidade_de_eixos, carroceria, codigo_fipe, descricao_fipe, valor_fipe,
           criado_em, owner_id
    FROM carros_ativos
    ORDER BY criado_em ASC
  `)).recordset as CarRow[];
  console.log(`> ${cars.length} saved car(s) to consider\n`);

  let inserted = 0, skipped = 0;
  for (const c of cars) {
    // Skip if this plate already has an infocar row for the same owner
    // (covers re-runs and plates already consulted live on /infocar).
    const dupReq = pool.request().input("placa", sql.NVarChar(10), c.placa);
    let ownerClause = "owner_id IS NULL";
    if (c.owner_id) { dupReq.input("owner", sql.UniqueIdentifier, c.owner_id); ownerClause = "owner_id = @owner"; }
    const existing = await dupReq.query(`SELECT TOP 1 id FROM infocar_consultas WHERE placa = @placa AND ${ownerClause}`);
    if (existing.recordset.length) { skipped++; continue; }

    const valorStr = c.valor_fipe !== null ? String(c.valor_fipe) : "";
    const payload = {
      placa: c.placa, chassi: str(c.chassi), modelo: str(c.modelo),
      anoFabricacao: c.ano_fabricacao, anoModelo: c.ano_modelo,
      cor: str(c.cor), combustivel: str(c.combustivel), uf: str(c.uf), municipio: str(c.municipio),
      tipoVeiculo: str(c.tipo_veiculo), motor: str(c.motor), numeroCaixaCambio: str(c.numero_caixa_cambio),
      numeroEixoTraseiroDiferencial: str(c.numero_eixo_traseiro_diferencial), procedencia: str(c.procedencia),
      situacaoChassi: str(c.situacao_chassi), capacidadeDeCarga: str(c.capacidade_de_carga),
      potencia: str(c.potencia), numeroCilindradas: str(c.numero_cilindradas),
      capacidadeDePassageiros: str(c.capacidade_de_passageiros), tipoMontagem: str(c.tipo_montagem),
      quantidadeDeEixos: str(c.quantidade_de_eixos), carroceria: str(c.carroceria),
      codigoFipe: str(c.codigo_fipe), descricao: str(c.descricao_fipe), valor: valorStr,
    };
    const fipeOptions = c.codigo_fipe
      ? [{ codigoFipe: str(c.codigo_fipe), descricao: str(c.descricao_fipe), valor: valorStr }]
      : [];
    const stored = { payload, fipeOptions, raw: { backfilledFrom: "carros_ativos", payload } };

    const req = pool.request()
      .input("placa", sql.NVarChar(10), c.placa)
      .input("marca", sql.NVarChar(60), null)
      .input("modelo", sql.NVarChar(200), c.modelo ? str(c.modelo).slice(0, 200) : null)
      .input("ano_modelo", sql.SmallInt, c.ano_modelo)
      .input("codigo_fipe", sql.NVarChar(20), c.codigo_fipe ? str(c.codigo_fipe).slice(0, 20) : null)
      .input("valor_fipe", sql.Decimal(12, 2), numOrNull(c.valor_fipe))
      .input("source_id", sql.NVarChar(40), "carros_backfill")
      .input("payload", sql.NVarChar(sql.MAX), JSON.stringify(stored))
      .input("consulted_at", sql.DateTime2, c.criado_em);
    if (c.owner_id) req.input("owner", sql.UniqueIdentifier, c.owner_id);
    await req.query(`
      INSERT INTO infocar_consultas (placa, owner_id, marca, modelo, ano_modelo, codigo_fipe, valor_fipe, source_id, upstream_latency_ms, payload, consulted_at)
      VALUES (@placa, ${c.owner_id ? "@owner" : "NULL"}, @marca, @modelo, @ano_modelo, @codigo_fipe, @valor_fipe, @source_id, NULL, @payload, @consulted_at)
    `);
    inserted++;
    console.log(`  + ${c.placa} ${str(c.modelo).slice(0, 40)}${c.owner_id ? "" : " (sem owner)"}`);
  }

  console.log(`\n> done. inserted=${inserted} skipped=${skipped}`);
  await pool.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
