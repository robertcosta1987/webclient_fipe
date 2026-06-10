// db/subscriptions.ts — customer subscriptions, API products, and the usage
// ledger (api_usage). Recording is intentionally narrow: only a successful LIVE
// consult records usage (the caller must not call this for cache hits).

import "server-only";
import sql from "mssql";
import { getPool } from "./pool";

export type SubscriptionRow = {
  id: string;
  name: string;
  sub_key: string;
  status: string;
  created_at: string;
};

/** Record one consult. `source` is 'live' (a real API call — billable) or
 *  'cache' (served from the SQL cache — recorded for reporting, NOT charged).
 *  Snapshots the user's subscription, the product name and its unit price — all
 *  in a single INSERT…SELECT so usage, ownership and price are captured
 *  atomically. Returns the new row id, or null if nothing was recorded (e.g.
 *  unknown user). Best-effort: the caller wraps this so a metering failure
 *  never breaks the consult. */
export async function recordUsage(input: {
  api: string;
  userId: string;
  productCode: number;
  consultaId: string | null;
  placa: string | null;
  source: "live" | "cache";
}): Promise<{ id: string } | null> {
  const p = await getPool();
  const r = await p.request()
    .input("api", sql.NVarChar(40), input.api)
    .input("code", sql.SmallInt, input.productCode)
    .input("consulta", sql.UniqueIdentifier, input.consultaId)
    .input("placa", sql.NVarChar(10), input.placa)
    .input("userId", sql.UniqueIdentifier, input.userId)
    .input("source", sql.NVarChar(10), input.source)
    .query(`
      INSERT INTO api_usage
        (subscription_id, user_id, user_email, api, product_code, product_name, consulta_id, placa, unit_price_brl, source)
      OUTPUT inserted.id
      SELECT u.subscription_id, u.id, u.email, @api, @code, p.name, @consulta, @placa, p.unit_price_brl, @source
      FROM users u
      LEFT JOIN api_products p ON p.api = @api AND p.code = @code
      WHERE u.id = @userId;
    `);
  const id = r.recordset[0]?.id as string | undefined;
  return id ? { id } : null;
}

// ── Report ──────────────────────────────────────────────────────────────────
// Usage is split into LIVE (billable — real API calls) and CACHE (served from
// the SQL cache — counted for visibility, never charged). `revenueBrl` is the
// amount to charge and comes from live consults only; cached counts/value are
// informational.
export type ProductUsage = {
  code: number;
  name: string;
  liveQty: number;
  cachedQty: number;
  revenueBrl: number;   // live only
};
export type SubscriptionUsage = {
  subscriptionId: string | null;
  name: string;          // subscription name, or "Sem assinatura"
  subKey: string | null;
  liveQty: number;
  cachedQty: number;
  revenueBrl: number;    // live only — the amount to charge
  cachedValueBrl: number; // what cache hits would have cost — NOT charged
  firstAt: string | null;
  lastAt: string | null;
  products: ProductUsage[];
};
export type ApiUsage = {
  api: string;
  liveQty: number;
  cachedQty: number;
  revenueBrl: number;     // live only
  cachedValueBrl: number; // not charged
  subscriptions: SubscriptionUsage[];
};

type Raw = {
  api: string;
  subscription_id: string | null;
  sub_name: string | null;
  sub_key: string | null;
  product_code: number;
  product_name: string | null;
  source: string;
  qty: number;
  revenue: number | null;
  first_at: string | Date | null;
  last_at: string | Date | null;
};

function iso(v: string | Date | null): string | null {
  if (!v) return null;
  return typeof v === "string" ? v : new Date(v).toISOString();
}

/** Aggregate the usage ledger into APIs → subscriptions → products, split by
 *  live vs cache. Pass a subscriptionId to scope the report to a single
 *  customer (for the future per-customer view); omit it for the admin's full
 *  report. */
export async function usageReport(opts: { subscriptionId?: string } = {}): Promise<ApiUsage[]> {
  const p = await getPool();
  const req = p.request();
  let scope = "";
  if (opts.subscriptionId) {
    req.input("sub", sql.UniqueIdentifier, opts.subscriptionId);
    scope = "WHERE u.subscription_id = @sub";
  }
  const r = await req.query(`
    SELECT u.api,
           u.subscription_id,
           s.name AS sub_name,
           s.sub_key,
           u.product_code,
           u.product_name,
           u.source,
           COUNT(*) AS qty,
           SUM(u.unit_price_brl) AS revenue,
           MIN(u.counted_at) AS first_at,
           MAX(u.counted_at) AS last_at
    FROM api_usage u
    LEFT JOIN subscriptions s ON s.id = u.subscription_id
    ${scope}
    GROUP BY u.api, u.subscription_id, s.name, s.sub_key, u.product_code, u.product_name, u.source
    ORDER BY u.api, s.name, u.product_code
  `);

  const apis = new Map<string, ApiUsage>();
  for (const row of r.recordset as Raw[]) {
    const value = Number(row.revenue ?? 0);
    const isLive = row.source === "live";

    let api = apis.get(row.api);
    if (!api) {
      api = { api: row.api, liveQty: 0, cachedQty: 0, revenueBrl: 0, cachedValueBrl: 0, subscriptions: [] };
      apis.set(row.api, api);
    }

    const subKeyId = row.subscription_id ?? "__none__";
    let sub = api.subscriptions.find((s) => (s.subscriptionId ?? "__none__") === subKeyId);
    if (!sub) {
      sub = {
        subscriptionId: row.subscription_id,
        name: row.sub_name ?? "Sem assinatura",
        subKey: row.sub_key,
        liveQty: 0,
        cachedQty: 0,
        revenueBrl: 0,
        cachedValueBrl: 0,
        firstAt: null,
        lastAt: null,
        products: [],
      };
      api.subscriptions.push(sub);
    }

    let prod = sub.products.find((p2) => p2.code === row.product_code);
    if (!prod) {
      prod = { code: row.product_code, name: row.product_name ?? `Consulta ${row.product_code}`, liveQty: 0, cachedQty: 0, revenueBrl: 0 };
      sub.products.push(prod);
    }

    if (isLive) {
      api.liveQty += row.qty; api.revenueBrl += value;
      sub.liveQty += row.qty; sub.revenueBrl += value;
      prod.liveQty += row.qty; prod.revenueBrl += value;
    } else {
      api.cachedQty += row.qty; api.cachedValueBrl += value;
      sub.cachedQty += row.qty; sub.cachedValueBrl += value;
      prod.cachedQty += row.qty;
    }

    const f = iso(row.first_at), l = iso(row.last_at);
    if (f && (!sub.firstAt || f < sub.firstAt)) sub.firstAt = f;
    if (l && (!sub.lastAt || l > sub.lastAt)) sub.lastAt = l;
  }

  return [...apis.values()];
}
