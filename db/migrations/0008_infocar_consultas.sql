-- 0008_infocar_consultas.sql — Infocar (FIPE) consultation history + cache.
-- Idempotent — re-running is safe during dev.
--
-- Each row is one full Infocar lookup (vehicle data + FIPE option(s) via the
-- Dadocar platform / APIM). Read by the /infocar page (inline history) AND
-- used by the lookupPlacaInfocar server action as an indefinite cache: if a
-- row exists for the placa, the action returns it instead of re-calling the
-- Infocar function. Cache is cleared only manually (no TTL).

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'infocar_consultas')
BEGIN
  CREATE TABLE infocar_consultas (
    id                  UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    placa               NVARCHAR(10)     NOT NULL,
    owner_id            UNIQUEIDENTIFIER NULL,
    marca               NVARCHAR(60)     NULL,
    modelo              NVARCHAR(200)    NULL,
    ano_modelo          SMALLINT         NULL,
    codigo_fipe         NVARCHAR(20)     NULL,
    valor_fipe          DECIMAL(12,2)    NULL,
    source_id           NVARCHAR(40)     NOT NULL DEFAULT 'infocar',
    upstream_latency_ms INT              NULL,
    payload             NVARCHAR(MAX)    NOT NULL,
    consulted_at        DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME()
  );
END;
GO

-- Fast lookup of latest row per placa (cache check).
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_infocar_consultas_placa_consulted_at' AND object_id = OBJECT_ID('infocar_consultas'))
  CREATE INDEX ix_infocar_consultas_placa_consulted_at ON infocar_consultas(placa, consulted_at DESC);
GO

-- Recent-history feed for the /infocar page.
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_infocar_consultas_consulted_at' AND object_id = OBJECT_ID('infocar_consultas'))
  CREATE INDEX ix_infocar_consultas_consulted_at ON infocar_consultas(consulted_at DESC);
GO

-- Owner-scoped lookup (the cache/history checks filter by owner).
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_infocar_owner_placa' AND object_id = OBJECT_ID('infocar_consultas'))
  CREATE INDEX ix_infocar_owner_placa ON infocar_consultas(owner_id, placa, consulted_at DESC);
GO
