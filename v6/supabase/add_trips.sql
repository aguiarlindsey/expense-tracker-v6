-- ─── TRIPS ──────────────────────────────────────────────
-- Run this in the Supabase SQL editor to add the trips feature.

create table if not exists trips (
  id          text        primary key,
  user_id     uuid        not null references auth.users(id) on delete cascade,
  name        text        not null,
  start_date  date        not null,
  end_date    date        not null,
  currency    text        not null default 'USD',
  notes       text,
  created_at  timestamptz default now()
);

alter table trips enable row level security;
alter table trips replica identity full;

create policy "Users see own trips"    on trips for select using (auth.uid() = user_id);
create policy "Users insert own trips" on trips for insert with check (auth.uid() = user_id);
create policy "Users update own trips" on trips for update using (auth.uid() = user_id);
create policy "Users delete own trips" on trips for delete using (auth.uid() = user_id);

alter publication supabase_realtime add table trips;
