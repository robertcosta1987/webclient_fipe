-- 0016_user_api_keys.sql — programmatic API access. A customer's login user can
-- hold one API key (stored as a SHA-256 hash; plaintext shown once at issue).
-- Calls authenticated by this key meter through the SAME api_usage ledger and
-- consumption plan as the UI. Also seeds the FIPE/Decodificador product (202).
-- Idempotent.

IF COL_LENGTH('users', 'api_key_hash') IS NULL
  ALTER TABLE users ADD api_key_hash NVARCHAR(64) NULL;
GO
IF COL_LENGTH('users', 'api_key_prefix') IS NULL
  ALTER TABLE users ADD api_key_prefix NVARCHAR(16) NULL;
GO
IF COL_LENGTH('users', 'api_key_created_at') IS NULL
  ALTER TABLE users ADD api_key_created_at DATETIME2 NULL;
GO
-- One key per hash; partial index so multiple NULLs are allowed.
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_users_api_key_hash')
  CREATE UNIQUE INDEX UX_users_api_key_hash ON users(api_key_hash) WHERE api_key_hash IS NOT NULL;
GO

-- Sellable FIPE/Decodificador consult (querycode 202) in the metering catalog.
MERGE api_products AS t
USING (VALUES ('checktudo', 202, 'Decodificador e Precificador (FIPE)', 0.50)) AS s (api, code, name, unit_price_brl)
ON (t.api = s.api AND t.code = s.code)
WHEN NOT MATCHED THEN
  INSERT (api, code, name, unit_price_brl) VALUES (s.api, s.code, s.name, s.unit_price_brl);
GO
