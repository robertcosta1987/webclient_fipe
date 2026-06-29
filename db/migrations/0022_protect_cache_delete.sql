-- 0022_protect_cache_delete — the consult caches (checktudo/infocar/kbb_consultas)
-- are the vehicle-data enrichment asset (the MOAT). No automation should ever
-- delete them. An INSTEAD OF DELETE trigger BLOCKS every delete by default and
-- only allows it when the session explicitly opts in (admin/manual cleanup):
--
--   EXEC sp_set_session_context @key=N'allow_cache_delete', @value=1;  -- then DELETE
--   EXEC sp_set_session_context @key=N'allow_cache_delete', @value=NULL; -- clear
--
-- UPDATEs (de-identify owner_id → NULL, PII scrub) are UNAFFECTED. Idempotent
-- (CREATE OR ALTER). Reversible: DROP TRIGGER trg_protect_delete_<table>.

CREATE OR ALTER TRIGGER trg_protect_delete_checktudo ON checktudo_consultas
INSTEAD OF DELETE AS
BEGIN
  SET NOCOUNT ON;
  IF CONVERT(INT, SESSION_CONTEXT(N'allow_cache_delete')) = 1
    DELETE FROM checktudo_consultas WHERE id IN (SELECT id FROM deleted);
  ELSE
    THROW 50010, 'checktudo_consultas is delete-protected (cache MOAT). Set session allow_cache_delete=1 for admin/manual cleanup.', 1;
END;
GO

CREATE OR ALTER TRIGGER trg_protect_delete_infocar ON infocar_consultas
INSTEAD OF DELETE AS
BEGIN
  SET NOCOUNT ON;
  IF CONVERT(INT, SESSION_CONTEXT(N'allow_cache_delete')) = 1
    DELETE FROM infocar_consultas WHERE id IN (SELECT id FROM deleted);
  ELSE
    THROW 50010, 'infocar_consultas is delete-protected (cache MOAT). Set session allow_cache_delete=1 for admin/manual cleanup.', 1;
END;
GO

CREATE OR ALTER TRIGGER trg_protect_delete_kbb ON kbb_consultas
INSTEAD OF DELETE AS
BEGIN
  SET NOCOUNT ON;
  IF CONVERT(INT, SESSION_CONTEXT(N'allow_cache_delete')) = 1
    DELETE FROM kbb_consultas WHERE id IN (SELECT id FROM deleted);
  ELSE
    THROW 50010, 'kbb_consultas is delete-protected (cache MOAT). Set session allow_cache_delete=1 for admin/manual cleanup.', 1;
END;
GO
