-- 0005_tenant_owner.sql — per-user (tenant) isolation.
-- Adds an owner_id (the authenticated user's id) to every per-user data table.
-- All reads/writes filter by owner_id so a user only ever sees their own data.
-- Idempotent. Pre-existing rows keep owner_id = NULL (orphaned / not shown).

IF COL_LENGTH('carros_ativos', 'owner_id') IS NULL
  ALTER TABLE carros_ativos ADD owner_id UNIQUEIDENTIFIER NULL;
GO
IF COL_LENGTH('kbb_consultas', 'owner_id') IS NULL
  ALTER TABLE kbb_consultas ADD owner_id UNIQUEIDENTIFIER NULL;
GO
IF COL_LENGTH('checktudo_consultas', 'owner_id') IS NULL
  ALTER TABLE checktudo_consultas ADD owner_id UNIQUEIDENTIFIER NULL;
GO

-- Owner-scoped lookup indexes (the cache/history checks always filter by owner).
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_carros_owner_criado' AND object_id = OBJECT_ID('carros_ativos'))
  CREATE INDEX ix_carros_owner_criado ON carros_ativos(owner_id, criado_em DESC);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_kbb_owner_placa' AND object_id = OBJECT_ID('kbb_consultas'))
  CREATE INDEX ix_kbb_owner_placa ON kbb_consultas(owner_id, placa, consulted_at DESC);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_checktudo_owner_placa_product' AND object_id = OBJECT_ID('checktudo_consultas'))
  CREATE INDEX ix_checktudo_owner_placa_product ON checktudo_consultas(owner_id, placa, product_code, consulted_at DESC);
GO
