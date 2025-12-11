-- =====================================================
-- Rentals Dashboard Database Schema
-- =====================================================
-- This schema supports a multi-platform rental management system
-- with users, units, calendars, reservations, maintenance, and notifications

-- =====================================================
-- EXTENSIONS
-- =====================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- =====================================================
-- TABLES
-- =====================================================

-- Users Table (extends auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('super_admin', 'admin')),
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Platform Accounts Table
CREATE TABLE IF NOT EXISTS public.platform_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  platform TEXT NOT NULL CHECK (platform IN ('airbnb', 'gathern')),
  account_name TEXT NOT NULL,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES public.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Units Table
CREATE TABLE IF NOT EXISTS public.units (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  platform_account_id UUID NOT NULL REFERENCES public.platform_accounts(id) ON DELETE CASCADE,
  unit_name TEXT NOT NULL,
  unit_code TEXT,
  city TEXT,
  address TEXT,
  capacity INTEGER,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_synced_at TIMESTAMP WITH TIME ZONE
);

-- Unit Calendars Table (iCal URLs)
CREATE TABLE IF NOT EXISTS public.unit_calendars (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('airbnb', 'gathern')),
  ical_url TEXT NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(unit_id, platform)
);

-- Reservations Table
CREATE TABLE IF NOT EXISTS public.reservations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('airbnb', 'gathern')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  summary TEXT,
  raw_event JSONB,
  last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(unit_id, platform, start_date, end_date)
);

-- Maintenance Tickets Table
CREATE TABLE IF NOT EXISTS public.maintenance_tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved')),
  priority TEXT CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  created_by UUID NOT NULL REFERENCES public.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE
);

-- Notifications Table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL CHECK (type IN ('booking_created', 'booking_updated', 'booking_cancelled', 'maintenance_created', 'maintenance_status_changed', 'unit_activated', 'unit_deactivated')),
  unit_id UUID REFERENCES public.units(id) ON DELETE CASCADE,
  platform TEXT CHECK (platform IN ('airbnb', 'gathern')),
  maintenance_ticket_id UUID REFERENCES public.maintenance_tickets(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB,
  audience TEXT NOT NULL DEFAULT 'all_admins' CHECK (audience IN ('all_admins', 'all_super_admins', 'all_users')),
  recipient_user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sync Logs Table
CREATE TABLE IF NOT EXISTS public.sync_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT NOT NULL CHECK (status IN ('success', 'partial', 'failed')),
  message TEXT,
  units_processed INTEGER DEFAULT 0,
  errors_count INTEGER DEFAULT 0,
  details JSONB
);

-- =====================================================
-- INDEXES
-- =====================================================

-- Users indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON public.users(is_active);

-- Platform accounts indexes
CREATE INDEX IF NOT EXISTS idx_platform_accounts_platform ON public.platform_accounts(platform);
CREATE INDEX IF NOT EXISTS idx_platform_accounts_created_by ON public.platform_accounts(created_by);

-- Units indexes
CREATE INDEX IF NOT EXISTS idx_units_platform_account_id ON public.units(platform_account_id);
CREATE INDEX IF NOT EXISTS idx_units_city ON public.units(city);
CREATE INDEX IF NOT EXISTS idx_units_status ON public.units(status);

-- Reservations indexes
CREATE INDEX IF NOT EXISTS idx_reservations_unit_id ON public.reservations(unit_id);
CREATE INDEX IF NOT EXISTS idx_reservations_platform ON public.reservations(platform);
CREATE INDEX IF NOT EXISTS idx_reservations_dates ON public.reservations(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_reservations_start_date ON public.reservations(start_date);

-- Maintenance tickets indexes
CREATE INDEX IF NOT EXISTS idx_maintenance_unit_id ON public.maintenance_tickets(unit_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_status ON public.maintenance_tickets(status);
CREATE INDEX IF NOT EXISTS idx_maintenance_priority ON public.maintenance_tickets(priority);
CREATE INDEX IF NOT EXISTS idx_maintenance_created_by ON public.maintenance_tickets(created_by);

-- Notifications indexes
CREATE INDEX IF NOT EXISTS idx_notifications_unit_id ON public.notifications(unit_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON public.notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON public.notifications(recipient_user_id);

-- Sync logs indexes
CREATE INDEX IF NOT EXISTS idx_sync_logs_run_at ON public.sync_logs(run_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_logs_status ON public.sync_logs(status);

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unit_calendars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_logs ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user's role
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Helper function to check if user is active
CREATE OR REPLACE FUNCTION public.is_user_active()
RETURNS BOOLEAN AS $$
  SELECT is_active FROM public.users WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Users table policies
CREATE POLICY "Super admins can view all users"
  ON public.users FOR SELECT
  USING (public.get_user_role() = 'super_admin');

CREATE POLICY "Users can view their own record"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Super admins can insert users"
  ON public.users FOR INSERT
  WITH CHECK (public.get_user_role() = 'super_admin');

CREATE POLICY "Super admins can update users"
  ON public.users FOR UPDATE
  USING (public.get_user_role() = 'super_admin');

CREATE POLICY "Super admins can delete users"
  ON public.users FOR DELETE
  USING (public.get_user_role() = 'super_admin');

-- Platform accounts policies
CREATE POLICY "Authenticated users can view platform accounts"
  ON public.platform_accounts FOR SELECT
  USING (public.is_user_active() = true);

CREATE POLICY "Admins and super admins can insert platform accounts"
  ON public.platform_accounts FOR INSERT
  WITH CHECK (public.get_user_role() IN ('admin', 'super_admin'));

CREATE POLICY "Admins and super admins can update platform accounts"
  ON public.platform_accounts FOR UPDATE
  USING (public.get_user_role() IN ('admin', 'super_admin'));

CREATE POLICY "Admins and super admins can delete platform accounts"
  ON public.platform_accounts FOR DELETE
  USING (public.get_user_role() IN ('admin', 'super_admin'));

-- Units policies
CREATE POLICY "Authenticated users can view units"
  ON public.units FOR SELECT
  USING (public.is_user_active() = true);

CREATE POLICY "Admins and super admins can insert units"
  ON public.units FOR INSERT
  WITH CHECK (public.get_user_role() IN ('admin', 'super_admin'));

CREATE POLICY "Admins and super admins can update units"
  ON public.units FOR UPDATE
  USING (public.get_user_role() IN ('admin', 'super_admin'));

CREATE POLICY "Admins and super admins can delete units"
  ON public.units FOR DELETE
  USING (public.get_user_role() IN ('admin', 'super_admin'));

-- Unit calendars policies
CREATE POLICY "Authenticated users can view unit calendars"
  ON public.unit_calendars FOR SELECT
  USING (public.is_user_active() = true);

CREATE POLICY "Admins and super admins can manage unit calendars"
  ON public.unit_calendars FOR ALL
  USING (public.get_user_role() IN ('admin', 'super_admin'));

-- Reservations policies
CREATE POLICY "Authenticated users can view reservations"
  ON public.reservations FOR SELECT
  USING (public.is_user_active() = true);

CREATE POLICY "System can manage reservations"
  ON public.reservations FOR ALL
  USING (true);

-- Maintenance tickets policies
CREATE POLICY "Authenticated users can view maintenance tickets"
  ON public.maintenance_tickets FOR SELECT
  USING (public.is_user_active() = true);

CREATE POLICY "Admins and super admins can create maintenance tickets"
  ON public.maintenance_tickets FOR INSERT
  WITH CHECK (public.get_user_role() IN ('admin', 'super_admin'));

CREATE POLICY "Admins and super admins can update maintenance tickets"
  ON public.maintenance_tickets FOR UPDATE
  USING (public.get_user_role() IN ('admin', 'super_admin'));

CREATE POLICY "Super admins can delete maintenance tickets"
  ON public.maintenance_tickets FOR DELETE
  USING (public.get_user_role() = 'super_admin');

-- Notifications policies
CREATE POLICY "Users can view notifications meant for them"
  ON public.notifications FOR SELECT
  USING (
    public.is_user_active() = true AND (
      audience = 'all_users' OR
      (audience = 'all_admins' AND public.get_user_role() IN ('admin', 'super_admin')) OR
      (audience = 'all_super_admins' AND public.get_user_role() = 'super_admin') OR
      recipient_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own notification read status"
  ON public.notifications FOR UPDATE
  USING (
    recipient_user_id = auth.uid() OR
    (audience IN ('all_admins', 'all_users', 'all_super_admins'))
  )
  WITH CHECK (
    recipient_user_id = auth.uid() OR
    (audience IN ('all_admins', 'all_users', 'all_super_admins'))
  );

CREATE POLICY "System can create notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (true);

-- Sync logs policies
CREATE POLICY "Authenticated users can view sync logs"
  ON public.sync_logs FOR SELECT
  USING (public.is_user_active() = true);

CREATE POLICY "System can create sync logs"
  ON public.sync_logs FOR INSERT
  WITH CHECK (true);

-- =====================================================
-- FUNCTIONS & TRIGGERS
-- =====================================================

-- Function to create notification when maintenance ticket is created
CREATE OR REPLACE FUNCTION public.notify_maintenance_created()
RETURNS TRIGGER AS $$
DECLARE
  unit_name_var TEXT;
BEGIN
  SELECT unit_name INTO unit_name_var FROM public.units WHERE id = NEW.unit_id;
  
  INSERT INTO public.notifications (
    type,
    unit_id,
    maintenance_ticket_id,
    title,
    body,
    data,
    audience
  ) VALUES (
    'maintenance_created',
    NEW.unit_id,
    NEW.id,
    'تذكرة صيانة جديدة',
    'تم إنشاء تذكرة صيانة جديدة للوحدة: ' || unit_name_var,
    jsonb_build_object(
      'ticket_id', NEW.id,
      'unit_id', NEW.unit_id,
      'priority', NEW.priority,
      'status', NEW.status
    ),
    'all_admins'
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create notification when maintenance status changes
CREATE OR REPLACE FUNCTION public.notify_maintenance_status_changed()
RETURNS TRIGGER AS $$
DECLARE
  unit_name_var TEXT;
  status_text TEXT;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    SELECT unit_name INTO unit_name_var FROM public.units WHERE id = NEW.unit_id;
    
    status_text := CASE NEW.status
      WHEN 'open' THEN 'مفتوحة'
      WHEN 'in_progress' THEN 'قيد التنفيذ'
      WHEN 'resolved' THEN 'محلولة'
      ELSE NEW.status
    END;
    
    INSERT INTO public.notifications (
      type,
      unit_id,
      maintenance_ticket_id,
      title,
      body,
      data,
      audience
    ) VALUES (
      'maintenance_status_changed',
      NEW.unit_id,
      NEW.id,
      'تحديث حالة الصيانة',
      'تم تغيير حالة تذكرة الصيانة للوحدة ' || unit_name_var || ' إلى: ' || status_text,
      jsonb_build_object(
        'ticket_id', NEW.id,
        'unit_id', NEW.unit_id,
        'old_status', OLD.status,
        'new_status', NEW.status
      ),
      'all_admins'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Triggers for maintenance notifications
CREATE TRIGGER trigger_notify_maintenance_created
  AFTER INSERT ON public.maintenance_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_maintenance_created();

CREATE TRIGGER trigger_notify_maintenance_status_changed
  AFTER UPDATE ON public.maintenance_tickets
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.notify_maintenance_status_changed();

-- =====================================================
-- INITIAL DATA (Example Super Admin)
-- =====================================================
-- Note: You must create the auth user first in Supabase Auth dashboard
-- Then uncomment and run this with the correct UUID:
-- INSERT INTO public.users (id, email, role, name, is_active)
-- VALUES ('your-auth-user-uuid', 'admin@example.com', 'super_admin', 'Super Admin', true);

-- =====================================================
-- ENABLE REALTIME
-- =====================================================
-- Enable realtime for notifications table
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;




