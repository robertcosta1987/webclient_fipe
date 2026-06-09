-- 0007_parecer.sql — "Parecer de Compra": persist the AI buy/risk verdict
-- (COMPRAR / ATENÇÃO / EVITAR + reason) on each CheckTudo consult, so it shows
-- on every saved consult without re-calling the model. Idempotent.

IF COL_LENGTH('checktudo_consultas', 'parecer_veredito') IS NULL
  ALTER TABLE checktudo_consultas ADD parecer_veredito NVARCHAR(20) NULL;  -- 'comprar' | 'atencao' | 'evitar'
GO
IF COL_LENGTH('checktudo_consultas', 'parecer_motivo') IS NULL
  ALTER TABLE checktudo_consultas ADD parecer_motivo NVARCHAR(500) NULL;
GO
