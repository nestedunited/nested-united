-- =====================================================
-- Migration: Browser Accounts for WebViews
-- =====================================================

-- Table for platform browser accounts (WebViews in Electron)
CREATE TABLE IF NOT EXISTS public.browser_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  platform TEXT NOT NULL CHECK (platform IN ('airbnb', 'gathern')),
  account_name TEXT NOT NULL,
  account_email TEXT,
  notes TEXT,
  -- Link to platform_account (ONE-TO-ONE relationship - each platform account can only have ONE browser account)
  platform_account_id UUID UNIQUE REFERENCES public.platform_accounts(id) ON DELETE SET NULL,
  -- Session partition name for Electron (unique per account)
  session_partition TEXT NOT NULL UNIQUE,
  -- Last notification detection
  last_notification_at TIMESTAMP WITH TIME ZONE,
  has_unread_notifications BOOLEAN NOT NULL DEFAULT false,
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL REFERENCES public.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_browser_accounts_platform ON public.browser_accounts(platform);
CREATE INDEX IF NOT EXISTS idx_browser_accounts_is_active ON public.browser_accounts(is_active);
CREATE INDEX IF NOT EXISTS idx_browser_accounts_has_unread ON public.browser_accounts(has_unread_notifications);

-- Enable RLS
ALTER TABLE public.browser_accounts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Active users can view browser accounts"
  ON public.browser_accounts FOR SELECT
  USING (public.is_user_active() = true);

CREATE POLICY "Admins can manage browser accounts"
  ON public.browser_accounts FOR ALL
  USING (public.get_user_role() IN ('admin', 'super_admin'));

-- Table for browser notification logs
CREATE TABLE IF NOT EXISTS public.browser_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  browser_account_id UUID NOT NULL REFERENCES public.browser_accounts(id) ON DELETE CASCADE,
  detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notification_type TEXT, -- 'message', 'booking', 'review', etc.
  is_acknowledged BOOLEAN NOT NULL DEFAULT false,
  acknowledged_by UUID REFERENCES public.users(id),
  acknowledged_at TIMESTAMP WITH TIME ZONE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_browser_notifications_account ON public.browser_notifications(browser_account_id);
CREATE INDEX IF NOT EXISTS idx_browser_notifications_detected ON public.browser_notifications(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_browser_notifications_ack ON public.browser_notifications(is_acknowledged);

-- Enable RLS
ALTER TABLE public.browser_notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Active users can view browser notifications"
  ON public.browser_notifications FOR SELECT
  USING (public.is_user_active() = true);

CREATE POLICY "Active users can update browser notifications"
  ON public.browser_notifications FOR UPDATE
  USING (public.is_user_active() = true);

CREATE POLICY "System can insert browser notifications"
  ON public.browser_notifications FOR INSERT
  WITH CHECK (true);

-- Function to create dashboard notification when browser notification detected
CREATE OR REPLACE FUNCTION public.notify_browser_notification()
RETURNS TRIGGER AS $$
DECLARE
  account_name_var TEXT;
  platform_var TEXT;
BEGIN
  SELECT account_name, platform INTO account_name_var, platform_var 
  FROM public.browser_accounts WHERE id = NEW.browser_account_id;
  
  -- Update browser account has_unread flag
  UPDATE public.browser_accounts 
  SET has_unread_notifications = true, 
      last_notification_at = NOW(),
      updated_at = NOW()
  WHERE id = NEW.browser_account_id;
  
  -- Create notification for admins
  INSERT INTO public.notifications (
    type,
    title,
    body,
    data,
    audience
  ) VALUES (
    'booking_created', -- Using existing type, could add 'browser_notification' later
    'إشعار جديد على ' || CASE platform_var WHEN 'airbnb' THEN 'Airbnb' ELSE 'Gathern' END,
    'يوجد إشعار جديد على الحساب: ' || account_name_var,
    jsonb_build_object(
      'browser_account_id', NEW.browser_account_id,
      'account_name', account_name_var,
      'platform', platform_var,
      'notification_type', NEW.notification_type
    ),
    'all_admins'
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for browser notification
DROP TRIGGER IF EXISTS trigger_notify_browser_notification ON public.browser_notifications;
CREATE TRIGGER trigger_notify_browser_notification
  AFTER INSERT ON public.browser_notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_browser_notification();

-- Enable realtime for browser_accounts
ALTER PUBLICATION supabase_realtime ADD TABLE public.browser_accounts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.browser_notifications;

