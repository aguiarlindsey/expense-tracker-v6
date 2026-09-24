-- Household & Multi-User epic (V8 Epic B) — Phase 0: profiles table.
-- Run this in the Supabase SQL editor first (connections/households/splits
-- all need to resolve a user_id into a display name).

create table if not exists profiles (
  id           uuid        primary key references auth.users(id) on delete cascade,
  display_name text,
  email        text,
  created_at   timestamptz default now()
);

alter table profiles enable row level security;

drop policy if exists "Any authenticated user can view profiles" on profiles;
drop policy if exists "Users update own profile" on profiles;
drop policy if exists "Users insert own profile" on profiles;
create policy "Any authenticated user can view profiles" on profiles for select using (auth.role() = 'authenticated');
create policy "Users update own profile" on profiles for update using (auth.uid() = id);
create policy "Users insert own profile" on profiles for insert with check (auth.uid() = id);

-- Auto-create a profile row whenever a new auth user signs up. user_metadata
-- is JSONB the client can't RLS-join against, so we mirror display_name here.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, email)
  values (new.id, new.raw_user_meta_data->>'display_name', new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- One-time backfill for users who signed up before this table existed.
insert into public.profiles (id, display_name, email)
select id, raw_user_meta_data->>'display_name', email
from auth.users
on conflict (id) do nothing;

notify pgrst, 'reload schema';
