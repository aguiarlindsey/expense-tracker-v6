-- Run once in the Supabase SQL editor. Makes the 2026-10-30 end-of-auto-grant
-- change permanently irrelevant to this project: any table created from now
-- on (via the SQL editor, which runs as `postgres`) automatically receives
-- the same Data API grants Supabase used to apply automatically, before you
-- even write RLS policies for it. Explicit per-table grants in each new
-- add_*.sql (per CLAUDE.md) are still worth keeping as belt-and-suspenders
-- -- they make a migration file self-contained and portable to a fresh
-- project -- but this is the actual safety net: nothing breaks on THIS
-- project even if a future migration forgets them.
--
-- RLS still does the real narrowing in every case -- a table-level grant
-- only sets the ceiling of what's possible, same as it always has.

alter default privileges for role postgres in schema public
  grant select on tables to anon;

alter default privileges for role postgres in schema public
  grant select, insert, update, delete on tables to authenticated;

alter default privileges for role postgres in schema public
  grant select, insert, update, delete on tables to service_role;

-- Deliberately NOT extending this to functions: those were never part of
-- the Oct 30 auto-grant change (RPC functions have always needed explicit,
-- per-function grants -- that's a correct, pre-existing requirement, not
-- something broken by the deadline). A default "execute to anon" for every
-- future function would be a real security regression -- this project's
-- security-definer functions (redeem_invite, is_household_*, etc.) are
-- deliberately authenticated-only, granted by hand, one at a time, on
-- purpose. Keep doing that explicitly for every new function.
--
-- Also not extending to sequences -- this project's ID convention is
-- client-generated text IDs (not serial/identity columns), so they're not
-- expected to come up; grant explicitly if a future table genuinely needs one.
