-- 0021_user_consents.sql — record data-subject consent (Art. 8º §6, comprovação).
-- One row per consent event (e.g. acceptance of the Privacy Policy at sign-up).
-- We keep the policy VERSION accepted + a UTC timestamp so consent is provable
-- and tied to the exact text shown. Idempotent.

IF OBJECT_ID('user_consents', 'U') IS NULL
CREATE TABLE user_consents (
  id             UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_user_consents PRIMARY KEY DEFAULT NEWID(),
  user_id        UNIQUEIDENTIFIER NOT NULL,
  kind           NVARCHAR(40)     NOT NULL,             -- 'privacy_policy' | future kinds
  policy_version NVARCHAR(20)     NOT NULL,
  granted        BIT              NOT NULL DEFAULT 1,    -- 0 = withdrawn
  granted_at     DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
  ip             NVARCHAR(64)     NULL
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_user_consents_user')
  CREATE INDEX IX_user_consents_user ON user_consents(user_id, kind, granted_at DESC);
GO
