-- Personalization epic (V8) — generic asset-tagging columns on expenses.
-- Run this in the Supabase SQL editor to add multi-asset tracking (Phase 0).
--
-- asset_type/asset_id let any expense link to any future "personal asset"
-- (vehicle, credit card, house, phone, ...) without adding a new column to
-- expenses for every asset type. No FK constraint — matches the existing
-- no-FK precedent used for trips-to-expenses date matching.

alter table expenses
  add column if not exists asset_type text,
  add column if not exists asset_id   text;
