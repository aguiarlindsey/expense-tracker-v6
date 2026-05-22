-- Phase 6.2: Budget Rollover
-- Adds rollover_enabled JSONB column to budgets table
-- Maps category name → boolean (true = unused budget carries to next month)
-- Run once in Supabase SQL editor

ALTER TABLE budgets
  ADD COLUMN IF NOT EXISTS rollover_enabled JSONB DEFAULT '{}'::jsonb;
