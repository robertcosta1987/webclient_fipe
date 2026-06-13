-- 0020_test_vehicles_opcionais.sql — free-text field for optionals / other vehicle
-- characteristics (e.g. "Blindado, teto solar") entered by the seller. Idempotent.

IF COL_LENGTH('test_vehicles', 'opcionais') IS NULL
  ALTER TABLE test_vehicles ADD opcionais NVARCHAR(2000) NULL;
GO
