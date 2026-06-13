-- 0017_api_access_and_request_logs.sql — lock programmatic access to explicitly
-- enabled subscriptions, and add a per-request audit log for the API (parity
-- with the web path's tracking). Idempotent.

-- (a) Only subscriptions with api_access = 1 may be called via an API key.
--     Everything else keeps coming through the authenticated web app.
IF COL_LENGTH('subscriptions', 'api_access') IS NULL
  ALTER TABLE subscriptions ADD api_access BIT NOT NULL CONSTRAINT DF_subscriptions_api_access DEFAULT 0;
GO
-- Enable it ONLY for the designated API customer.
UPDATE subscriptions SET api_access = 1 WHERE name = 'Moneycar_Profitcar_API_FIPE';
GO

-- (b) API request audit log — one row per programmatic call (incl. rejected
--     attempts), so every call can be verified as legit and reconciled against
--     charges (charged = a completed LIVE consult; cache/errors are not charged).
IF OBJECT_ID('api_request_logs', 'U') IS NULL
CREATE TABLE api_request_logs (
  id              UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_api_request_logs PRIMARY KEY DEFAULT NEWID(),
  created_at      DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
  subscription_id UNIQUEIDENTIFIER NULL,
  user_id         UNIQUEIDENTIFIER NULL,
  api_key_prefix  NVARCHAR(16)     NULL,
  endpoint        NVARCHAR(80)     NULL,
  placa           NVARCHAR(10)     NULL,
  product_code    SMALLINT         NULL,
  outcome         NVARCHAR(20)     NOT NULL,   -- 'ok' | 'error' | 'auth_failed'
  source          NVARCHAR(10)     NULL,       -- 'live' | 'cache'
  charged         BIT              NOT NULL DEFAULT 0,
  error_code      NVARCHAR(60)     NULL,
  http_status     INT              NULL,
  duration_ms     INT              NULL,
  ip              NVARCHAR(64)     NULL,
  user_agent      NVARCHAR(400)    NULL,
  country         NVARCHAR(8)      NULL,
  city            NVARCHAR(80)     NULL,
  consulta_id     UNIQUEIDENTIFIER NULL
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_api_request_logs_sub_time')
  CREATE INDEX IX_api_request_logs_sub_time ON api_request_logs(subscription_id, created_at DESC);
GO
