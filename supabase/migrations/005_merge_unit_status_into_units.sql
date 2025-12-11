-- Migration: Merge unit_status data into units (inline readiness fields)
-- Date: 2025-12-10

-- 1) Add readiness fields directly on units
ALTER TABLE public.units
  ADD COLUMN IF NOT EXISTS readiness_status TEXT NOT NULL DEFAULT 'ready',
  ADD COLUMN IF NOT EXISTS readiness_checkout_date DATE,
  ADD COLUMN IF NOT EXISTS readiness_checkin_date DATE,
  ADD COLUMN IF NOT EXISTS readiness_guest_name TEXT,
  ADD COLUMN IF NOT EXISTS readiness_notes TEXT,
  ADD COLUMN IF NOT EXISTS readiness_updated_by UUID REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS readiness_updated_at TIMESTAMPTZ DEFAULT NOW();

-- 2) Migrate existing data from unit_status (if present)
INSERT INTO public.units AS u (
  id,
  readiness_status,
  readiness_checkout_date,
  readiness_checkin_date,
  readiness_guest_name,
  readiness_notes,
  readiness_updated_by,
  readiness_updated_at
)
SELECT
  s.unit_id,
  s.status,
  s.checkout_date,
  s.checkin_date,
  s.guest_name,
  s.notes,
  s.updated_by,
  s.updated_at
FROM public.unit_status s
ON CONFLICT (id) DO UPDATE SET
  readiness_status = EXCLUDED.readiness_status,
  readiness_checkout_date = EXCLUDED.readiness_checkout_date,
  readiness_checkin_date = EXCLUDED.readiness_checkin_date,
  readiness_guest_name = EXCLUDED.readiness_guest_name,
  readiness_notes = EXCLUDED.readiness_notes,
  readiness_updated_by = EXCLUDED.readiness_updated_by,
  readiness_updated_at = EXCLUDED.readiness_updated_at;

-- 3) (Optional) Disable RLS on units if still enabled
ALTER TABLE public.units DISABLE ROW LEVEL SECURITY;

-- 4) (Optional) Drop unit_status table if you no longer need it
-- DROP TABLE IF EXISTS public.unit_status;

