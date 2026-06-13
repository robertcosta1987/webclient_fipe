// lib/api/fipeConsult.ts — the metered FIPE/Decodificador (querycode 202) consult
// used by the public API route. Mirrors the metering of the session action
// (lib/db/subscriptions + checktudoConsultas) but is parameterized by an explicit
// user/subscription (no session): cache-aware, plan-enforced, ledger-recorded.

import "server-only";
import { normalizePlaca, isValidPlaca } from "@/lib/placa/normalize";
import * as ct from "@/lib/db/checktudoConsultas";
import * as subs from "@/lib/db/subscriptions";
import { fetchChecktudoByPlate } from "@/lib/checktudo/client";

export const FIPE_PRODUCT_CODE = 202;

export type FipePoint = { mes: number; ano: number; valor: number };
export type FipeData = {
  marca: string | null;
  modelo: string | null;
  anoModelo: string | null;
  anoFabricacao: string | null;
  chassi: string | null;
  numMotor: string | null;
  combustivel: string | null;
  codigoFipe: string | null;
  valorAtual: number | null;
  historico: FipePoint[];
};

export type FipeConsultResult =
  | { ok: true; placa: string; fromCache: boolean; consultaId: string | null; fipe: FipeData }
  | { ok: false; status: number; error: string };

export async function runFipeConsult(ctx: { userId: string; placa: string }): Promise<FipeConsultResult> {
  const placa = normalizePlaca(ctx.placa);
  if (!isValidPlaca(placa)) return { ok: false, status: 400, error: "Placa inválida. Use o formato ABC1234 ou ABC1D23." };
  const code = FIPE_PRODUCT_CODE;

  // 1. Per-tenant cache: this customer's own prior lookup of the plate is reused
  //    (counted for reporting, never charged). Other tenants' rows aren't shared.
  try {
    const hit = await ct.findFreshByPlaca(placa, code, ctx.userId);
    if (hit) {
      await subs.recordUsage({ api: "checktudo", userId: ctx.userId, productCode: code, consultaId: hit.row.id, placa, source: "cache" }).catch(() => {});
      return { ok: true, placa, fromCache: true, consultaId: hit.row.id, fipe: extractFipe(hit.data) };
    }
  } catch { /* cache failure must not block the live call */ }

  // 2. Enforce the subscription plan (reserve a credit/budget before the call).
  let reservation: { subscriptionId: string; planType: subs.PlanType | null; api: string; productCode: number; price: number | null } | null = null;
  const plan = await subs.getSubPlan(ctx.userId).catch(() => null);
  if (plan && plan.planType) {
    const price = await subs.getProductPrice("checktudo", code).catch(() => null);
    const res = await subs.reserveConsult({ subscriptionId: plan.subscriptionId, planType: plan.planType, api: "checktudo", productCode: code, price });
    if (!res.ok) return { ok: false, status: 402, error: res.error };
    reservation = { subscriptionId: plan.subscriptionId, planType: plan.planType, api: "checktudo", productCode: code, price };
  }

  // 3. Live vendor call.
  const result = await fetchChecktudoByPlate(placa, code);
  if (!result.ok) {
    if (reservation) await subs.refundConsult(reservation).catch(() => {});
    const status = result.error === "plate_not_found" ? 404 : result.status && result.status >= 500 ? 502 : 502;
    return { ok: false, status, error: result.message?.trim() || result.error || "A consulta não retornou resultado." };
  }

  // 4. Persist to cache + record the billable live usage.
  let consultaId: string | null = null;
  try {
    const ins = await ct.insert({
      placa, productCode: result.product.code, productName: result.product.name,
      data: result.data, queryId: result.queryId, upstreamLatencyMs: result.upstreamLatencyMs, ownerId: ctx.userId,
    });
    consultaId = ins.id;
  } catch { /* keep the result even if persistence fails */ }
  await subs.recordUsage({ api: "checktudo", userId: ctx.userId, productCode: code, consultaId, placa, source: "live" }).catch(() => {});

  return { ok: true, placa, fromCache: false, consultaId, fipe: extractFipe(result.data) };
}

// ── FIPE field extraction (tolerant of the nested 202 payload) ───────────────
function extractFipe(data: unknown): FipeData {
  return {
    marca: firstString(data, ["marca"]),
    modelo: firstString(data, ["modelo", "versao"]),
    anoModelo: firstString(data, ["anoModelo", "anomodelo"]),
    anoFabricacao: firstString(data, ["anoFabricacao", "anofabricacao"]),
    chassi: firstString(data, ["chassi", "chassis", "vin"]),
    numMotor: firstString(data, ["numMotor", "nummotor", "numeroMotor"]),
    combustivel: firstString(data, ["combustivel"]),
    codigoFipe: firstFipeCode(data),
    valorAtual: firstNumber(data, ["valorAtual", "valorfipe", "valorFipe", "valor"]),
    historico: extractHistory(data),
  };
}

function walk(node: unknown, visit: (key: string, value: unknown) => void, depth = 0): void {
  if (!node || typeof node !== "object" || depth > 7) return;
  if (Array.isArray(node)) { for (const el of node) walk(el, visit, depth + 1); return; }
  for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
    visit(k, v);
    if (v && typeof v === "object") walk(v, visit, depth + 1);
  }
}

function firstString(data: unknown, keys: string[]): string | null {
  const want = keys.map((k) => k.toLowerCase());
  let found: string | null = null;
  walk(data, (k, v) => {
    if (found) return;
    if (want.includes(k.toLowerCase()) && (typeof v === "string" || typeof v === "number") && String(v).trim() !== "") found = String(v).trim();
  });
  return found;
}

function firstNumber(data: unknown, keys: string[]): number | null {
  const want = keys.map((k) => k.toLowerCase());
  let found: number | null = null;
  walk(data, (k, v) => {
    if (found !== null) return;
    if (want.includes(k.toLowerCase())) { const n = toNumber(v); if (n !== null) found = n; }
  });
  return found;
}

/** codigoFipe may be a string, or an array of objects each carrying a code. */
function firstFipeCode(data: unknown): string | null {
  let found: string | null = null;
  walk(data, (k, v) => {
    if (found) return;
    if (k.toLowerCase() !== "codigofipe") return;
    if (typeof v === "string" || typeof v === "number") { if (String(v).trim()) found = String(v).trim(); return; }
    if (Array.isArray(v)) {
      for (const el of v) {
        if (typeof el === "string" || typeof el === "number") { if (String(el).trim()) { found = String(el).trim(); return; } }
        else if (el && typeof el === "object") {
          const o = el as Record<string, unknown>;
          const c = o.codigo ?? o.codigoFipe ?? o.fipeId ?? o.code;
          if (c !== undefined && String(c).trim()) { found = String(c).trim(); return; }
        }
      }
    }
  });
  return found;
}

function extractHistory(data: unknown): FipePoint[] {
  let arr: unknown[] | null = null;
  walk(data, (k, v) => {
    if (arr) return;
    if (k.toLowerCase() === "historicopreco" && Array.isArray(v) && v.length) arr = v;
  });
  if (!arr) return [];
  const pts: FipePoint[] = [];
  for (const e of arr as unknown[]) {
    if (!e || typeof e !== "object") continue;
    const o = e as Record<string, unknown>;
    if (o.predicao === true) continue;
    const mes = Number(o.mes), ano = Number(o.ano), valor = toNumber(o.valor);
    if (!Number.isFinite(mes) || !Number.isFinite(ano) || valor === null || valor <= 0) continue;
    pts.push({ mes, ano, valor });
  }
  pts.sort((a, b) => a.ano * 12 + a.mes - (b.ano * 12 + b.mes));
  return pts.slice(-12);
}

function toNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[R$\s]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}
