-- Household & Multi-User epic (V8 Epic B) — Phase 2 follow-up: star/note on
-- another household member's expense. Run this in the Supabase SQL editor
-- AFTER add_household_expense_link.sql.
--
-- Two kinds in one table, not two tables: a 'star' row is a private personal
-- bookmark (only its author can ever see it, even via direct API access —
-- not just hidden in the UI); a 'note' row is a message to the expense's
-- owner (visible to both the author and the owner). Single table with a
-- `kind` discriminator + one RLS policy that treats each kind differently
-- achieves true per-kind visibility without needing two tables.

create table if not exists expense_annotations (
  id              text        primary key,
  expense_id      text        not null references expenses(id) on delete cascade,
  author_user_id  uuid        not null references auth.users(id) on delete cascade,
  kind            text        not null check (kind in ('star','note')),
  note            text,
  updated_at      timestamptz default now(),
  created_at      timestamptz default now(),
  unique (expense_id, author_user_id, kind)
);

alter table expense_annotations enable row level security;

drop policy if exists "See own annotations, or notes on my own expenses" on expense_annotations;
drop policy if exists "Insert own annotations"                          on expense_annotations;
drop policy if exists "Update own annotations"                          on expense_annotations;
drop policy if exists "Delete own annotations"                          on expense_annotations;

-- The star/note visibility split lives here: author always sees their own
-- row (covers stars); the owner additionally sees 'note' rows (never
-- 'star' rows) left on expenses they own.
create policy "See own annotations, or notes on my own expenses" on expense_annotations for select using (
  author_user_id = auth.uid()
  or (kind = 'note' and exists (select 1 from expenses e where e.id = expense_id and e.user_id = auth.uid()))
);
create policy "Insert own annotations" on expense_annotations for insert with check (author_user_id = auth.uid());
create policy "Update own annotations" on expense_annotations for update using (author_user_id = auth.uid());
create policy "Delete own annotations" on expense_annotations for delete using (author_user_id = auth.uid());

do $$ begin
  alter publication supabase_realtime add table expense_annotations;
exception when duplicate_object then null;
end $$;

notify pgrst, 'reload schema';
