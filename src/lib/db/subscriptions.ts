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

// 'consultas' = pooled query-count cap; 'cash' = prepaid R$ budget;
// 'ondemand' = open-ended (billed end of cycle) with an OPTIONAL R$ cap.
export type PlanType = "consultas" | "cash" | "ondemand";

// ── Provisioning ──────────────────────────────────────────────────────────────
export async function createSubscription(input: {
  name: string;
  subKey: string;
  planType: PlanType;
  queryLimit: number | null;     // consultas
  spendLimitBrl: number | null;  // cash (mandatory) / ondemand (optional)
}): Promise<{ id: string }> {
  const p = await getPool();
  const r = await p.request()
    .input("n", sql.NVarChar(120), input.name)
    .input("k", sql.NVarChar(60), input.subKey)
    .input("pt", sql.NVarChar(20), input.planType)
    .input("ql", sql.Int, input.queryLimit)
    .input("lim", sql.Decimal(12, 2), input.spendLimitBrl)
    .query(`
      INSERT INTO subscriptions (name, sub_key, status, plan_type, query_limit, spend_limit_brl)
      OUTPUT inserted.id
      VALUES (@n, @k, 'active', @pt, @ql, @lim);
    `);
  return { id: r.recordset[0].id as string };
}

/** Contract a product on a subscription. `granted` = consult credits for the
 *  'consultas' model, or null = "allowed" (cash model). */
export async function addQuota(input: {
  subscriptionId: string;
  api: string;
  productCode: number;
  granted: number | null;
}): Promise<void> {
  const p = await getPool();
  await p.request()
    .input("s", sql.UniqueIdentifier, input.subscriptionId)
    .input("a", sql.NVarChar(40), input.api)
    .input("c", sql.SmallInt, input.productCode)
    .input("g", sql.Int, input.granted)
    .query(`
      IF NOT EXISTS (SELECT 1 FROM subscription_quotas WHERE subscription_id=@s AND api=@a AND product_code=@c)
        INSERT INTO subscription_quotas (subscription_id, api, product_code, granted) VALUES (@s, @a, @c, @g);
      ELSE
        UPDATE subscription_quotas SET granted = @g WHERE subscription_id=@s AND api=@a AND product_code=@c;
    `);
}

// ── Enforcement (consumption limits) ──────────────────────────────────────────
export type SubPlan = { subscriptionId: string; planType: PlanType | null; spendLimitBrl: number | null };

/** The acting user's subscription + plan, or null if they have no subscription. */
export async function getSubPlan(userId: string): Promise<SubPlan | null> {
  const p = await getPool();
  const r = await p.request().input("uid", sql.UniqueIdentifier, userId).query(`
    SELECT TOP 1 CAST(s.id AS NVARCHAR(40)) AS id, s.plan_type, s.spend_limit_brl
    FROM users u JOIN subscriptions s ON s.id = u.subscription_id
    WHERE u.id = @uid
  `);
  const row = r.recordset[0];
  if (!row) return null;
  return {
    subscriptionId: row.id as string,
    planType: (row.plan_type as PlanType | null) ?? null,
    spendLimitBrl: row.spend_limit_brl === null || row.spend_limit_brl === undefined ? null : Number(row.spend_limit_brl),
  };
}

/** Ensure a product exists in the metering catalog (insert if missing; update
 *  the price/name if a price is given). Used when issuing API access. */
export async function ensureApiProduct(api: string, code: number, name: string, priceBrl?: number | null): Promise<void> {
  const p = await getPool();
  await p.request()
    .input("a", sql.NVarChar(40), api)
    .input("c", sql.SmallInt, code)
    .input("n", sql.NVarChar(120), name)
    .input("price", sql.Decimal(12, 2), priceBrl ?? null)
    .query(`
      MERGE api_products AS t
      USING (SELECT @a AS api, @c AS code) AS s ON (t.api = s.api AND t.code = s.code)
      WHEN NOT MATCHED THEN INSERT (api, code, name, unit_price_brl) VALUES (@a, @c, @n, COALESCE(@price, 0))
      WHEN MATCHED AND @price IS NOT NULL THEN UPDATE SET unit_price_brl = @price;
    `);
}

export async function getProductPrice(api: string, code: number): Promise<number | null> {
  const p = await getPool();
  const r = await p.request().input("a", sql.NVarChar(40), api).input("c", sql.SmallInt, code)
    .query(`SELECT TOP 1 unit_price_brl FROM api_products WHERE api=@a AND code=@c`);
  const v = r.recordset[0]?.unit_price_brl;
  return v === null || v === undefined ? null : Number(v);
}

/** Atomically reserve one live consult against the subscription's plan. Returns
 *  ok:false (with a friendly reason) when a limit would be exceeded or the
 *  product isn't contracted. Caller refunds via refundConsult if the live call
 *  then fails. No-op (ok:true) when planType is null (unlimited). */
export async function reserveConsult(input: {
  subscriptionId: string;
  planType: PlanType | null;
  api: string;
  productCode: number;
  price: number | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!input.planType) return { ok: true };
  const p = await getPool();

  // Product must be contracted (in the allowed set) for every plan.
  const ex = await p.request()
    .input("s", sql.UniqueIdentifier, input.subscriptionId)
    .input("a", sql.NVarChar(40), input.api)
    .input("c", sql.SmallInt, input.productCode)
    .query(`SELECT TOP 1 1 AS ok FROM subscription_quotas WHERE subscription_id=@s AND api=@a AND product_code=@c`);
  if (ex.recordset.length === 0) return { ok: false, error: "Produto não contratado nesta assinatura." };

  if (input.planType === "consultas") {
    // Pooled hard cap on total queries.
    const r = await p.request()
      .input("s", sql.UniqueIdentifier, input.subscriptionId)
      .query(`UPDATE subscriptions SET query_used = query_used + 1
              WHERE id=@s AND query_limit IS NOT NULL AND query_used < query_limit;`);
    if ((r.rowsAffected[0] ?? 0) === 1) return { ok: true };
    return { ok: false, error: "Limite de consultas da assinatura atingido." };
  }

  // cash (mandatory cap) / ondemand (optional cap — NULL = no cap, never blocks).
  const price = input.price ?? 0;
  const r = await p.request()
    .input("s", sql.UniqueIdentifier, input.subscriptionId)
    .input("price", sql.Decimal(12, 2), price)
    .query(`UPDATE subscriptions SET spent_brl = spent_brl + @price
            WHERE id=@s AND (spend_limit_brl IS NULL OR spent_brl + @price <= spend_limit_brl);`);
  if ((r.rowsAffected[0] ?? 0) === 1) return { ok: true };
  return { ok: false, error: "Limite de gasto da assinatura atingido para esta consulta." };
}

/** Reverse a reservation when the live call fails (so a failed call costs nothing). */
export async function refundConsult(input: {
  subscriptionId: string;
  planType: PlanType | null;
  api: string;
  productCode: number;
  price: number | null;
}): Promise<void> {
  if (!input.planType) return;
  const p = await getPool();
  if (input.planType === "consultas") {
    await p.request()
      .input("s", sql.UniqueIdentifier, input.subscriptionId)
      .query(`UPDATE subscriptions SET query_used = query_used - 1 WHERE id=@s AND query_used > 0;`);
  } else {
    await p.request()
      .input("s", sql.UniqueIdentifier, input.subscriptionId)
      .input("price", sql.Decimal(12, 2), input.price ?? 0)
      .query(`UPDATE subscriptions SET spent_brl = spent_brl - @price WHERE id=@s AND spent_brl >= @price;`);
  }
}

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
