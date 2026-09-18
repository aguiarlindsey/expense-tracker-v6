-- Personalization epic (V8) — Other Assets (Phase 4).
-- Run this in the Supabase SQL editor AFTER add_personalize.sql.
-- Open-ended registry (laptop, boat, jewelry, aircraft, anything) —
-- No new expenses columns — reuses the asset_type/asset_id pair from
-- Phase 0 (asset_type = 'other').

create table if not exists other_assets (
  id             text        primary key,
  user_id        uuid        not null references auth.users(id) on delete cascade,
  name           text        not null,
  category       text        not null default 'Other',  -- free text; chip UI suggests common values
  purchase_date  date,
  purchase_price numeric,
  reminder_label text,     -- e.g. "Warranty expires", "Insurance renewal"
  reminder_date  date,     -- one-time reminder, modeled on vehicles.next_puc_date
  emi_amount     numeric,
  emi_due_day    integer,  -- day of month (1-28), recurring EMI reminder
  notes          text,
  row_version    integer     not null default 1,
  updated_at     timestamptz default now(),
  created_at     timestamptz default now()
);

-- In case an earlier run already created the table before these columns existed.
alter table other_assets add column if not exists reminder_label text;
alter table other_assets add column if not exists reminder_date date;
alter table other_assets add column if not exists emi_amount numeric;
alter table other_assets add column if not exists emi_due_day integer;

alter table other_assets enable row level security;
alter table other_assets replica identity full;

drop policy if exists "Users see own other_assets"    on other_assets;
drop policy if exists "Users insert own other_assets" on other_assets;
drop policy if exists "Users update own other_assets" on other_assets;
drop policy if exists "Users delete own other_assets" on other_assets;
create policy "Users see own other_assets"    on other_assets for select using (auth.uid() = user_id);
create policy "Users insert own other_assets" on other_assets for insert with check (auth.uid() = user_id);
create policy "Users update own other_assets" on other_assets for update using (auth.uid() = user_id);
create policy "Users delete own other_assets" on other_assets for delete using (auth.uid() = user_id);

-- Guarded: ALTER PUBLICATION ... ADD TABLE errors (not no-ops) if already added.
do $$ begin
  alter publication supabase_realtime add table other_assets;
exception when duplicate_object then null;
end $$;

-- Reuses bump_row_version(), created by add_row_versioning.sql.
drop trigger if exists trg_bump_row_version_other_assets on other_assets;
create trigger trg_bump_row_version_other_assets
  before update on other_assets
  for each row execute function bump_row_version();
