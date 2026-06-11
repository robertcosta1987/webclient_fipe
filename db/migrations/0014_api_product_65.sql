-- 0014_api_product_65.sql — add CheckTudo consult type 65 to the metering
-- catalog at R$60,00. Idempotent.

MERGE api_products AS t
USING (VALUES ('checktudo', 65, 'Total Plus', 60.00)) AS s (api, code, name, unit_price_brl)
ON (t.api = s.api AND t.code = s.code)
WHEN NOT MATCHED THEN
  INSERT (api, code, name, unit_price_brl) VALUES (s.api, s.code, s.name, s.unit_price_brl)
WHEN MATCHED THEN
  UPDATE SET unit_price_brl = s.unit_price_brl, name = s.name;
GO
