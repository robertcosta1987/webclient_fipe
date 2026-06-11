-- 0015_laudo_cache.sql — cache the AI vehicle-history laudo per consulta.
-- Idempotent. laudo_facts = deterministic facts bundle (JSON), laudo_ia = the
-- LLM narrative (JSON). Both keyed by the checktudo_consultas row id.

IF COL_LENGTH('checktudo_consultas', 'laudo_facts') IS NULL
  ALTER TABLE checktudo_consultas ADD laudo_facts NVARCHAR(MAX) NULL;
GO
IF COL_LENGTH('checktudo_consultas', 'laudo_ia') IS NULL
  ALTER TABLE checktudo_consultas ADD laudo_ia NVARCHAR(MAX) NULL;
GO
