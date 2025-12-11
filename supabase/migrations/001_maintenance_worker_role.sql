-- =====================================================
-- Migration: Add Maintenance Worker Role
-- =====================================================

-- Step 1: Update users table to allow maintenance_worker role
ALTER TABLE public.users 
DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE public.users 
ADD CONSTRAINT users_role_check 
CHECK (role IN ('super_admin', 'admin', 'maintenance_worker'));

-- Step 2: Add new columns to maintenance_tickets
ALTER TABLE public.maintenance_tickets
ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES public.users(id),
ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS worker_notes TEXT;

-- Add index for assigned_to
CREATE INDEX IF NOT EXISTS idx_maintenance_assigned_to ON public.maintenance_tickets(assigned_to);

-- Step 3: Update helper function to include maintenance_worker
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Step 4: Update RLS policies for maintenance_worker

-- Drop old maintenance policies
DROP POLICY IF EXISTS "Authenticated users can view maintenance tickets" ON public.maintenance_tickets;
DROP POLICY IF EXISTS "Admins and super admins can create maintenance tickets" ON public.maintenance_tickets;
DROP POLICY IF EXISTS "Admins and super admins can update maintenance tickets" ON public.maintenance_tickets;

-- New policies for maintenance tickets

-- All active users can view tickets (maintenance workers see all to pick up)
CREATE POLICY "Active users can view maintenance tickets"
  ON public.maintenance_tickets FOR SELECT
  USING (public.is_user_active() = true);

-- Admins and super admins can create tickets
CREATE POLICY "Admins can create maintenance tickets"
  ON public.maintenance_tickets FOR INSERT
  WITH CHECK (public.get_user_role() IN ('admin', 'super_admin'));

-- Admins can update any ticket, workers can only update assigned tickets
CREATE POLICY "Users can update maintenance tickets based on role"
  ON public.maintenance_tickets FOR UPDATE
  USING (
    public.get_user_role() IN ('admin', 'super_admin') OR
    (public.get_user_role() = 'maintenance_worker' AND assigned_to = auth.uid())
  );

-- Step 5: Update notifications policy to include maintenance_worker for relevant notifications
DROP POLICY IF EXISTS "Users can view notifications meant for them" ON public.notifications;

CREATE POLICY "Users can view notifications meant for them"
  ON public.notifications FOR SELECT
  USING (
    public.is_user_active() = true AND (
      audience = 'all_users' OR
      (audience = 'all_admins' AND public.get_user_role() IN ('admin', 'super_admin')) OR
      (audience = 'all_super_admins' AND public.get_user_role() = 'super_admin') OR
      (audience = 'maintenance_workers' AND public.get_user_role() = 'maintenance_worker') OR
      recipient_user_id = auth.uid()
    )
  );

-- Update notifications check constraint to include maintenance_workers audience
ALTER TABLE public.notifications 
DROP CONSTRAINT IF EXISTS notifications_audience_check;

ALTER TABLE public.notifications 
ADD CONSTRAINT notifications_audience_check 
CHECK (audience IN ('all_admins', 'all_super_admins', 'all_users', 'maintenance_workers'));

-- Step 6: Function to notify when ticket is assigned to worker
CREATE OR REPLACE FUNCTION public.notify_maintenance_assigned()
RETURNS TRIGGER AS $$
DECLARE
  unit_name_var TEXT;
  worker_name_var TEXT;
BEGIN
  IF NEW.assigned_to IS NOT NULL AND (OLD.assigned_to IS NULL OR OLD.assigned_to != NEW.assigned_to) THEN
    SELECT unit_name INTO unit_name_var FROM public.units WHERE id = NEW.unit_id;
    SELECT name INTO worker_name_var FROM public.users WHERE id = NEW.assigned_to;
    
    -- Notify the assigned worker
    INSERT INTO public.notifications (
      type,
      unit_id,
      maintenance_ticket_id,
      title,
      body,
      data,
      recipient_user_id
    ) VALUES (
      'maintenance_status_changed',
      NEW.unit_id,
      NEW.id,
      'تذكرة صيانة جديدة لك',
      'تم تعيين تذكرة صيانة للوحدة: ' || unit_name_var || ' إليك',
      jsonb_build_object(
        'ticket_id', NEW.id,
        'unit_id', NEW.unit_id,
        'priority', NEW.priority
      ),
      NEW.assigned_to
    );
    
    -- Notify admins about the assignment
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
      'تم تعيين تذكرة صيانة',
      'تم تعيين تذكرة صيانة للوحدة ' || unit_name_var || ' إلى العامل: ' || worker_name_var,
      jsonb_build_object(
        'ticket_id', NEW.id,
        'unit_id', NEW.unit_id,
        'worker_id', NEW.assigned_to,
        'worker_name', worker_name_var
      ),
      'all_admins'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for assignment notification
DROP TRIGGER IF EXISTS trigger_notify_maintenance_assigned ON public.maintenance_tickets;
CREATE TRIGGER trigger_notify_maintenance_assigned
  AFTER UPDATE ON public.maintenance_tickets
  FOR EACH ROW
  WHEN (OLD.assigned_to IS DISTINCT FROM NEW.assigned_to)
  EXECUTE FUNCTION public.notify_maintenance_assigned();

-- Step 7: Function to notify when worker accepts ticket
CREATE OR REPLACE FUNCTION public.notify_maintenance_accepted()
RETURNS TRIGGER AS $$
DECLARE
  unit_name_var TEXT;
  worker_name_var TEXT;
BEGIN
  IF NEW.accepted_at IS NOT NULL AND OLD.accepted_at IS NULL THEN
    SELECT unit_name INTO unit_name_var FROM public.units WHERE id = NEW.unit_id;
    SELECT name INTO worker_name_var FROM public.users WHERE id = NEW.assigned_to;
    
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
      'تم قبول تذكرة الصيانة',
      'قبل العامل ' || worker_name_var || ' تذكرة الصيانة للوحدة: ' || unit_name_var,
      jsonb_build_object(
        'ticket_id', NEW.id,
        'unit_id', NEW.unit_id,
        'worker_id', NEW.assigned_to,
        'worker_name', worker_name_var,
        'accepted_at', NEW.accepted_at
      ),
      'all_admins'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for acceptance notification
DROP TRIGGER IF EXISTS trigger_notify_maintenance_accepted ON public.maintenance_tickets;
CREATE TRIGGER trigger_notify_maintenance_accepted
  AFTER UPDATE ON public.maintenance_tickets
  FOR EACH ROW
  WHEN (OLD.accepted_at IS NULL AND NEW.accepted_at IS NOT NULL)
  EXECUTE FUNCTION public.notify_maintenance_accepted();


