-- Migration: Add WhatsApp support and Unit Status system
-- Date: 2025-12-10

-- 1. Add WhatsApp as a platform option
-- Update platform_accounts table check constraint
ALTER TABLE public.platform_accounts 
  DROP CONSTRAINT IF EXISTS platform_accounts_platform_check;

ALTER TABLE public.platform_accounts 
  ADD CONSTRAINT platform_accounts_platform_check 
  CHECK (platform IN ('airbnb', 'gathern', 'whatsapp'));

-- Update reservations table check constraint
ALTER TABLE public.reservations 
  DROP CONSTRAINT IF EXISTS reservations_platform_check;

ALTER TABLE public.reservations 
  ADD CONSTRAINT reservations_platform_check 
  CHECK (platform IN ('airbnb', 'gathern', 'whatsapp'));

-- Update unit_calendars table check constraint
ALTER TABLE public.unit_calendars 
  DROP CONSTRAINT IF EXISTS unit_calendars_platform_check;

ALTER TABLE public.unit_calendars 
  ADD CONSTRAINT unit_calendars_platform_check 
  CHECK (platform IN ('airbnb', 'gathern', 'whatsapp'));

-- 2. Create Unit Status table for tracking readiness
CREATE TABLE IF NOT EXISTS public.unit_status (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN (
    'checkout_today',           -- خروج اليوم
    'checkin_today',            -- دخول اليوم
    'guest_not_checked_out',    -- الضيف لم يخرج
    'awaiting_cleaning',        -- في انتظار التنظيف
    'cleaning_in_progress',     -- قيد التنظيف
    'ready',                    -- جاهزة للتسكين
    'occupied'                  -- تم التسكين
  )),
  checkout_date DATE,           -- تاريخ الخروج المتوقع
  checkin_date DATE,            -- تاريخ الدخول المتوقع
  guest_name TEXT,              -- اسم الضيف الحالي/القادم
  notes TEXT,                   -- ملاحظات
  updated_by UUID REFERENCES public.users(id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_unit_status_unit_id ON public.unit_status(unit_id);
CREATE INDEX IF NOT EXISTS idx_unit_status_status ON public.unit_status(status);
CREATE INDEX IF NOT EXISTS idx_unit_status_checkout_date ON public.unit_status(checkout_date);
CREATE INDEX IF NOT EXISTS idx_unit_status_checkin_date ON public.unit_status(checkin_date);

-- 3. Create function to automatically update unit status based on reservations
CREATE OR REPLACE FUNCTION public.update_unit_status_from_reservations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- For units with checkout today
  INSERT INTO public.unit_status (unit_id, status, checkout_date)
  SELECT DISTINCT r.unit_id, 'checkout_today', r.end_date
  FROM public.reservations r
  WHERE r.end_date = CURRENT_DATE
  ON CONFLICT (unit_id) DO UPDATE
  SET status = 'checkout_today',
      checkout_date = EXCLUDED.checkout_date,
      updated_at = NOW();

  -- For units with checkin today
  INSERT INTO public.unit_status (unit_id, status, checkin_date)
  SELECT DISTINCT r.unit_id, 'checkin_today', r.start_date
  FROM public.reservations r
  WHERE r.start_date = CURRENT_DATE
  ON CONFLICT (unit_id) DO UPDATE
  SET status = 'checkin_today',
      checkin_date = EXCLUDED.checkin_date,
      updated_at = NOW();

  -- For occupied units
  INSERT INTO public.unit_status (unit_id, status)
  SELECT DISTINCT r.unit_id, 'occupied'
  FROM public.reservations r
  WHERE r.start_date <= CURRENT_DATE AND r.end_date > CURRENT_DATE
  ON CONFLICT (unit_id) DO UPDATE
  SET status = 'occupied',
      updated_at = NOW();
END;
$$;

-- 4. RLS Policies for unit_status
ALTER TABLE public.unit_status ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read unit status
CREATE POLICY "unit_status_select_policy" ON public.unit_status
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Allow admins and staff to update unit status
CREATE POLICY "unit_status_update_policy" ON public.unit_status
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role IN ('super_admin', 'admin')
      AND users.is_active = true
    )
  );

-- Allow admins and staff to insert unit status
CREATE POLICY "unit_status_insert_policy" ON public.unit_status
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role IN ('super_admin', 'admin')
      AND users.is_active = true
    )
  );

-- Allow admins to delete unit status
CREATE POLICY "unit_status_delete_policy" ON public.unit_status
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role IN ('super_admin', 'admin')
      AND users.is_active = true
    )
  );

-- 5. Add unique constraint to ensure one status per unit
ALTER TABLE public.unit_status 
  ADD CONSTRAINT unit_status_unit_id_unique UNIQUE (unit_id);

-- 6. Insert initial status for existing units
INSERT INTO public.unit_status (unit_id, status)
SELECT id, 'ready' FROM public.units
ON CONFLICT (unit_id) DO NOTHING;

-- 7. Comment tables
COMMENT ON TABLE public.unit_status IS 'Tracks the current status and readiness of each unit';
COMMENT ON COLUMN public.unit_status.status IS 'Current status: checkout_today, checkin_today, guest_not_checked_out, awaiting_cleaning, cleaning_in_progress, ready, occupied';

