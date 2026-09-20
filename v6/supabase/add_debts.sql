-- Financial Planning epic (V8 Epic C2) — Debt Payoff Planner.
-- Run this in the Supabase SQL editor before using the feature.
-- Standalone: no dependency on Epic A/B tables.

create table if not exists debts (
  id               text        primary key,
  user_id          uuid        not null references auth.users(id) on delete cascade,
  name             text        not null,
  principal        numeric     not null,
  interest_rate    numeric     not null default 0,  -- annual %, e.g. 12 for 12%
  term_months      integer     not null default 12,
  minimum_payment  numeric     not null default 0,
  start_date       date,
  notes            text,
  months_paid      integer     not null default 0,   -- regular EMI installments actually paid so far
  extra_payments   jsonb       not null default '[]'::jsonb, -- [{atMonth, amount, mode: 'tenure'|'emi'}]
  rate_changes     jsonb       not null default '[]'::jsonb, -- [{atMonth, newRate, mode: 'tenure'|'emi'}]
  rate_method      text        not null default 'monthly',  -- 'monthly' (US) | 'daily' (India/UK, 365-day reducing balance) | 'canadian' (semi-annual compounding)
  row_version      integer     not null default 1,
  updated_at       timestamptz default now(),
  created_at       timestamptz default now()
);

-- In case an earlier run already created the table before these columns existed.
alter table debts add column if not exists months_paid integer not null default 0;
alter table debts add column if not exists extra_payments jsonb not null default '[]'::jsonb;
alter table debts add column if not exists rate_changes jsonb not null default '[]'::jsonb;
alter table debts add column if not exists rate_method text not null default 'monthly';

alter table debts enable row level security;
alter table debts replica identity full;

drop policy if exists "Users see own debts"    on debts;
drop policy if exists "Users insert own debts" on debts;
drop policy if exists "Users update own debts" on debts;
drop policy if exists "Users delete own debts" on debts;
create policy "Users see own debts"    on debts for select using (auth.uid() = user_id);
create policy "Users insert own debts" on debts for insert with check (auth.uid() = user_id);
create policy "Users update own debts" on debts for update using (auth.uid() = user_id);
create policy "Users delete own debts" on debts for delete using (auth.uid() = user_id);

-- Guarded: ALTER PUBLICATION ... ADD TABLE errors (not no-ops) if already added.
do $$ begin
  alter publication supabase_realtime add table debts;
exception when duplicate_object then null;
end $$;

-- Reuses bump_row_version(), created by add_row_versioning.sql.
drop trigger if exists trg_bump_row_version_debts on debts;
create trigger trg_bump_row_version_debts
  before update on debts
  for each row execute function bump_row_version();

-- Force Supabase's API layer to pick up new/changed columns immediately
-- instead of waiting for its schema cache to refresh on its own.
notify pgrst, 'reload schema';
