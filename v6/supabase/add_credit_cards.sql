-- Personalization epic (V8) — Credit Cards (Phase 2).
-- Run this in the Supabase SQL editor.

create table if not exists credit_cards (
  id                text        primary key,
  user_id           uuid        not null references auth.users(id) on delete cascade,
  name              text        not null,
  bank              text,
  last4             text,
  credit_limit      numeric,
  billing_cycle_day integer,    -- day of month (1-28) the statement cycle starts
  due_day           integer,    -- day of month (1-28) payment is due
  notes             text,
  row_version       integer     not null default 1,
  updated_at        timestamptz default now(),
  created_at        timestamptz default now()
);

alter table credit_cards enable row level security;
alter table credit_cards replica identity full;

create policy "Users see own credit cards"    on credit_cards for select using (auth.uid() = user_id);
create policy "Users insert own credit cards" on credit_cards for insert with check (auth.uid() = user_id);
create policy "Users update own credit cards" on credit_cards for update using (auth.uid() = user_id);
create policy "Users delete own credit cards" on credit_cards for delete using (auth.uid() = user_id);

alter publication supabase_realtime add table credit_cards;

-- Reuses bump_row_version(), created by add_row_versioning.sql.
drop trigger if exists trg_bump_row_version_credit_cards on credit_cards;
create trigger trg_bump_row_version_credit_cards
  before update on credit_cards
  for each row execute function bump_row_version();

-- Dedicated column, NOT asset_type/asset_id — a card is "how you paid",
-- orthogonal to "what this expense is about" (vehicle/house/phone), so an
-- expense can be tagged to both a vehicle and a card at the same time.
alter table expenses
  add column if not exists card_id text;
