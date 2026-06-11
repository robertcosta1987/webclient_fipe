-- 0013_customer_cnpj.sql — add CNPJ to the customer (CRM) registry. Idempotent.
-- Stored as 14 digits (normalized, no mask).

IF COL_LENGTH('customers', 'cnpj') IS NULL
  ALTER TABLE customers ADD cnpj NVARCHAR(18) NULL;
GO
