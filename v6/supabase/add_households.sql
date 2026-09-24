-- Household & Multi-User epic (V8 Epic B) — Phase 1: households.
-- Run this in the Supabase SQL editor AFTER add_profiles.sql and add_connections.sql.

create table if not exists households (
  id         text        primary key,
  name       text        not null,
  created_by uuid        not null references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);

-- Composite PK (household_id, user_id) — the pair is already unique, no
-- separate id column needed. Matches the ID-convention note in this epic's plan.
create table if not exists household_members (
  household_id text not null references households(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  role         text not null default 'member' check (role in ('owner','member')),
  created_at   timestamptz default now(),
  primary key (household_id, user_id)
);

alter table households        enable row level security;
alter table household_members enable row level security;

-- security definer helper functions: household ↔ household_members policies
-- would otherwise subquery each other and recurse. These read with RLS
-- bypassed internally, so calling them from a policy never recurses.
create or replace function is_household_member(p_household_id text, p_user_id uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from household_members
    where household_id = p_household_id and user_id = p_user_id
  );
$$;

create or replace function is_household_owner(p_household_id text, p_user_id uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from household_members
    where household_id = p_household_id and user_id = p_user_id and role = 'owner'
  );
$$;

-- Same reasoning as the two functions above, for a third circular case: the
-- household_members bootstrap insert policy needs to check "does this
-- household exist and was it created by me," but a raw subquery against
-- households would itself be subject to households' SELECT policy
-- (is_household_member) -- which requires a household_members row that, for
-- the founding owner, doesn't exist until THIS insert completes. Same fix,
-- security definer bypasses that RLS internally.
create or replace function is_household_creator(p_household_id text, p_user_id uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from households
    where id = p_household_id and created_by = p_user_id
  );
$$;

grant execute on function is_household_member(text, uuid)  to authenticated;
grant execute on function is_household_owner(text, uuid)   to authenticated;
grant execute on function is_household_creator(text, uuid) to authenticated;

-- households policies
drop policy if exists "Members see their households"   on households;
drop policy if exists "Users create households"         on households;
drop policy if exists "Owners update households"        on households;
drop policy if exists "Owners delete households"        on households;
create policy "Members see their households" on households for select using (is_household_member(id, auth.uid()));
create policy "Users create households"      on households for insert with check (created_by = auth.uid());
create policy "Owners update households"     on households for update using (is_household_owner(id, auth.uid()));
create policy "Owners delete households"     on households for delete using (is_household_owner(id, auth.uid()));

-- household_members policies
drop policy if exists "Members see member lists"          on household_members;
drop policy if exists "Owners add members, or self as founding owner" on household_members;
drop policy if exists "Owners change roles"                on household_members;
drop policy if exists "Owners remove members, or self leaves" on household_members;
create policy "Members see member lists" on household_members for select using (is_household_member(household_id, auth.uid()));
-- Bootstrap: a household's creator may insert exactly one row — themselves as
-- owner — before any member rows exist. After that, only existing owners can add.
create policy "Owners add members, or self as founding owner" on household_members for insert with check (
  is_household_owner(household_id, auth.uid())
  or (
    user_id = auth.uid() and role = 'owner'
    and is_household_creator(household_id, auth.uid())
    and not exists (select 1 from household_members hm where hm.household_id = household_id)
  )
);
create policy "Owners change roles" on household_members for update using (is_household_owner(household_id, auth.uid()));
create policy "Owners remove members, or self leaves" on household_members for delete using (
  is_household_owner(household_id, auth.uid()) or user_id = auth.uid()
);

-- Invariants RLS can't express declaratively: (1) a new member must already
-- be a connection of the adding owner, (2) the last owner can never be
-- removed/demoted. A DB trigger (not an app-level check) because app-level
-- checks race under concurrent requests — two tabs removing two different
-- owners at once could both pass a stale client-side count.
create or replace function check_household_member_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    if new.user_id <> auth.uid() and not exists (
      select 1 from connections
      where (user_a = auth.uid() and user_b = new.user_id)
         or (user_a = new.user_id and user_b = auth.uid())
    ) then
      raise exception 'Can only add members you are connected with';
    end if;
    return new;
  elsif TG_OP = 'UPDATE' then
    if old.role = 'owner' and new.role <> 'owner' and not exists (
      select 1 from household_members
      where household_id = old.household_id and role = 'owner' and user_id <> old.user_id
    ) then
      raise exception 'Cannot demote the last remaining owner';
    end if;
    return new;
  elsif TG_OP = 'DELETE' then
    -- Only enforce this when the household itself still exists -- deleting
    -- the whole household cascades into deleting the owner's own
    -- household_members row too, which is a legitimate side effect, not a
    -- "removed the last owner from an ongoing household" case. By the time
    -- this cascaded delete fires, the households row is already gone.
    if old.role = 'owner'
       and exists (select 1 from households where id = old.household_id)
       and not exists (
         select 1 from household_members
         where household_id = old.household_id and role = 'owner' and user_id <> old.user_id
       ) then
      raise exception 'Cannot remove the last remaining owner';
    end if;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_check_household_member_change on household_members;
create trigger trg_check_household_member_change
  before insert or update or delete on household_members
  for each row execute function check_household_member_change();

do $$ begin
  alter publication supabase_realtime add table households;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table household_members;
exception when duplicate_object then null;
end $$;

notify pgrst, 'reload schema';
