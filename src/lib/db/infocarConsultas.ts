// db/infocarConsultas.ts — repository for the infocar_consultas table.
//
// One row per Infocar (FIPE) consultation. Used as both a history feed (the
// /infocar page) and an indefinite cache (the lookupPlacaInfocar action
// short-circuits to the most recent row for a placa).

import "server-only";
import sql from "mssql";
import { getPool } from "./pool";
import { safeColumns } from "./identifiers";
import { scrubPayloadJson } from "@/lib/lgpd/scrubPii";
import type { VehiclePayload, FipeOption } from "../platform/types";
import { parseValorFipe } from "../platform/types";

/** What we persist in the `payload` JSON column — everything the report
 *  renderer and the "Ler JSON" expander need to rebuild the page. */
export type InfocarStored = {
  payload: VehiclePayload;
  fipeOptions: FipeOption[];
  raw: unknown;
};

export type InfocarConsultaRow = {
  id: string;
  placa: string;
  marca: string | null;
  modelo: string | null;
  ano_modelo: number | null;
  codigo_fipe: string | null;
  valor_fipe: number | null;
  source_id: string;
  upstream_latency_ms: number | null;
  payload: string;
  consulted_at: string;
};

const SELECT_COLS = safeColumns([
  "id", "placa", "marca", "modelo", "ano_modelo",
  "codigo_fipe", "valor_fipe",
  "source_id", "upstream_latency_ms", "payload", "consulted_at",
]);

export type CachedHit = {
  row: InfocarConsultaRow;
  stored: InfocarStored;
};

/** Latest consultation for `placa`. Cache is kept indefinitely. `ownerId = null`
 *  (master) reuses ANY owner's row, including legacy NULL-owner rows. */
export async function findFreshByPlaca(placa: string, ownerId: string | null): Promise<CachedHit | null> {
  const p = await getPool();
  const req = p.request().input("placa", sql.NVarChar(10), placa);
  let ownerClause = "";
  if (ownerId !== null) {
    req.input("owner", sql.UniqueIdentifier, ownerId);
    ownerClause = "AND owner_id = @owner";
  }
  const r = await req.query(`
    SELECT TOP 1 ${SELECT_COLS}
    FROM infocar_consultas
    WHERE placa = @placa
      ${ownerClause}
    ORDER BY consulted_at DESC
  `);
  const row = r.recordset[0] as InfocarConsultaRow | undefined;
  if (!row) return null;
  return { row, stored: safeParse(row.payload) };
}

/** Get one row by id (history detail view) — scoped to the owner. */
export async function getById(id: string, ownerId: string): Promise<(InfocarConsultaRow & { parsed: InfocarStored }) | null> {
  const p = await getPool();
  const r = await p.request()
    .input("id", sql.UniqueIdentifier, id)
    .input("owner", sql.UniqueIdentifier, ownerId)
    .query(`SELECT TOP 1 ${SELECT_COLS} FROM infocar_consultas WHERE id = @id AND owner_id = @owner`);
  const row = r.recordset[0] as InfocarConsultaRow | undefined;
  if (!row) return null;
  return { ...row, parsed: safeParse(row.payload) };
}

/** Most recent N consultations, newest first. `ownerId = null` (master) returns
 *  all owners' consultations. */
export async function listRecent(ownerId: string | null, limit = 100): Promise<InfocarConsultaRow[]> {
  const p = await getPool();
  const req = p.request().input("lim", sql.Int, limit);
  let where = "";
  if (ownerId !== null) {
    req.input("owner", sql.UniqueIdentifier, ownerId);
    where = "WHERE owner_id = @owner";
  }
  const r = await req.query(`
    SELECT TOP (@lim) ${SELECT_COLS}
    FROM infocar_consultas
    ${where}
    ORDER BY consulted_at DESC
  `);
  return r.recordset as InfocarConsultaRow[];
}

export type InsertInput = {
  placa: string;
  payload: VehiclePayload;
  fipeOptions: FipeOption[];
  raw: unknown;
  sourceId: string;
  upstreamLatencyMs: number | null;
  ownerId: string;
};

export async function insert(input: InsertInput): Promise<{ id: string }> {
  const { placa, payload, fipeOptions, raw, sourceId, upstreamLatencyMs, ownerId } = input;
  const stored: InfocarStored = { payload, fipeOptions, raw };

  const p = await getPool();
  const r = await p.request()
    .input("placa", sql.NVarChar(10), placa)
    .input("owner", sql.UniqueIdentifier, ownerId)
    // Infocar's flattened payload has no separate make field — keep marca null.
    .input("marca", sql.NVarChar(60), null)
    .input("modelo", sql.NVarChar(200), trunc(payload.modelo, 200))
    .input("ano_modelo", sql.SmallInt, smallIntOrNull(payload.anoModelo ?? payload.anoFabricacao))
    .input("codigo_fipe", sql.NVarChar(20), trunc(payload.codigoFipe, 20))
    .input("valor_fipe", sql.Decimal(12, 2), parseValorFipe(payload.valor))
    .input("source_id", sql.NVarChar(40), sourceId.slice(0, 40))
    .input("upstream_latency_ms", sql.Int, intOrNull(upstreamLatencyMs))
    .input("payload", sql.NVarChar(sql.MAX), JSON.stringify(stored))
    .query(`
      INSERT INTO infocar_consultas (
        placa, owner_id, marca, modelo, ano_modelo,
        codigo_fipe, valor_fipe,
        source_id, upstream_latency_ms, payload
      )
      OUTPUT inserted.id
      VALUES (
        @placa, @owner, @marca, @modelo, @ano_modelo,
        @codigo_fipe, @valor_fipe,
        @source_id, @upstream_latency_ms, @payload
      );
    `);
  return { id: r.recordset[0].id as string };
}

/** Delete every Infocar consultation owned by a user (account erasure,
 *  Art. 18 VI). Owner-scoped; returns the number of rows removed. */
/** Account erasure (Art. 18 VI): NEVER deletes the cached consult (MOAT). De-
 *  identifies — owner_id → NULL + scrub owner PII from payload. Owner-scoped. */
export async function deidentifyAllByOwner(ownerId: string): Promise<number> {
  const p = await getPool();
  const rows = (await p.request()
    .input("owner", sql.UniqueIdentifier, ownerId)
    .query(`SELECT CAST(id AS NVARCHAR(40)) AS id, payload FROM infocar_consultas WHERE owner_id = @owner`)
  ).recordset as { id: string; payload: string }[];
  for (const row of rows) {
    await p.request()
      .input("id", sql.UniqueIdentifier, row.id)
      .input("payload", sql.NVarChar(sql.MAX), scrubPayloadJson(row.payload))
      .query(`UPDATE infocar_consultas SET owner_id = NULL, payload = @payload WHERE id = @id`);
  }
  return rows.length;
}

// Helpers
function safeParse(raw: string): InfocarStored {
  try {
    const o = JSON.parse(raw) as Partial<InfocarStored>;
    return {
      payload: (o.payload ?? {}) as VehiclePayload,
      fipeOptions: o.fipeOptions ?? [],
      raw: o.raw ?? o.payload ?? {},
    };
  } catch {
    return { payload: {} as VehiclePayload, fipeOptions: [], raw: {} };
  }
}

function trunc(s: unknown, max: number): string | null {
  if (s === null || s === undefined) return null;
  const str = String(s);
  return str === "" ? null : str.slice(0, max);
}

function intOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function smallIntOrNull(v: unknown): number | null {
  const n = intOrNull(v);
  if (n === null) return null;
  if (n < -32768 || n > 32767) return null;
  return n;
}
