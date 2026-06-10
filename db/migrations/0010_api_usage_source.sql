-- 0010_api_usage_source.sql — split usage into live (billable) vs cache.
-- Idempotent.
--
-- Adds `source` to api_usage so we count BOTH live CheckTudo calls (billable)
-- and cache hits (recorded for reporting, NOT charged). Existing rows default
-- to 'live' (they were all recorded on live calls before this change).

IF COL_LENGTH('api_usage', 'source') IS NULL
  ALTER TABLE api_usage ADD source NVARCHAR(10) NOT NULL
    CONSTRAINT df_api_usage_source DEFAULT 'live';   -- 'live' | 'cache'
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_api_usage_api_source' AND object_id = OBJECT_ID('api_usage'))
  CREATE INDEX ix_api_usage_api_source ON api_usage(api, source, subscription_id, product_code);
GO
