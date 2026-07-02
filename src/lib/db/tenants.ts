// db/tenants.ts — admin read/write over "tenants" (a subscription + its customer + login user
// + contracted products). Powers /admin/tenants. Admin/master only (enforced in the actions).

import "server-only";
import sql from "mssql";
import { getPool } from "./pool";
import type { PlanType } from "./subscriptions";

export type TenantRow = {
  id: string; // subscription id
  name: string;
  planType: PlanType | null;
  queryLimit: number | null;
  spendLimitBrl: number | null;
  apiAccess: boolean;
  status: string;
  createdAt: string;
  userId: string | null;
  email: string | null;
  apiKeyPrefix: string | null;
  company: string | null;
  cnpj: string | null;
  productCodes: string; // CSV of contracted product codes
};

export async function listTenants(): Promise<TenantRow[]> {
  const p = await getPool();
  const r = await p.request().query(`
    SELECT
      CAST(s.id AS NVARCHAR(40)) AS id, s.name, s.plan_type, s.query_limit, s.spend_limit_brl,
      COALESCE(s.api_access, 0) AS api_access, s.status, s.created_at,
      CAST(u.id AS NVARCHAR(40)) AS user_id, u.email, u.api_key_prefix,
      c.company, c.cnpj,
      (SELECT STRING_AGG(CAST(q.product_code AS NVARCHAR(10)), ',')
         FROM subscription_quotas q WHERE q.subscription_id = s.id) AS product_codes
    FROM subscriptions s
    LEFT JOIN users u ON u.subscription_id = s.id
    LEFT JOIN customers c ON c.subscription_id = s.id
    ORDER BY s.created_at DESC;
  `);
  return r.recordset.map((row): TenantRow => ({
    id: row.id,
    name: row.name,
    planType: (row.plan_type as PlanType | null) ?? null,
    queryLimit: row.query_limit ?? null,
    spendLimitBrl: row.spend_limit_brl === null || row.spend_limit_brl === undefined ? null : Number(row.spend_limit_brl),
    apiAccess: Boolean(row.api_access),
    status: row.status ?? "active",
    createdAt: row.created_at,
    userId: row.user_id ?? null,
    email: row.email ?? null,
    apiKeyPrefix: row.api_key_prefix ?? null,
    company: row.company ?? null,
    cnpj: row.cnpj ?? null,
    productCodes: row.product_codes ?? "",
  }));
}

export async function updateTenant(
  id: string,
  input: { name?: string; planType?: PlanType; queryLimit?: number | null; spendLimitBrl?: number | null },
): Promise<void> {
  const p = await getPool();
  await p.request()
    .input("id", sql.UniqueIdentifier, id)
    .input("n", sql.NVarChar(120), input.name ?? null)
    .input("pt", sql.NVarChar(20), input.planType ?? null)
    .input("ql", sql.Int, input.queryLimit ?? null)
    .input("lim", sql.Decimal(12, 2), input.spendLimitBrl ?? null)
    .query(`
      UPDATE subscriptions SET
        name = COALESCE(@n, name),
        plan_type = COALESCE(@pt, plan_type),
        query_limit = @ql,
        spend_limit_brl = @lim
      WHERE id = @id;
    `);
}

/** Hard delete: remove the subscription + its quotas, customer and login user. Historical
 *  api_usage / request logs are kept (their subscription_id just points at a gone row). */
export async function deleteTenant(id: string): Promise<void> {
  const p = await getPool();
  const req = () => p.request().input("id", sql.UniqueIdentifier, id);
  await req().query(`DELETE FROM subscription_quotas WHERE subscription_id = @id;`);
  await req().query(`DELETE FROM customers WHERE subscription_id = @id;`);
  await req().query(`DELETE FROM users WHERE subscription_id = @id;`);
  await req().query(`DELETE FROM subscriptions WHERE id = @id;`);
}
