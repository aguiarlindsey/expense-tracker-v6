-- Financial Planning epic (V8 Epic C3 follow-up) — Custom recurring intervals.
-- Run this in the Supabase SQL editor before using half-yearly/custom-day
-- recurring expenses (e.g. a 28/56/84-day mobile recharge plan).
-- Standalone: just one column on the existing expenses table.

alter table expenses add column if not exists recurring_days integer;

-- Force Supabase's API layer to pick up the new column immediately.
notify pgrst, 'reload schema';
