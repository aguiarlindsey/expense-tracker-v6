-- v7.8.0: Row versioning for optimistic concurrency control
-- Run in Supabase SQL editor

-- Add row_version + updated_at to core editable tables

ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS row_version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS updated_at  TIMESTAMPTZ DEFAULT now();

ALTER TABLE income
  ADD COLUMN IF NOT EXISTS row_version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS updated_at  TIMESTAMPTZ DEFAULT now();

ALTER TABLE trips
  ADD COLUMN IF NOT EXISTS row_version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS updated_at  TIMESTAMPTZ DEFAULT now();

ALTER TABLE goals
  ADD COLUMN IF NOT EXISTS row_version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS updated_at  TIMESTAMPTZ DEFAULT now();

-- Auto-increment row_version + stamp updated_at on every UPDATE

CREATE OR REPLACE FUNCTION bump_row_version()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.row_version := OLD.row_version + 1;
  NEW.updated_at  := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bump_row_version_expenses ON expenses;
CREATE TRIGGER trg_bump_row_version_expenses
  BEFORE UPDATE ON expenses
  FOR EACH ROW EXECUTE FUNCTION bump_row_version();

DROP TRIGGER IF EXISTS trg_bump_row_version_income ON income;
CREATE TRIGGER trg_bump_row_version_income
  BEFORE UPDATE ON income
  FOR EACH ROW EXECUTE FUNCTION bump_row_version();

DROP TRIGGER IF EXISTS trg_bump_row_version_trips ON trips;
CREATE TRIGGER trg_bump_row_version_trips
  BEFORE UPDATE ON trips
  FOR EACH ROW EXECUTE FUNCTION bump_row_version();

DROP TRIGGER IF EXISTS trg_bump_row_version_goals ON goals;
CREATE TRIGGER trg_bump_row_version_goals
  BEFORE UPDATE ON goals
  FOR EACH ROW EXECUTE FUNCTION bump_row_version();
