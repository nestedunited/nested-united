-- Migration: Investor accounts + Unit platform links + Bookings table
-- Date: 2025-12-10

-- 1) Allow "general" on platform_accounts to represent investor/general accounts
ALTER TABLE public.platform_accounts
  DROP CONSTRAINT IF EXISTS platform_accounts_platform_check;

ALTER TABLE public.platform_accounts
  ADD CONSTRAINT platform_accounts_platform_check
  CHECK (platform IN ('airbnb', 'gathern', 'whatsapp', 'general'));

-- 2) Unit platform links (a unit can exist on multiple platforms)
CREATE TABLE IF NOT EXISTS public.unit_platforms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('airbnb', 'gathern')),
  listing_code TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_unit_platforms_unit_platform
  ON public.unit_platforms(unit_id, platform);

-- 3) Bookings table
CREATE TABLE IF NOT EXISTS public.bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  platform_account_id UUID REFERENCES public.platform_accounts(id) ON DELETE SET NULL,
  platform TEXT CHECK (platform IN ('airbnb', 'gathern', 'whatsapp', 'manual', 'unknown')),
  guest_name TEXT NOT NULL,
  phone TEXT,
  checkin_date DATE NOT NULL,
  checkout_date DATE NOT NULL,
  amount NUMERIC(12,2) DEFAULT 0,
  currency TEXT DEFAULT 'SAR',
  notes TEXT,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bookings_unit_id ON public.bookings(unit_id);
CREATE INDEX IF NOT EXISTS idx_bookings_platform_account_id ON public.bookings(platform_account_id);
CREATE INDEX IF NOT EXISTS idx_bookings_dates ON public.bookings(checkin_date, checkout_date);

-- Optional: disable RLS to avoid access issues (align with previous choice)
ALTER TABLE public.unit_platforms DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings DISABLE ROW LEVEL SECURITY;

