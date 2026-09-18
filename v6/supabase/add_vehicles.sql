-- Personalization epic (V8) — Vehicles (Phase 1).
-- Run this in the Supabase SQL editor AFTER add_personalize.sql.

create table if not exists vehicles (
  id             text        primary key,
  user_id        uuid        not null references auth.users(id) on delete cascade,
  name           text        not null,
  type           text        not null default 'car',       -- car | bike | scooter
  fuel_type      text        not null default 'petrol',     -- petrol | diesel | cng | electric | hydrogen
  reg_number     text,
  purchase_date  date,
  next_puc_date  date,
  notes          text,
  row_version    integer     not null default 1,
  updated_at     timestamptz default now(),
  created_at     timestamptz default now()
);

alter table vehicles enable row level security;
alter table vehicles replica identity full;

create policy "Users see own vehicles"    on vehicles for select using (auth.uid() = user_id);
create policy "Users insert own vehicles" on vehicles for insert with check (auth.uid() = user_id);
create policy "Users update own vehicles" on vehicles for update using (auth.uid() = user_id);
create policy "Users delete own vehicles" on vehicles for delete using (auth.uid() = user_id);

alter publication supabase_realtime add table vehicles;

-- Reuses bump_row_version(), created by add_row_versioning.sql (already
-- shipped in v7.8.0) — no redefinition needed.
drop trigger if exists trg_bump_row_version_vehicles on vehicles;
create trigger trg_bump_row_version_vehicles
  before update on vehicles
  for each row execute function bump_row_version();

-- Structured parts-due list on Vehicle Maintenance expenses, e.g.
-- [{"part": "Brake pads", "dueKm": 45000}] — same precedent as the
-- existing tax_breakdown jsonb column.
alter table expenses
  add column if not exists service_parts jsonb default null;
