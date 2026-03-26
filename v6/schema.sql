-- ─── DROP EXISTING ──────────────────────────────────────
drop table if exists goal_contributions cascade;
drop table if exists goals cascade;
drop table if exists budgets cascade;
drop table if exists income cascade;
drop table if exists expenses cascade;

-- ─── EXPENSES ───────────────────────────────────────────
create table expenses (
  id                  text        primary key,
  user_id             uuid        not null references auth.users(id) on delete cascade,
  date                date        not null,
  description         text        not null,
  amount              numeric     not null,
  currency            text        not null default 'INR',
  conversion_rate     numeric     not null default 1,
  amount_inr          numeric     not null,
  category            text,
  subcategory         text,
  expense_type        text,
  payment_method      text,
  payment_description text,
  dining_app          text,
  tags                text[]      default '{}',
  notes               text,
  custom_color        text,
  budget_category     text,
  is_recurring        boolean     default false,
  recurring_period    text,
  next_due_date       date,
  split_with          text,
  split_parts         int         default 1,
  receipt_ref         text,
  fingerprint         text,
  migrated_from       text,
  imported_from       text,
  created_at          timestamptz default now()
);

alter table expenses enable row level security;

create policy "Users see own expenses"
  on expenses for select using (auth.uid() = user_id);
create policy "Users insert own expenses"
  on expenses for insert with check (auth.uid() = user_id);
create policy "Users update own expenses"
  on expenses for update using (auth.uid() = user_id);
create policy "Users delete own expenses"
  on expenses for delete using (auth.uid() = user_id);


-- ─── INCOME ─────────────────────────────────────────────
create table income (
  id                 text        primary key,
  user_id            uuid        not null references auth.users(id) on delete cascade,
  date               date        not null,
  description        text        not null,
  amount             numeric     not null,
  currency           text        not null default 'INR',
  conversion_rate    numeric     not null default 1,
  amount_inr         numeric     not null,
  source             text,
  payment_method     text,
  notes              text,
  is_recurring       boolean     default false,
  recurring_period   text,
  fingerprint        text,
  migrated_from      text,
  imported_from      text,
  created_at         timestamptz default now()
);

alter table income enable row level security;

create policy "Users see own income"
  on income for select using (auth.uid() = user_id);
create policy "Users insert own income"
  on income for insert with check (auth.uid() = user_id);
create policy "Users update own income"
  on income for update using (auth.uid() = user_id);
create policy "Users delete own income"
  on income for delete using (auth.uid() = user_id);


-- ─── BUDGETS ────────────────────────────────────────────
create table budgets (
  user_id    uuid        primary key references auth.users(id) on delete cascade,
  daily      numeric     default 0,
  weekly     numeric     default 0,
  monthly    numeric     default 0,
  categories jsonb       default '{}',
  updated_at timestamptz default now()
);

alter table budgets enable row level security;

create policy "Users see own budgets"
  on budgets for select using (auth.uid() = user_id);
create policy "Users upsert own budgets"
  on budgets for insert with check (auth.uid() = user_id);
create policy "Users update own budgets"
  on budgets for update using (auth.uid() = user_id);


-- ─── GOALS ──────────────────────────────────────────────
create table goals (
  id          text    primary key,
  user_id     uuid    not null references auth.users(id) on delete cascade,
  name        text    not null,
  target      numeric not null,
  target_date date,
  icon        text    default '🎯',
  note        text,
  created_at  date    default current_date
);

alter table goals enable row level security;

create policy "Users see own goals"
  on goals for select using (auth.uid() = user_id);
create policy "Users insert own goals"
  on goals for insert with check (auth.uid() = user_id);
create policy "Users update own goals"
  on goals for update using (auth.uid() = user_id);
create policy "Users delete own goals"
  on goals for delete using (auth.uid() = user_id);


-- ─── GOAL CONTRIBUTIONS ─────────────────────────────────
create table goal_contributions (
  id         text        primary key,
  goal_id    text        not null references goals(id) on delete cascade,
  user_id    uuid        not null references auth.users(id) on delete cascade,
  date       date        not null,
  amount     numeric     not null,
  note       text,
  created_at timestamptz default now()
);

alter table goal_contributions enable row level security;

create policy "Users see own contributions"
  on goal_contributions for select using (auth.uid() = user_id);
create policy "Users insert own contributions"
  on goal_contributions for insert with check (auth.uid() = user_id);
create policy "Users delete own contributions"
  on goal_contributions for delete using (auth.uid() = user_id);
