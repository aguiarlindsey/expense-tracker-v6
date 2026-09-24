-- Household & Multi-User epic (V8 Epic B) — Phase 0: invites + connections.
-- Run this in the Supabase SQL editor AFTER add_profiles.sql.

create table if not exists invites (
  id          text        primary key,
  code        text        not null unique,
  created_by  uuid        not null references auth.users(id) on delete cascade,
  status      text        not null default 'pending',  -- pending | redeemed | revoked
  redeemed_by uuid        references auth.users(id) on delete set null,
  redeemed_at timestamptz,
  expires_at  timestamptz not null default (now() + interval '14 days'),
  created_at  timestamptz default now()
);

alter table invites enable row level security;

drop policy if exists "Users see own invites"   on invites;
drop policy if exists "Users insert own invites" on invites;
drop policy if exists "Users update own invites" on invites;
create policy "Users see own invites"    on invites for select using (auth.uid() = created_by);
create policy "Users insert own invites" on invites for insert with check (auth.uid() = created_by);
create policy "Users update own invites" on invites for update using (auth.uid() = created_by);

do $$ begin
  alter publication supabase_realtime add table invites;
exception when duplicate_object then null;
end $$;

create table if not exists connections (
  id         text        primary key,
  user_a     uuid        not null references auth.users(id) on delete cascade,
  user_b     uuid        not null references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  constraint connections_order  check (user_a < user_b),
  constraint connections_unique unique (user_a, user_b)
);

alter table connections enable row level security;

drop policy if exists "Users see own connections" on connections;
create policy "Users see own connections" on connections for select using (auth.uid() = user_a or auth.uid() = user_b);
-- No insert/update/delete policy — connections are only ever written by the
-- redeem_invite() security-definer function below, never directly by a client.

do $$ begin
  alter publication supabase_realtime add table connections;
exception when duplicate_object then null;
end $$;

-- security definer: the redeemer isn't invites.created_by, so a plain client
-- UPDATE can't pass RLS. Validates status/expiry/self-redeem, flips the
-- invite to redeemed, and inserts the connections row server-side.
create or replace function redeem_invite(p_code text)
returns table(connection_id text, other_user_id uuid)
language plpgsql
security definer set search_path = public
as $$
declare
  v_invite  invites%rowtype;
  v_uid     uuid := auth.uid();
  v_conn_id text;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_invite from invites where code = p_code for update;

  if v_invite is null then
    raise exception 'Invite code not found';
  end if;
  if v_invite.status <> 'pending' then
    raise exception 'Invite code already used or revoked';
  end if;
  if v_invite.expires_at < now() then
    raise exception 'Invite code has expired';
  end if;
  if v_invite.created_by = v_uid then
    raise exception 'You cannot redeem your own invite code';
  end if;

  update invites set status = 'redeemed', redeemed_by = v_uid, redeemed_at = now()
  where id = v_invite.id;

  v_conn_id := substr(md5(random()::text || clock_timestamp()::text), 1, 20);

  insert into connections (id, user_a, user_b)
  values (v_conn_id, least(v_invite.created_by, v_uid), greatest(v_invite.created_by, v_uid))
  on conflict (user_a, user_b) do nothing;

  return query select v_conn_id, v_invite.created_by;
end;
$$;

grant execute on function redeem_invite(text) to authenticated;

notify pgrst, 'reload schema';
