-- 0012_subscription_query_limit.sql — pooled query cap + on-demand plan.
-- Idempotent.
--
-- plan_type now takes three values:
--   'consultas' — hard cap on the TOTAL number of live queries (query_limit /
--                 query_used), pooled across the contracted products.
--   'cash'      — prepaid R$ budget (spend_limit_brl / spent_brl), mandatory cap.
--   'ondemand'  — open-ended, billed at end of cycle; spend_limit_brl is an
--                 OPTIONAL safety cap (NULL = no cap). Reuses spent_brl.
-- subscription_quotas rows now just mark the contracted (allowed) products.

IF COL_LENGTH('subscriptions', 'query_limit') IS NULL
  ALTER TABLE subscriptions ADD query_limit INT NULL;          -- consultas hard cap (total)
GO
IF COL_LENGTH('subscriptions', 'query_used') IS NULL
  ALTER TABLE subscriptions ADD query_used INT NOT NULL CONSTRAINT df_subscriptions_query_used DEFAULT 0;
GO
