// db/customers.ts — CRM registry. One row per customer (company + contact),
// linked to the subscription and login user created alongside it. Minimal now;
// the future CRM will extend it (payments, profit/spend, etc.).

import "server-only";
import sql from "mssql";
import { getPool } from "./pool";

export type CustomerRow = {
  id: string;
  name: string;
  company: string;
  cnpj: string | null;
  email: string;
  phone: string | null;
  subscription_id: string | null;
  user_id: string | null;
  status: string;
  created_at: string;
};

export async function createCustomer(input: {
  name: string;
  company: string;
  cnpj?: string | null;
  email: string;
  phone?: string | null;
  subscriptionId: string | null;
  userId: string | null;
}): Promise<{ id: string }> {
  const p = await getPool();
  const r = await p.request()
    .input("name", sql.NVarChar(120), input.name)
    .input("company", sql.NVarChar(160), input.company)
    .input("cnpj", sql.NVarChar(18), input.cnpj ?? null)
    .input("email", sql.NVarChar(254), input.email.toLowerCase())
    .input("phone", sql.NVarChar(30), input.phone ?? null)
    .input("sub", sql.UniqueIdentifier, input.subscriptionId)
    .input("uid", sql.UniqueIdentifier, input.userId)
    .query(`
      INSERT INTO customers (name, company, cnpj, email, phone, subscription_id, user_id)
      OUTPUT inserted.id
      VALUES (@name, @company, @cnpj, @email, @phone, @sub, @uid);
    `);
  return { id: r.recordset[0].id as string };
}

/** The CRM record linked to a login user (for the data export, Art. 18 II/V). */
export async function getByUserId(userId: string): Promise<CustomerRow | null> {
  const p = await getPool();
  const r = await p.request()
    .input("uid", sql.UniqueIdentifier, userId)
    .query(`SELECT TOP 1 CAST(id AS NVARCHAR(40)) AS id, name, company, cnpj, email, phone,
                   CAST(subscription_id AS NVARCHAR(40)) AS subscription_id,
                   CAST(user_id AS NVARCHAR(40)) AS user_id, status, created_at
            FROM customers WHERE user_id = @uid`);
  return (r.recordset[0] as CustomerRow | undefined) ?? null;
}

/** Anonymize the CRM record on account erasure (Art. 18 VI). The row is kept —
 *  not hard-deleted — so the subscription/billing linkage stays intact for
 *  fiscal/legal retention (Art. 16); all personal fields are stripped. */
export async function anonymizeByUserId(userId: string): Promise<void> {
  const p = await getPool();
  await p.request()
    .input("uid", sql.UniqueIdentifier, userId)
    .query(`UPDATE customers SET
              name = '(removido)', company = '(removido)', cnpj = NULL,
              email = CONCAT('anon-', CAST(id AS NVARCHAR(40)), '@anonimizado.invalid'),
              phone = NULL, status = 'deleted'
            WHERE user_id = @uid`);
}
