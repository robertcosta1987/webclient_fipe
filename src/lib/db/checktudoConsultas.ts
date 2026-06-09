// db/checktudoConsultas.ts — repository for the checktudo_consultas table.
//
// One row per CheckTudo consultation for a (placa, product_code) pair. Used as
// both a history feed (inline on the /checktudo page) and a 90-day cache (the
// checktudo server action short-circuits to the most recent fresh row).
//
// CheckTudo's `data` shape varies per product, so summary columns (brand,
// model, year, chassi) are pulled with a small key-search helper; the full
// `data` object is stored verbatim in `payload`.

import "server-only";
import sql from "mssql";
import { getPool } from "./pool";
import type { ChecktudoData } from "../checktudo/types";

export type ChecktudoConsultaRow = {
  id: string;
  placa: string;
  product_code: number;
  product_name: string | null;
  brand: string | null;
  model: string | null;
  model_year: number | null;
  chassi: string | null;
  query_id: string | null;
  upstream_latency_ms: number | null;
  payload: string;
  consulted_at: string;
  recall_afetado: string | null;
  recall_motivo: string | null;
};

const SELECT_COLS = [
  "id", "placa", "product_code", "product_name", "brand", "model",
  "model_year", "chassi", "query_id", "upstream_latency_ms", "payload", "consulted_at",
  "recall_afetado", "recall_motivo",
].join(", ");

export type CachedHit = {
  row: ChecktudoConsultaRow;
  data: ChecktudoData;
};

/** Latest consultation for (placa, productCode, owner). Cache is kept
 *  indefinitely — the most recent row is always reused (cleared manually). */
export async function findFreshByPlaca(placa: string, productCode: number, ownerId: string): Promise<CachedHit | null> {
  const p = await getPool();
  const r = await p.request()
    .input("placa", sql.NVarChar(10), placa)
    .input("product", sql.SmallInt, productCode)
    .input("owner", sql.UniqueIdentifier, ownerId)
    .query(`
      SELECT TOP 1 ${SELECT_COLS}
      FROM checktudo_consultas
      WHERE placa = @placa
        AND product_code = @product
        AND owner_id = @owner
      ORDER BY consulted_at DESC
    `);
  const row = r.recordset[0] as ChecktudoConsultaRow | undefined;
  if (!row) return null;
  return { row, data: safeParse(row.payload) };
}

/** Get one row by id (history detail view) — scoped to the owner. */
export async function getById(id: string, ownerId: string): Promise<(ChecktudoConsultaRow & { parsed: ChecktudoData }) | null> {
  const p = await getPool();
  const r = await p.request()
    .input("id", sql.UniqueIdentifier, id)
    .input("owner", sql.UniqueIdentifier, ownerId)
    .query(`SELECT TOP 1 ${SELECT_COLS} FROM checktudo_consultas WHERE id = @id AND owner_id = @owner`);
  const row = r.recordset[0] as ChecktudoConsultaRow | undefined;
  if (!row) return null;
  return { ...row, parsed: safeParse(row.payload) };
}

/** Most recent N consultations, newest first. `ownerId = null` (master) returns
 *  all owners' consultations. */
export async function listRecent(ownerId: string | null, limit = 100): Promise<ChecktudoConsultaRow[]> {
  const p = await getPool();
  const req = p.request().input("lim", sql.Int, limit);
  let where = "";
  if (ownerId !== null) {
    req.input("owner", sql.UniqueIdentifier, ownerId);
    where = "WHERE owner_id = @owner";
  }
  const r = await req.query(`
    SELECT TOP (@lim) ${SELECT_COLS}
    FROM checktudo_consultas
    ${where}
    ORDER BY consulted_at DESC
  `);
  return r.recordset as ChecktudoConsultaRow[];
}

export type InsertInput = {
  placa: string;
  productCode: number;
  productName: string | null;
  data: ChecktudoData;
  queryId: string | null;
  upstreamLatencyMs: number | null;
  ownerId: string;
  recallAfetado?: string | null;
  recallMotivo?: string | null;
};

export async function insert(input: InsertInput): Promise<{ id: string }> {
  const { placa, productCode, productName, data, queryId, upstreamLatencyMs, ownerId } = input;
  const s = summarize(data);

  const p = await getPool();
  const r = await p.request()
    .input("placa", sql.NVarChar(10), placa)
    .input("owner", sql.UniqueIdentifier, ownerId)
    .input("product_code", sql.SmallInt, productCode)
    .input("product_name", sql.NVarChar(60), trunc(productName, 60))
    .input("brand", sql.NVarChar(60), trunc(s.brand, 60))
    .input("model", sql.NVarChar(120), trunc(s.model, 120))
    .input("model_year", sql.SmallInt, smallIntOrNull(s.modelYear))
    .input("chassi", sql.NVarChar(30), trunc(s.chassi, 30))
    .input("query_id", sql.NVarChar(60), trunc(queryId, 60))
    .input("upstream_latency_ms", sql.Int, intOrNull(upstreamLatencyMs))
    .input("payload", sql.NVarChar(sql.MAX), JSON.stringify(data))
    .input("recall_afetado", sql.NVarChar(20), trunc(input.recallAfetado, 20))
    .input("recall_motivo", sql.NVarChar(400), trunc(input.recallMotivo, 400))
    .query(`
      INSERT INTO checktudo_consultas (
        placa, owner_id, product_code, product_name, brand, model, model_year, chassi,
        query_id, upstream_latency_ms, payload, recall_afetado, recall_motivo
      )
      OUTPUT inserted.id
      VALUES (
        @placa, @owner, @product_code, @product_name, @brand, @model, @model_year, @chassi,
        @query_id, @upstream_latency_ms, @payload, @recall_afetado, @recall_motivo
      );
    `);
  return { id: r.recordset[0].id as string };
}

/** Persist a computed recall verdict onto an existing consult (backfill/lazy). */
export async function setRecallVerdict(id: string, afetado: string | null, motivo: string | null): Promise<void> {
  const p = await getPool();
  await p.request()
    .input("id", sql.UniqueIdentifier, id)
    .input("a", sql.NVarChar(20), trunc(afetado, 20))
    .input("m", sql.NVarChar(400), trunc(motivo, 400))
    .query(`UPDATE checktudo_consultas SET recall_afetado = @a, recall_motivo = @m WHERE id = @id`);
}

// ── Summary extraction ──────────────────────────────────────────────────────
// CheckTudo products nest their fields differently. Search (breadth-first) for
// the first non-empty primitive under any of the candidate key names.

type Summary = { brand: string | null; model: string | null; modelYear: unknown; chassi: string | null };

function summarize(data: ChecktudoData): Summary {
  const marca = firstString(data, ["marca", "Marca"]);
  const marcaModelo = firstString(data, ["marcaModelo", "MarcaModelo"]);
  // Some products return `marca`/`modelo` separately; others only `marcaModelo`
  // (e.g. "JEEP/JEEP/RENEGADE …"). Fall back to splitting it.
  return {
    brand: marca || (marcaModelo ? marcaModelo.split("/")[0].trim() : null),
    model: firstString(data, ["modelo", "Modelo"]) || marcaModelo,
    modelYear: firstValue(data, ["anoModelo", "AnoModelo", "anoFabricacao", "AnoFabricacao"]),
    chassi: firstString(data, ["chassi", "Chassi"]),
  };
}

function firstValue(root: unknown, keys: string[]): unknown {
  const wanted = new Set(keys.map((k) => k.toLowerCase()));
  const queue: unknown[] = [root];
  let guard = 0;
  while (queue.length && guard++ < 5000) {
    const node = queue.shift();
    if (node === null || typeof node !== "object") continue;
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (wanted.has(k.toLowerCase()) && isNonEmptyPrimitive(v)) return v;
    }
    for (const v of Object.values(node as Record<string, unknown>)) {
      if (v && typeof v === "object") queue.push(v);
    }
  }
  return null;
}

function firstString(root: unknown, keys: string[]): string | null {
  const v = firstValue(root, keys);
  return v === null || v === undefined ? null : String(v);
}

function isNonEmptyPrimitive(v: unknown): boolean {
  return (typeof v === "string" && v.trim() !== "") || typeof v === "number" || typeof v === "boolean";
}

// ── Helpers (shared shape with kbbConsultas.ts) ─────────────────────────────
function safeParse(raw: string): ChecktudoData {
  try { return JSON.parse(raw) as ChecktudoData; } catch { return {} as ChecktudoData; }
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
