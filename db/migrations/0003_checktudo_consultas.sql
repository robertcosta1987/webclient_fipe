-- 0003_checktudo_consultas.sql — CheckTudo vehicle-data consultation history + cache.
-- Idempotent — re-running is safe during dev.
--
-- Each row is one CheckTudo lookup for a (placa, product_code) pair. Read by the
-- /checktudo page's inline history AND used as a 90-day cache: a row newer than
-- 90 days for the same placa+product short-circuits the paid CheckTudo call.
-- Mirrors kbb_consultas (migration 0002) with a product_code/product_name pair,
-- since each CheckTudo product (querycode) is a distinct paid query.

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'checktudo_consultas')
BEGIN
  CREATE TABLE checktudo_consultas (
    id                   UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    placa                NVARCHAR(10)     NOT NULL,
    product_code         SMALLINT         NOT NULL,
    product_name         NVARCHAR(60)     NULL,
    brand                NVARCHAR(60)     NULL,
    model                NVARCHAR(120)    NULL,
    model_year           SMALLINT         NULL,
    chassi               NVARCHAR(30)     NULL,
    query_id             NVARCHAR(60)     NULL,
    upstream_latency_ms  INT              NULL,
    payload              NVARCHAR(MAX)    NOT NULL,
    consulted_at         DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME()
  );
END;
GO

-- Fast lookup of latest row per (placa, product_code) — the cache check.
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_checktudo_consultas_placa_product_consulted_at' AND object_id = OBJECT_ID('checktudo_consultas'))
  CREATE INDEX ix_checktudo_consultas_placa_product_consulted_at
    ON checktudo_consultas(placa, product_code, consulted_at DESC);
GO

-- Recent-history feed for the /checktudo page.
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_checktudo_consultas_consulted_at' AND object_id = OBJECT_ID('checktudo_consultas'))
  CREATE INDEX ix_checktudo_consultas_consulted_at
    ON checktudo_consultas(consulted_at DESC);
GO
