-- Run in Supabase SQL editor
-- Creates views used by the Insights + Trends tabs
-- security_invoker = true ensures RLS applies (views run as the calling user)

-- Explicit "WHERE user_id = auth.uid()" on every view, added 2026-09-24 (Epic
-- B Phase 2 follow-up): these views have no filter of their own, relying
-- entirely on expenses/income's RLS SELECT policy to scope rows. That was
-- fine when the policy only ever allowed a user's own rows, but Phase 2
-- widened it to also allow household-shared rows -- so these "personal
-- trends" views started silently summing in household members' spending
-- too. RLS still applies underneath (security_invoker); this filter narrows
-- further, back to "mine only," independent of what RLS additionally permits.
CREATE OR REPLACE VIEW v_monthly_expenses
WITH (security_invoker = true) AS
SELECT
  to_char(date::date, 'YYYY-MM') AS month,
  SUM(amount_inr)::numeric        AS total
FROM expenses
WHERE user_id = auth.uid()
GROUP BY to_char(date::date, 'YYYY-MM')
ORDER BY month;

CREATE OR REPLACE VIEW v_monthly_income
WITH (security_invoker = true) AS
SELECT
  to_char(date::date, 'YYYY-MM') AS month,
  SUM(amount_inr)::numeric        AS total
FROM income
WHERE user_id = auth.uid()
GROUP BY to_char(date::date, 'YYYY-MM')
ORDER BY month;

CREATE OR REPLACE VIEW v_yearly_expenses
WITH (security_invoker = true) AS
SELECT
  EXTRACT(YEAR FROM date::date)::text AS year,
  SUM(amount_inr)::numeric             AS total
FROM expenses
WHERE user_id = auth.uid()
GROUP BY EXTRACT(YEAR FROM date::date)
ORDER BY year;
