-- 0009_api_metering.sql — API usage metering + customer subscriptions.
-- Idempotent.
--
-- Lets us count and monetize API consults:
--   subscriptions  — a billable customer (e.g. "Moneycar") with a subscription key.
--   api_products   — the sellable consult types per API, each with a unit price.
--   users.subscription_id — which customer a user's usage is billed to.
--   api_usage      — one row per BILLABLE consult (live CheckTudo calls only;
--                    cache hits are never recorded). The metering ledger.

-- ── subscriptions ───────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'subscriptions')
BEGIN
  CREATE TABLE subscriptions (
    id          UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    name        NVARCHAR(120)    NOT NULL,
    sub_key     NVARCHAR(60)     NOT NULL UNIQUE,  -- the customer-facing subscription ID/key
    status      NVARCHAR(20)     NOT NULL DEFAULT 'active',
    created_at  DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME()
  );
END;
GO

-- ── api_products (the sellable consult types) ───────────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'api_products')
BEGIN
  CREATE TABLE api_products (
    api             NVARCHAR(40)  NOT NULL,           -- 'checktudo'
    code            SMALLINT      NOT NULL,           -- CheckTudo querycode
    name            NVARCHAR(120) NOT NULL,
    unit_price_brl  DECIMAL(10,2) NOT NULL DEFAULT 0,
    active          BIT           NOT NULL DEFAULT 1,
    created_at      DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT pk_api_products PRIMARY KEY (api, code)
  );
END;
GO

-- Seed the CheckTudo products (prices mirror the Placas360 storefront). Idempotent.
MERGE api_products AS t
USING (VALUES
  ('checktudo', 66,  'Veículo Total',                 44.90),
  ('checktudo', 67,  'Veículo Essencial',             29.90),
  ('checktudo', 13,  'Decodificador e Precificador',  19.90),
  ('checktudo', 71,  'Dados Cadastrais do Veículo',    9.90),
  ('checktudo', 76,  'Decodificador + Histórico FIPE', 17.90),
  ('checktudo', 241, 'Decodificador V.4',             12.90)
) AS s (api, code, name, unit_price_brl)
ON (t.api = s.api AND t.code = s.code)
WHEN NOT MATCHED THEN
  INSERT (api, code, name, unit_price_brl) VALUES (s.api, s.code, s.name, s.unit_price_brl);
GO

-- ── users.subscription_id ───────────────────────────────────────────────────
IF COL_LENGTH('users', 'subscription_id') IS NULL
  ALTER TABLE users ADD subscription_id UNIQUEIDENTIFIER NULL;
GO

-- ── api_usage ledger ────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'api_usage')
BEGIN
  CREATE TABLE api_usage (
    id               UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    subscription_id  UNIQUEIDENTIFIER NULL,            -- who to charge (NULL = unassigned)
    user_id          UNIQUEIDENTIFIER NULL,            -- who ran it
    user_email       NVARCHAR(254)    NULL,            -- snapshot for the report
    api              NVARCHAR(40)     NOT NULL,        -- 'checktudo'
    product_code     SMALLINT         NOT NULL,
    product_name     NVARCHAR(120)    NULL,            -- snapshot
    consulta_id      UNIQUEIDENTIFIER NULL,            -- -> checktudo_consultas.id
    placa            NVARCHAR(10)     NULL,
    unit_price_brl   DECIMAL(10,2)    NULL,            -- price snapshot at time of use
    counted_at       DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME()
  );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_api_usage_api_sub' AND object_id = OBJECT_ID('api_usage'))
  CREATE INDEX ix_api_usage_api_sub ON api_usage(api, subscription_id, product_code);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_api_usage_counted_at' AND object_id = OBJECT_ID('api_usage'))
  CREATE INDEX ix_api_usage_counted_at ON api_usage(counted_at DESC);
GO

-- ── seed the first customer: Moneycar ───────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM subscriptions WHERE name = 'Moneycar')
  INSERT INTO subscriptions (name, sub_key, status) VALUES ('Moneycar', 'SUB-MONEYCAR-001', 'active');
GO

-- Place all current REGULAR users under Moneycar. The admin/master is the
-- operator (3A Hub), not a billable customer, so it's left unassigned.
-- New users keep subscription_id NULL until configured.
UPDATE u
  SET u.subscription_id = (SELECT id FROM subscriptions WHERE name = 'Moneycar')
FROM users u
WHERE u.subscription_id IS NULL AND u.role = 'user';
GO
