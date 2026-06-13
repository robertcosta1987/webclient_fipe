-- 0019_test_vehicles_photos.sql — persist the uploaded car photos (public URLs,
-- JSON array) on the saved vehicle. Idempotent.

IF COL_LENGTH('test_vehicles', 'photos') IS NULL
  ALTER TABLE test_vehicles ADD photos NVARCHAR(MAX) NULL;
GO
