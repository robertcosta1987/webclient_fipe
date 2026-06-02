-- 0002_kbb_consultas.sql — KBB / Molicar pricing consultation history + cache.
-- Idempotent — re-running is safe during dev.
--
-- Each row is one full Molicar lookup (decoder + KBB pricing + vehicle data).
-- Read by /historico-kbb (history list) AND by the /precos server action as a
-- 90-day cache: if a row exists for the placa newer than 90 days, the action
-- returns it instead of calling the pricing function.

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'kbb_consultas')
BEGIN
  CREATE TABLE kbb_consultas (
    id                      UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    placa                   NVARCHAR(10)     NOT NULL,
    brand                   NVARCHAR(60)     NULL,
    model                   NVARCHAR(120)    NULL,
    version                 NVARCHAR(240)    NULL,
    model_year              SMALLINT         NULL,
    fair_price_used_dealer  DECIMAL(12,2)    NULL,
    molicar_price           DECIMAL(12,2)    NULL,
    source_id               NVARCHAR(40)     NOT NULL DEFAULT 'molicar',
    upstream_latency_ms     INT              NULL,
    payload                 NVARCHAR(MAX)    NOT NULL,
    consulted_at            DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME()
  );
END;
GO

-- Fast lookup of latest row per placa (cache check).
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_kbb_consultas_placa_consulted_at' AND object_id = OBJECT_ID('kbb_consultas'))
  CREATE INDEX ix_kbb_consultas_placa_consulted_at ON kbb_consultas(placa, consulted_at DESC);
GO

-- Recent-history feed for the /historico-kbb page.
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_kbb_consultas_consulted_at' AND object_id = OBJECT_ID('kbb_consultas'))
  CREATE INDEX ix_kbb_consultas_consulted_at ON kbb_consultas(consulted_at DESC);
GO
