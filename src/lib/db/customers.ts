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
