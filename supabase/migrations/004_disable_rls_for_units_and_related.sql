-- Migration: Disable RLS on units-related tables (per user request)
-- Date: 2025-12-10
--
-- This disables row-level security on the tables used by the unit details
-- and readiness pages to avoid access issues during development/ops.

-- Disable RLS on core tables
ALTER TABLE public.units DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_accounts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_tickets DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.unit_status DISABLE ROW LEVEL SECURITY;

-- Optional: cleanup restrictive policies if needed (keep commented by default)
-- DROP POLICY IF EXISTS "Authenticated users can view units" ON public.units;
-- DROP POLICY IF EXISTS "Authenticated users can view platform accounts" ON public.platform_accounts;
-- DROP POLICY IF EXISTS "Authenticated users can view reservations" ON public.reservations;
-- DROP POLICY IF EXISTS "Authenticated users can view maintenance tickets" ON public.maintenance_tickets;
-- DROP POLICY IF EXISTS "unit_status_select_policy" ON public.unit_status;

