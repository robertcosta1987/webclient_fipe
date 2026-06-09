// db/kbbConsultas.ts — repository for the kbb_consultas table.
//
// One row per Molicar consultation. Used as both a history feed (the
// /historico-kbb page) and a 90-day cache (the /precos server action
// short-circuits to the most recent row when it's still fresh).

import "server-only";
import sql from "mssql";
import { getPool } from "./pool";
import type { MolicarPayload } from "../pricing/types";

export type KbbConsultaRow = {
  id: string;
  placa: string;
  brand: string | null;
  model: string | null;
  version: string | null;
  model_year: number | null;
  fair_price_used_dealer: number | null;
  molicar_price: number | null;
  source_id: string;
  upstream_latency_ms: number | null;
  payload: string;
  consulted_at: string;
};

const SELECT_COLS = [
  "id", "placa", "brand", "model", "version", "model_year",
  "fair_price_used_dealer", "molicar_price",
  "source_id", "upstream_latency_ms", "payload", "consulted_at",
].join(", ");

export type CachedHit = {
  row: KbbConsultaRow;
  payload: MolicarPayload;
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
    FROM kbb_consultas
    WHERE placa = @placa
      ${ownerClause}
    ORDER BY consulted_at DESC
  `);
  const row = r.recordset[0] as KbbConsultaRow | undefined;
  if (!row) return null;
  return { row, payload: safeParse(row.payload) };
}

/** Get one row by id (history detail view) — scoped to the owner. */
export async function getById(id: string, ownerId: string): Promise<(KbbConsultaRow & { parsed: MolicarPayload }) | null> {
  const p = await getPool();
  const r = await p.request()
    .input("id", sql.UniqueIdentifier, id)
    .input("owner", sql.UniqueIdentifier, ownerId)
    .query(`SELECT TOP 1 ${SELECT_COLS} FROM kbb_consultas WHERE id = @id AND owner_id = @owner`);
  const row = r.recordset[0] as KbbConsultaRow | undefined;
  if (!row) return null;
  return { ...row, parsed: safeParse(row.payload) };
}

/** Most recent N consultations, newest first. `ownerId = null` (master) returns
 *  all owners' consultations. */
export async function listRecent(ownerId: string | null, limit = 100): Promise<KbbConsultaRow[]> {
  const p = await getPool();
  const req = p.request().input("lim", sql.Int, limit);
  let where = "";
  if (ownerId !== null) {
    req.input("owner", sql.UniqueIdentifier, ownerId);
    where = "WHERE owner_id = @owner";
  }
  const r = await req.query(`
    SELECT TOP (@lim) ${SELECT_COLS}
    FROM kbb_consultas
    ${where}
    ORDER BY consulted_at DESC
  `);
  return r.recordset as KbbConsultaRow[];
}

export type InsertInput = {
  placa: string;
  payload: MolicarPayload;
  sourceId: string;
  upstreamLatencyMs: number | null;
  ownerId: string;
};

export async function insert(input: InsertInput): Promise<{ id: string }> {
  const { placa, payload, sourceId, upstreamLatencyMs, ownerId } = input;
  const v = payload.VehicleData ?? {};
  const d = payload.Decoder ?? {};
  const k = payload.KBBPricing ?? {};
  const pr = payload.Pricing ?? {};

  const p = await getPool();
  const r = await p.request()
    .input("placa", sql.NVarChar(10), placa)
    .input("owner", sql.UniqueIdentifier, ownerId)
    .input("brand", sql.NVarChar(60), trunc(v.Brand, 60))
    .input("model", sql.NVarChar(120), trunc(v.Model, 120))
    .input("version", sql.NVarChar(240), trunc(v.Version, 240))
    .input("model_year", sql.SmallInt, smallIntOrNull(d.ModelYear ?? v.ManufacturedYear))
    .input("fair_price_used_dealer", sql.Decimal(12, 2), decimalOrNull(k.UsedDealer?.FairPrice))
    .input("molicar_price", sql.Decimal(12, 2), decimalOrNull(pr.MolicarPrice))
    .input("source_id", sql.NVarChar(40), sourceId.slice(0, 40))
    .input("upstream_latency_ms", sql.Int, intOrNull(upstreamLatencyMs))
    .input("payload", sql.NVarChar(sql.MAX), JSON.stringify(payload))
    .query(`
      INSERT INTO kbb_consultas (
        placa, owner_id, brand, model, version, model_year,
        fair_price_used_dealer, molicar_price,
        source_id, upstream_latency_ms, payload
      )
      OUTPUT inserted.id
      VALUES (
        @placa, @owner, @brand, @model, @version, @model_year,
        @fair_price_used_dealer, @molicar_price,
        @source_id, @upstream_latency_ms, @payload
      );
    `);
  return { id: r.recordset[0].id as string };
}

// Helpers
function safeParse(raw: string): MolicarPayload {
  try { return JSON.parse(raw) as MolicarPayload; } catch { return {} as MolicarPayload; }
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

function decimalOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}
