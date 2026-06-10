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

/** Record one billable consult. Snapshots the user's subscription, the product
 *  name and its unit price — all in a single INSERT…SELECT so usage, ownership
 *  and price are captured atomically at the moment of use. Returns the new row
 *  id, or null if nothing was recorded (e.g. unknown user). Best-effort: the
 *  caller wraps this so a metering failure never breaks the consult. */
export async function recordUsage(input: {
  api: string;
  userId: string;
  productCode: number;
  consultaId: string | null;
  placa: string | null;
}): Promise<{ id: string } | null> {
  const p = await getPool();
  const r = await p.request()
    .input("api", sql.NVarChar(40), input.api)
    .input("code", sql.SmallInt, input.productCode)
    .input("consulta", sql.UniqueIdentifier, input.consultaId)
    .input("placa", sql.NVarChar(10), input.placa)
    .input("userId", sql.UniqueIdentifier, input.userId)
    .query(`
      INSERT INTO api_usage
        (subscription_id, user_id, user_email, api, product_code, product_name, consulta_id, placa, unit_price_brl)
      OUTPUT inserted.id
      SELECT u.subscription_id, u.id, u.email, @api, @code, p.name, @consulta, @placa, p.unit_price_brl
      FROM users u
      LEFT JOIN api_products p ON p.api = @api AND p.code = @code
      WHERE u.id = @userId;
    `);
  const id = r.recordset[0]?.id as string | undefined;
  return id ? { id } : null;
}

// ── Report ──────────────────────────────────────────────────────────────────
export type ProductUsage = {
  code: number;
  name: string;
  qty: number;
  revenueBrl: number;
};
export type SubscriptionUsage = {
  subscriptionId: string | null;
  name: string;          // subscription name, or "Sem assinatura"
  subKey: string | null;
  qty: number;
  revenueBrl: number;
  firstAt: string | null;
  lastAt: string | null;
  products: ProductUsage[];
};
export type ApiUsage = {
  api: string;
  qty: number;
  revenueBrl: number;
  subscriptions: SubscriptionUsage[];
};

type Raw = {
  api: string;
  subscription_id: string | null;
  sub_name: string | null;
  sub_key: string | null;
  product_code: number;
  product_name: string | null;
  qty: number;
  revenue: number | null;
  first_at: string | Date | null;
  last_at: string | Date | null;
};

function iso(v: string | Date | null): string | null {
  if (!v) return null;
  return typeof v === "string" ? v : new Date(v).toISOString();
}

/** Aggregate the usage ledger into APIs → subscriptions → products. Pass a
 *  subscriptionId to scope the report to a single customer (for the future
 *  per-customer view); omit it for the admin's full report. */
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
           COUNT(*) AS qty,
           SUM(u.unit_price_brl) AS revenue,
           MIN(u.counted_at) AS first_at,
           MAX(u.counted_at) AS last_at
    FROM api_usage u
    LEFT JOIN subscriptions s ON s.id = u.subscription_id
    ${scope}
    GROUP BY u.api, u.subscription_id, s.name, s.sub_key, u.product_code, u.product_name
    ORDER BY u.api, s.name, u.product_code
  `);

  const apis = new Map<string, ApiUsage>();
  for (const row of r.recordset as Raw[]) {
    const revenue = Number(row.revenue ?? 0);
    let api = apis.get(row.api);
    if (!api) {
      api = { api: row.api, qty: 0, revenueBrl: 0, subscriptions: [] };
      apis.set(row.api, api);
    }
    api.qty += row.qty;
    api.revenueBrl += revenue;

    const subKeyId = row.subscription_id ?? "__none__";
    let sub = api.subscriptions.find((s) => (s.subscriptionId ?? "__none__") === subKeyId);
    if (!sub) {
      sub = {
        subscriptionId: row.subscription_id,
        name: row.sub_name ?? "Sem assinatura",
        subKey: row.sub_key,
        qty: 0,
        revenueBrl: 0,
        firstAt: null,
        lastAt: null,
        products: [],
      };
      api.subscriptions.push(sub);
    }
    sub.qty += row.qty;
    sub.revenueBrl += revenue;
    const f = iso(row.first_at), l = iso(row.last_at);
    if (f && (!sub.firstAt || f < sub.firstAt)) sub.firstAt = f;
    if (l && (!sub.lastAt || l > sub.lastAt)) sub.lastAt = l;
    sub.products.push({
      code: row.product_code,
      name: row.product_name ?? `Consulta ${row.product_code}`,
      qty: row.qty,
      revenueBrl: revenue,
    });
  }

  return [...apis.values()];
}
