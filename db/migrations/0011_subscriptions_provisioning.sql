-- 0011_subscriptions_provisioning.sql — self-serve-ish subscription provisioning.
-- Idempotent.
--
-- Adds the pieces the admin "Adicionar Assinatura" page writes:
--   subscriptions.plan_type   — 'consultas' (per-product credit counts) or
--                               'cash' (R$ spend cap). NULL = unlimited (legacy).
--   subscriptions.spend_limit_brl / spent_brl — the cash budget + running spend.
--   subscription_quotas       — contracted products; per-product credit count
--                               (granted/used) for the 'consultas' model; a row
--                               with granted NULL means "allowed" (cash model).
--   customers                 — CRM registry (company + contact), to be expanded
--                               by the future CRM.
--   users.must_change_password — force a password change on first login.

-- ── subscriptions: plan + budget ────────────────────────────────────────────
IF COL_LENGTH('subscriptions', 'plan_type') IS NULL
  ALTER TABLE subscriptions ADD plan_type NVARCHAR(20) NULL;   -- 'consultas' | 'cash' | NULL
GO
IF COL_LENGTH('subscriptions', 'spend_limit_brl') IS NULL
  ALTER TABLE subscriptions ADD spend_limit_brl DECIMAL(12,2) NULL;  -- NULL = no cap
GO
IF COL_LENGTH('subscriptions', 'spent_brl') IS NULL
  ALTER TABLE subscriptions ADD spent_brl DECIMAL(12,2) NOT NULL CONSTRAINT df_subscriptions_spent DEFAULT 0;
GO

-- ── subscription_quotas: contracted products + per-product credit counts ─────
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'subscription_quotas')
BEGIN
  CREATE TABLE subscription_quotas (
    subscription_id  UNIQUEIDENTIFIER NOT NULL,
    api              NVARCHAR(40)     NOT NULL,   -- 'checktudo'
    product_code     SMALLINT         NOT NULL,
    granted          INT              NULL,        -- consult credits (NULL = allowed, no count cap)
    used             INT              NOT NULL DEFAULT 0,
    created_at       DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT pk_subscription_quotas PRIMARY KEY (subscription_id, api, product_code)
  );
END;
GO

-- ── customers: CRM registry ─────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'customers')
BEGIN
  CREATE TABLE customers (
    id               UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    name             NVARCHAR(120)    NOT NULL,    -- contact name (Nome)
    company          NVARCHAR(160)    NOT NULL,    -- Empresa
    email            NVARCHAR(254)    NOT NULL,
    phone            NVARCHAR(30)     NULL,
    subscription_id  UNIQUEIDENTIFIER NULL,
    user_id          UNIQUEIDENTIFIER NULL,
    notes            NVARCHAR(MAX)    NULL,
    status           NVARCHAR(20)     NOT NULL DEFAULT 'active',
    created_at       DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME()
  );
END;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_customers_subscription' AND object_id = OBJECT_ID('customers'))
  CREATE INDEX ix_customers_subscription ON customers(subscription_id);
GO

-- ── users: force password change on first login ─────────────────────────────
IF COL_LENGTH('users', 'must_change_password') IS NULL
  ALTER TABLE users ADD must_change_password BIT NOT NULL CONSTRAINT df_users_mcp DEFAULT 0;
GO
