-- Financial Planning epic (V8 Epic C3) — Smart Rules (auto-categorization).
-- Run this in the Supabase SQL editor before using the feature.
-- Standalone: no dependency on Epic A/B/C1/C2 tables.

create table if not exists categorization_rules (
  id               text        primary key,
  user_id          uuid        not null references auth.users(id) on delete cascade,
  field            text        not null default 'description', -- description | amount | paymentMethod
  operator         text        not null default 'contains',     -- contains | equals | gt | lt
  value            text        not null default '',
  set_category     text        not null,
  set_subcategory  text,
  set_tags         text[]      not null default '{}',
  priority         integer     not null default 0,   -- lower number = checked first
  enabled          boolean     not null default true,
  row_version      integer     not null default 1,
  updated_at       timestamptz default now(),
  created_at       timestamptz default now()
);

alter table categorization_rules enable row level security;
alter table categorization_rules replica identity full;

drop policy if exists "Users see own rules"    on categorization_rules;
drop policy if exists "Users insert own rules" on categorization_rules;
drop policy if exists "Users update own rules" on categorization_rules;
drop policy if exists "Users delete own rules" on categorization_rules;
create policy "Users see own rules"    on categorization_rules for select using (auth.uid() = user_id);
create policy "Users insert own rules" on categorization_rules for insert with check (auth.uid() = user_id);
create policy "Users update own rules" on categorization_rules for update using (auth.uid() = user_id);
create policy "Users delete own rules" on categorization_rules for delete using (auth.uid() = user_id);

-- Guarded: ALTER PUBLICATION ... ADD TABLE errors (not no-ops) if already added.
do $$ begin
  alter publication supabase_realtime add table categorization_rules;
exception when duplicate_object then null;
end $$;

-- Reuses bump_row_version(), created by add_row_versioning.sql.
drop trigger if exists trg_bump_row_version_categorization_rules on categorization_rules;
create trigger trg_bump_row_version_categorization_rules
  before update on categorization_rules
  for each row execute function bump_row_version();

-- Force Supabase's API layer to pick up the new table immediately.
notify pgrst, 'reload schema';
