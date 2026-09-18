-- Personalization epic (V8) — Houses (Phase 3).
-- Run this in the Supabase SQL editor AFTER add_personalize.sql.
-- No new expenses columns — reuses the asset_type/asset_id pair from Phase 0.

create table if not exists houses (
  id             text        primary key,
  user_id        uuid        not null references auth.users(id) on delete cascade,
  name           text        not null,
  address        text,
  ownership      text        not null default 'owned',  -- owned | rented | leased_out
  move_in_date   date,
  rent_amount       numeric,
  rent_due_day      integer,  -- day of month (1-28); rent owed if ownership='rented', rent collected if 'leased_out'
  electricity_due_day integer, -- day of month (1-28) electricity bill is due — relevant regardless of ownership
  maintenance_due_day integer, -- day of month (1-28) society/maintenance fee is due — relevant regardless of ownership
  notes          text,
  row_version    integer     not null default 1,
  updated_at     timestamptz default now(),
  created_at     timestamptz default now()
);

-- In case an earlier run already created the table before these columns existed.
alter table houses add column if not exists rent_due_day integer;
alter table houses add column if not exists electricity_due_day integer;
alter table houses add column if not exists maintenance_due_day integer;

alter table houses enable row level security;
alter table houses replica identity full;

drop policy if exists "Users see own houses"    on houses;
drop policy if exists "Users insert own houses" on houses;
drop policy if exists "Users update own houses" on houses;
drop policy if exists "Users delete own houses" on houses;
create policy "Users see own houses"    on houses for select using (auth.uid() = user_id);
create policy "Users insert own houses" on houses for insert with check (auth.uid() = user_id);
create policy "Users update own houses" on houses for update using (auth.uid() = user_id);
create policy "Users delete own houses" on houses for delete using (auth.uid() = user_id);

-- Guarded: ALTER PUBLICATION ... ADD TABLE errors (not no-ops) if already added.
do $$ begin
  alter publication supabase_realtime add table houses;
exception when duplicate_object then null;
end $$;

-- Reuses bump_row_version(), created by add_row_versioning.sql.
drop trigger if exists trg_bump_row_version_houses on houses;
create trigger trg_bump_row_version_houses
  before update on houses
  for each row execute function bump_row_version();

