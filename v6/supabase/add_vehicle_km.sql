-- Vehicle service KM tracking columns
ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS vehicle_km_at_service   integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS vehicle_next_service_km integer DEFAULT NULL;
