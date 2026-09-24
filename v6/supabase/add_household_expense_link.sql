-- Household & Multi-User epic (V8 Epic B) — Phase 2: shared expense visibility.
-- Run this in the Supabase SQL editor AFTER add_households.sql.

alter table expenses add column if not exists household_id text references households(id) on delete set null;
alter table income   add column if not exists household_id text references households(id) on delete set null;

create index if not exists idx_expenses_household_id on expenses(household_id) where household_id is not null;
create index if not exists idx_income_household_id    on income(household_id)   where household_id is not null;

-- Widen SELECT only — sharing is read-only for everyone except the row's
-- owner. Write policies (insert/update/delete) are untouched, still owner-only.
drop policy if exists "Users see own expenses" on expenses;
create policy "Users see own expenses" on expenses for select using (
  auth.uid() = user_id or (household_id is not null and is_household_member(household_id, auth.uid()))
);

drop policy if exists "Users see own income" on income;
create policy "Users see own income" on income for select using (
  auth.uid() = user_id or (household_id is not null and is_household_member(household_id, auth.uid()))
);

notify pgrst, 'reload schema';
