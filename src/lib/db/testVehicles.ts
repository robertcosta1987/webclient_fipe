// db/testVehicles.ts — CRUD for vehicles registered on "Teste Auto Preenchimento".

import "server-only";
import sql from "mssql";
import { getPool } from "./pool";

export type VehicleInput = {
  placa: string | null;
  marca: string | null;
  modelo: string | null;
  versao: string | null;
  anoModelo: string | null;
  anoFabricacao: string | null;
  chassi: string | null;
  numMotor: string | null;
  combustivel: string | null;
  corVeiculo: string | null;
  tipoVeiculo: string | null;
  especieVeiculo: string | null;
  nacional: string | null;
  potencia: string | null;
  cilindradas: string | null;
  eixos: string | null;
  capMaxTracao: string | null;
  capacidadePassageiro: string | null;
  caixaCambio: string | null;
  numCarroceria: string | null;
  codigoFipe: string | null;
  fipeId: string | null;
  versaoFipe: string | null;
  valorAtual: number | null;
  opcionais: string | null; // texto livre: opcionais / outras características
  photoCount: number;
  photos: string | null; // JSON array of public photo URLs
};

export type VehicleRow = VehicleInput & { id: string; created_at: string; updated_at: string };

function bind(req: sql.Request, v: VehicleInput): sql.Request {
  return req
    .input("placa", sql.NVarChar(10), v.placa)
    .input("marca", sql.NVarChar(120), v.marca)
    .input("modelo", sql.NVarChar(160), v.modelo)
    .input("versao", sql.NVarChar(200), v.versao)
    .input("anoModelo", sql.NVarChar(10), v.anoModelo)
    .input("anoFabricacao", sql.NVarChar(10), v.anoFabricacao)
    .input("chassi", sql.NVarChar(40), v.chassi)
    .input("numMotor", sql.NVarChar(40), v.numMotor)
    .input("combustivel", sql.NVarChar(60), v.combustivel)
    .input("corVeiculo", sql.NVarChar(40), v.corVeiculo)
    .input("tipoVeiculo", sql.NVarChar(60), v.tipoVeiculo)
    .input("especieVeiculo", sql.NVarChar(60), v.especieVeiculo)
    .input("nacional", sql.NVarChar(30), v.nacional)
    .input("potencia", sql.NVarChar(20), v.potencia)
    .input("cilindradas", sql.NVarChar(20), v.cilindradas)
    .input("eixos", sql.NVarChar(10), v.eixos)
    .input("capMaxTracao", sql.NVarChar(20), v.capMaxTracao)
    .input("capacidadePassageiro", sql.NVarChar(10), v.capacidadePassageiro)
    .input("caixaCambio", sql.NVarChar(60), v.caixaCambio)
    .input("numCarroceria", sql.NVarChar(60), v.numCarroceria)
    .input("codigoFipe", sql.NVarChar(20), v.codigoFipe)
    .input("fipeId", sql.NVarChar(20), v.fipeId)
    .input("versaoFipe", sql.NVarChar(200), v.versaoFipe)
    .input("valorAtual", sql.Decimal(14, 2), v.valorAtual)
    .input("opcionais", sql.NVarChar(2000), v.opcionais)
    .input("photoCount", sql.Int, v.photoCount ?? 0)
    .input("photos", sql.NVarChar(sql.MAX), v.photos ?? null);
}

const COLS = `placa, marca, modelo, versao, ano_modelo, ano_fabricacao, chassi, num_motor,
  combustivel, cor_veiculo, tipo_veiculo, especie_veiculo, nacional, potencia, cilindradas,
  eixos, cap_max_tracao, capacidade_passageiro, caixa_cambio, num_carroceria, codigo_fipe,
  fipe_id, versao_fipe, valor_atual, opcionais, photo_count, photos`;
const VALS = `@placa, @marca, @modelo, @versao, @anoModelo, @anoFabricacao, @chassi, @numMotor,
  @combustivel, @corVeiculo, @tipoVeiculo, @especieVeiculo, @nacional, @potencia, @cilindradas,
  @eixos, @capMaxTracao, @capacidadePassageiro, @caixaCambio, @numCarroceria, @codigoFipe,
  @fipeId, @versaoFipe, @valorAtual, @opcionais, @photoCount, @photos`;

/** Insert a new vehicle for an owner; returns the new id. */
export async function createVehicle(ownerId: string, v: VehicleInput): Promise<{ id: string }> {
  const p = await getPool();
  const r = await bind(p.request().input("owner", sql.UniqueIdentifier, ownerId), v)
    .query(`INSERT INTO test_vehicles (owner_id, ${COLS})
            OUTPUT CAST(inserted.id AS NVARCHAR(40)) AS id
            VALUES (@owner, ${VALS});`);
  return { id: r.recordset[0].id as string };
}

/** Update an existing vehicle (scoped to its owner). */
export async function updateVehicle(id: string, ownerId: string, v: VehicleInput): Promise<void> {
  const p = await getPool();
  await bind(p.request().input("id", sql.UniqueIdentifier, id).input("owner", sql.UniqueIdentifier, ownerId), v)
    .query(`UPDATE test_vehicles SET
              placa=@placa, marca=@marca, modelo=@modelo, versao=@versao, ano_modelo=@anoModelo,
              ano_fabricacao=@anoFabricacao, chassi=@chassi, num_motor=@numMotor, combustivel=@combustivel,
              cor_veiculo=@corVeiculo, tipo_veiculo=@tipoVeiculo, especie_veiculo=@especieVeiculo,
              nacional=@nacional, potencia=@potencia, cilindradas=@cilindradas, eixos=@eixos,
              cap_max_tracao=@capMaxTracao, capacidade_passageiro=@capacidadePassageiro,
              caixa_cambio=@caixaCambio, num_carroceria=@numCarroceria, codigo_fipe=@codigoFipe,
              fipe_id=@fipeId, versao_fipe=@versaoFipe, valor_atual=@valorAtual, opcionais=@opcionais, photo_count=@photoCount, photos=@photos,
              updated_at=SYSUTCDATETIME()
            WHERE id=@id AND owner_id=@owner;`);
}

/** Most recent saved vehicle for a plate (owner-scoped) — id + photos + opcionais. */
export async function getByPlaca(ownerId: string, placa: string): Promise<{ id: string; photos: string[]; opcionais: string | null } | null> {
  const p = await getPool();
  const r = await p.request()
    .input("owner", sql.UniqueIdentifier, ownerId)
    .input("placa", sql.NVarChar(10), placa)
    .query(`SELECT TOP 1 CAST(id AS NVARCHAR(40)) AS id, photos, opcionais FROM test_vehicles
            WHERE owner_id=@owner AND placa=@placa ORDER BY updated_at DESC`);
  const row = r.recordset[0];
  if (!row) return null;
  let photos: string[] = [];
  try { const v = row.photos ? JSON.parse(row.photos) : []; if (Array.isArray(v)) photos = v.filter((x) => typeof x === "string"); } catch { /* ignore */ }
  return { id: row.id as string, photos, opcionais: (row.opcionais as string) ?? null };
}

export async function deleteVehicle(id: string, ownerId: string): Promise<void> {
  const p = await getPool();
  await p.request().input("id", sql.UniqueIdentifier, id).input("owner", sql.UniqueIdentifier, ownerId)
    .query(`DELETE FROM test_vehicles WHERE id=@id AND owner_id=@owner;`);
}
