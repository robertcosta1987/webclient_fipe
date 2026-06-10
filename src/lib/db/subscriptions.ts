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
// informational. Broken down API → subscription → user → product (a
// subscription can have more than one user).
export type ProductUsage = {
  code: number;
  name: string;
  liveQty: number;
  cachedQty: number;
  revenueBrl: number;   // live only
};
export type UserUsage = {
  userId: string | null;
  email: string;
  liveQty: number;
  cachedQty: number;
  revenueBrl: number;     // live only
  cachedValueBrl: number; // not charged
  firstAt: string | null;
  lastAt: string | null;
  products: ProductUsage[];
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
  users: UserUsage[];
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
  user_id: string | null;
  user_email: string | null;
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

type Totals = { liveQty: number; cachedQty: number; revenueBrl: number; cachedValueBrl: number };
function bump(t: Totals, isLive: boolean, qty: number, value: number): void {
  if (isLive) { t.liveQty += qty; t.revenueBrl += value; }
  else { t.cachedQty += qty; t.cachedValueBrl += value; }
}
function bumpProduct(list: ProductUsage[], code: number, name: string, isLive: boolean, qty: number, value: number): void {
  let p = list.find((x) => x.code === code);
  if (!p) { p = { code, name, liveQty: 0, cachedQty: 0, revenueBrl: 0 }; list.push(p); }
  if (isLive) { p.liveQty += qty; p.revenueBrl += value; } else { p.cachedQty += qty; }
}
function touch(t: { firstAt: string | null; lastAt: string | null }, row: Raw): void {
  const f = iso(row.first_at), l = iso(row.last_at);
  if (f && (!t.firstAt || f < t.firstAt)) t.firstAt = f;
  if (l && (!t.lastAt || l > t.lastAt)) t.lastAt = l;
}

/** Aggregate the usage ledger into APIs → subscriptions → users → products,
 *  split by live vs cache. Pass a subscriptionId to scope the report to a single
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
           u.user_id,
           u.user_email,
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
    GROUP BY u.api, u.subscription_id, s.name, s.sub_key, u.user_id, u.user_email, u.product_code, u.product_name, u.source
    ORDER BY u.api, s.name, u.user_email, u.product_code
  `);

  const apis = new Map<string, ApiUsage>();
  for (const row of r.recordset as Raw[]) {
    const value = Number(row.revenue ?? 0);
    const isLive = row.source === "live";
    const pname = row.product_name ?? `Consulta ${row.product_code}`;

    let api = apis.get(row.api);
    if (!api) {
      api = { api: row.api, liveQty: 0, cachedQty: 0, revenueBrl: 0, cachedValueBrl: 0, subscriptions: [] };
      apis.set(row.api, api);
    }
    bump(api, isLive, row.qty, value);

    const subKeyId = row.subscription_id ?? "__none__";
    let sub = api.subscriptions.find((s) => (s.subscriptionId ?? "__none__") === subKeyId);
    if (!sub) {
      sub = {
        subscriptionId: row.subscription_id,
        name: row.sub_name ?? "Sem assinatura",
        subKey: row.sub_key,
        liveQty: 0, cachedQty: 0, revenueBrl: 0, cachedValueBrl: 0,
        firstAt: null, lastAt: null, users: [], products: [],
      };
      api.subscriptions.push(sub);
    }
    bump(sub, isLive, row.qty, value);
    bumpProduct(sub.products, row.product_code, pname, isLive, row.qty, value);
    touch(sub, row);

    const email = row.user_email ?? "(desconhecido)";
    let user = sub.users.find((usr) => usr.userId === row.user_id && usr.email === email);
    if (!user) {
      user = { userId: row.user_id, email, liveQty: 0, cachedQty: 0, revenueBrl: 0, cachedValueBrl: 0, firstAt: null, lastAt: null, products: [] };
      sub.users.push(user);
    }
    bump(user, isLive, row.qty, value);
    bumpProduct(user.products, row.product_code, pname, isLive, row.qty, value);
    touch(user, row);
  }

  return [...apis.values()];
}
