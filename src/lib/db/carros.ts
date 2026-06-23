// db/carros.ts — repository for the carros_ativos table.
//
// All SQL lives here; pages/actions only call these functions. Keeps the
// fields list in one place so adding/removing a column is a single-file
// change. Parameterised queries throughout (mssql binds with @name).

import "server-only";
import sql from "mssql";
import { getPool } from "./pool";
import { parseValorFipe, type VehiclePayload } from "../platform/types";

export type Carro = {
  id: string;
  placa: string;
  chassi: string | null;
  modelo: string | null;
  ano_fabricacao: number | null;
  ano_modelo: number | null;
  cor: string | null;
  combustivel: string | null;
  uf: string | null;
  municipio: string | null;
  tipo_veiculo: string | null;
  motor: string | null;
  numero_caixa_cambio: string | null;
  numero_eixo_traseiro_diferencial: string | null;
  procedencia: string | null;
  situacao_chassi: string | null;
  capacidade_de_carga: string | null;
  potencia: string | null;
  numero_cilindradas: string | null;
  capacidade_de_passageiros: string | null;
  tipo_montagem: string | null;
  quantidade_de_eixos: string | null;
  carroceria: string | null;
  codigo_fipe: string | null;
  descricao_fipe: string | null;
  valor_fipe: number | null;
  criado_em: string;
  atualizado_em: string;
};

const ALL_COLS = [
  "id", "placa", "chassi", "modelo", "ano_fabricacao", "ano_modelo", "cor",
  "combustivel", "uf", "municipio", "tipo_veiculo", "motor", "numero_caixa_cambio",
  "numero_eixo_traseiro_diferencial", "procedencia", "situacao_chassi",
  "capacidade_de_carga", "potencia", "numero_cilindradas",
  "capacidade_de_passageiros", "tipo_montagem", "quantidade_de_eixos",
  "carroceria", "codigo_fipe", "descricao_fipe", "valor_fipe",
  "criado_em", "atualizado_em",
] as const;
const SELECT_COLS = ALL_COLS.join(", ");

// Subset of columns the UI can edit. id/placa/criado_em/atualizado_em are
// not editable: id and criado_em are immutable, atualizado_em is trigger-
// managed, placa is the natural key (delete + insert if you really mean it).
export const EDITABLE_COLS = [
  "chassi", "modelo", "ano_fabricacao", "ano_modelo", "cor", "combustivel",
  "uf", "municipio", "tipo_veiculo", "motor", "numero_caixa_cambio",
  "numero_eixo_traseiro_diferencial", "procedencia", "situacao_chassi",
  "capacidade_de_carga", "potencia", "numero_cilindradas",
  "capacidade_de_passageiros", "tipo_montagem", "quantidade_de_eixos",
  "carroceria", "codigo_fipe", "descricao_fipe", "valor_fipe",
] as const;
export type EditableCol = (typeof EDITABLE_COLS)[number];

export async function list(ownerId: string, limit = 50): Promise<Carro[]> {
  const p = await getPool();
  const r = await p.request()
    .input("owner", sql.UniqueIdentifier, ownerId)
    .input("lim", sql.Int, limit)
    .query(`SELECT TOP (@lim) ${SELECT_COLS} FROM carros_ativos WHERE owner_id = @owner ORDER BY criado_em DESC`);
  return r.recordset as Carro[];
}

export async function getByPlaca(placa: string, ownerId: string): Promise<Carro | null> {
  const p = await getPool();
  const r = await p.request()
    .input("placa", sql.NVarChar(10), placa)
    .input("owner", sql.UniqueIdentifier, ownerId)
    .query(`SELECT TOP 1 ${SELECT_COLS} FROM carros_ativos WHERE placa = @placa AND owner_id = @owner`);
  return (r.recordset[0] as Carro) ?? null;
}

export async function getById(id: string, ownerId: string): Promise<Carro | null> {
  const p = await getPool();
  const r = await p.request()
    .input("id", sql.UniqueIdentifier, id)
    .input("owner", sql.UniqueIdentifier, ownerId)
    .query(`SELECT TOP 1 ${SELECT_COLS} FROM carros_ativos WHERE id = @id AND owner_id = @owner`);
  return (r.recordset[0] as Carro) ?? null;
}

export type SearchScope =
  | "qualquer"
  | "placa" | "chassi" | "modelo" | "cor" | "municipio" | "uf"
  | "combustivel" | "ano_modelo" | "codigo_fipe";

const TEXT_SCOPES: SearchScope[] = [
  "qualquer", "placa", "chassi", "modelo", "cor", "municipio", "uf",
  "combustivel", "codigo_fipe",
];

export async function search(q: string, scope: SearchScope, ownerId: string, limit = 50): Promise<Carro[]> {
  const p = await getPool();
  const req = p.request().input("lim", sql.Int, limit).input("owner", sql.UniqueIdentifier, ownerId);
  // Owner filter is always applied; the text predicate is appended to it.
  let cond = "owner_id = @owner";

  if (!q.trim()) {
    // owner-only
  } else if (scope === "ano_modelo") {
    const n = Number(q);
    if (!Number.isFinite(n)) return [];
    req.input("yr", sql.Int, n);
    cond += " AND ano_modelo = @yr";
  } else if (scope === "qualquer") {
    req.input("q", sql.NVarChar(200), `%${q}%`);
    const cols = TEXT_SCOPES.filter((s) => s !== "qualquer");
    cond += ` AND (${cols.map((c) => `${c} LIKE @q`).join(" OR ")})`;
  } else {
    req.input("q", sql.NVarChar(200), `%${q}%`);
    cond += ` AND ${scope} LIKE @q`;
  }

  const r = await req.query(
    `SELECT TOP (@lim) ${SELECT_COLS} FROM carros_ativos WHERE ${cond} ORDER BY criado_em DESC`,
  );
  return r.recordset as Carro[];
}

/** Insert from the canonical platform payload OR a manually-edited form. */
export async function insertFromPayload(
  placa: string,
  v: Partial<VehiclePayload>,
  ownerId: string,
): Promise<{ id: string }> {
  const p = await getPool();
  const r = await p.request()
    .input("placa", sql.NVarChar(10), placa)
    .input("owner", sql.UniqueIdentifier, ownerId)
    .input("chassi", sql.NVarChar(20), nz(v.chassi))
    .input("modelo", sql.NVarChar(200), nz(v.modelo))
    .input("ano_fabricacao", sql.Int, intOrNull(v.anoFabricacao))
    .input("ano_modelo", sql.Int, intOrNull(v.anoModelo))
    .input("cor", sql.NVarChar(50), nz(v.cor))
    .input("combustivel", sql.NVarChar(50), nz(v.combustivel))
    .input("uf", sql.NVarChar(2), nz(v.uf))
    .input("municipio", sql.NVarChar(100), nz(v.municipio))
    .input("tipo_veiculo", sql.NVarChar(50), nz(v.tipoVeiculo))
    .input("motor", sql.NVarChar(50), nz(v.motor))
    .input("numero_caixa_cambio", sql.NVarChar(50), nz(v.numeroCaixaCambio))
    .input("numero_eixo_traseiro_diferencial", sql.NVarChar(50), nz(v.numeroEixoTraseiroDiferencial))
    .input("procedencia", sql.NVarChar(20), nz(v.procedencia))
    .input("situacao_chassi", sql.NVarChar(20), nz(v.situacaoChassi))
    .input("capacidade_de_carga", sql.NVarChar(20), nz(v.capacidadeDeCarga))
    .input("potencia", sql.NVarChar(20), nz(v.potencia))
    .input("numero_cilindradas", sql.NVarChar(20), nz(v.numeroCilindradas))
    .input("capacidade_de_passageiros", sql.NVarChar(10), nz(v.capacidadeDePassageiros))
    .input("tipo_montagem", sql.NVarChar(20), nz(v.tipoMontagem))
    .input("quantidade_de_eixos", sql.NVarChar(10), nz(v.quantidadeDeEixos))
    .input("carroceria", sql.NVarChar(50), nz(v.carroceria))
    .input("codigo_fipe", sql.NVarChar(20), nz(v.codigoFipe))
    .input("descricao_fipe", sql.NVarChar(300), nz(v.descricao))
    .input("valor_fipe", sql.Decimal(12, 2), parseValorFipe(v.valor ?? null))
    .query(`
      INSERT INTO carros_ativos (
        placa, owner_id, chassi, modelo, ano_fabricacao, ano_modelo, cor, combustivel,
        uf, municipio, tipo_veiculo, motor, numero_caixa_cambio,
        numero_eixo_traseiro_diferencial, procedencia, situacao_chassi,
        capacidade_de_carga, potencia, numero_cilindradas,
        capacidade_de_passageiros, tipo_montagem, quantidade_de_eixos,
        carroceria, codigo_fipe, descricao_fipe, valor_fipe
      )
      OUTPUT inserted.id
      VALUES (
        @placa, @owner, @chassi, @modelo, @ano_fabricacao, @ano_modelo, @cor, @combustivel,
        @uf, @municipio, @tipo_veiculo, @motor, @numero_caixa_cambio,
        @numero_eixo_traseiro_diferencial, @procedencia, @situacao_chassi,
        @capacidade_de_carga, @potencia, @numero_cilindradas,
        @capacidade_de_passageiros, @tipo_montagem, @quantidade_de_eixos,
        @carroceria, @codigo_fipe, @descricao_fipe, @valor_fipe
      );
    `);
  return { id: r.recordset[0].id as string };
}

/** Partial update by id. Only EDITABLE_COLS are accepted; everything else
 *  is silently dropped. Empty-string in patch means "set NULL". */
export async function updateById(id: string, patch: Partial<Record<EditableCol, string | number | null>>, ownerId: string): Promise<void> {
  const keys = Object.keys(patch).filter((k): k is EditableCol => (EDITABLE_COLS as readonly string[]).includes(k));
  if (keys.length === 0) return;

  const p = await getPool();
  const req = p.request().input("id", sql.UniqueIdentifier, id).input("owner", sql.UniqueIdentifier, ownerId);
  const sets: string[] = [];
  for (const k of keys) {
    const v = patch[k];
    if (k === "ano_fabricacao" || k === "ano_modelo") {
      req.input(k, sql.Int, intOrNull(v));
    } else if (k === "valor_fipe") {
      req.input(k, sql.Decimal(12, 2), typeof v === "number" ? v : parseValorFipe(v as string | null));
    } else {
      const str = (v === "" || v === null || v === undefined) ? null : String(v);
      req.input(k, sql.NVarChar(300), str);
    }
    sets.push(`${k} = @${k}`);
  }
  await req.query(`UPDATE carros_ativos SET ${sets.join(", ")} WHERE id = @id AND owner_id = @owner`);
}

export async function removeById(id: string, ownerId: string): Promise<void> {
  const p = await getPool();
  await p.request()
    .input("id", sql.UniqueIdentifier, id)
    .input("owner", sql.UniqueIdentifier, ownerId)
    .query("DELETE FROM carros_ativos WHERE id = @id AND owner_id = @owner");
}

/** Delete every vehicle owned by a user (account erasure, Art. 18 VI).
 *  Owner-scoped; returns the number of rows removed. */
export async function deleteAllByOwner(ownerId: string): Promise<number> {
  const p = await getPool();
  const r = await p.request()
    .input("owner", sql.UniqueIdentifier, ownerId)
    .query("DELETE FROM carros_ativos WHERE owner_id = @owner");
  return r.rowsAffected[0] ?? 0;
}

// Helpers
function nz(s: unknown): string | null {
  if (s === null || s === undefined) return null;
  const str = String(s);
  return str === "" ? null : str;
}
function intOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}
