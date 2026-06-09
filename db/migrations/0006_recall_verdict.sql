-- 0006_recall_verdict.sql — persist the "Veículo Listado Afetado?" recall verdict
-- on each CheckTudo consult so it shows on every saved consult (history), not
-- just freshly-run ones. Idempotent.

IF COL_LENGTH('checktudo_consultas', 'recall_afetado') IS NULL
  ALTER TABLE checktudo_consultas ADD recall_afetado NVARCHAR(20) NULL;  -- 'sim' | 'nao' | 'indeterminado'
GO
IF COL_LENGTH('checktudo_consultas', 'recall_motivo') IS NULL
  ALTER TABLE checktudo_consultas ADD recall_motivo NVARCHAR(400) NULL;
GO
