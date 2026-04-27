-- Run in Supabase SQL editor
-- Creates views used by the Insights + Trends tabs
-- security_invoker = true ensures RLS applies (views run as the calling user)

CREATE OR REPLACE VIEW v_monthly_expenses
WITH (security_invoker = true) AS
SELECT
  to_char(date::date, 'YYYY-MM') AS month,
  SUM(amount_inr)::numeric        AS total
FROM expenses
GROUP BY to_char(date::date, 'YYYY-MM')
ORDER BY month;

CREATE OR REPLACE VIEW v_monthly_income
WITH (security_invoker = true) AS
SELECT
  to_char(date::date, 'YYYY-MM') AS month,
  SUM(amount_inr)::numeric        AS total
FROM income
GROUP BY to_char(date::date, 'YYYY-MM')
ORDER BY month;

CREATE OR REPLACE VIEW v_yearly_expenses
WITH (security_invoker = true) AS
SELECT
  EXTRACT(YEAR FROM date::date)::text AS year,
  SUM(amount_inr)::numeric             AS total
FROM expenses
GROUP BY EXTRACT(YEAR FROM date::date)
ORDER BY year;
