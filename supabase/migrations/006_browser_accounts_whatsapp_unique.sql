-- Migration: Allow WhatsApp browser accounts without linking, but keep unique per platform account for others
-- Date: 2025-12-10

-- 1) Expand platform check to include whatsapp
ALTER TABLE public.browser_accounts
  DROP CONSTRAINT IF EXISTS browser_accounts_platform_check;

ALTER TABLE public.browser_accounts
  ADD CONSTRAINT browser_accounts_platform_check
  CHECK (platform IN ('airbnb', 'gathern', 'whatsapp'));

-- 2) Relax unique constraint on platform_account_id
ALTER TABLE public.browser_accounts
  DROP CONSTRAINT IF EXISTS browser_accounts_platform_account_id_key;

-- 3) Add partial unique index: only enforce uniqueness when platform_account_id is not null AND platform <> 'whatsapp'
DROP INDEX IF EXISTS idx_browser_accounts_platform_account_unique_active;
CREATE UNIQUE INDEX idx_browser_accounts_platform_account_unique_active
  ON public.browser_accounts(platform_account_id)
  WHERE platform_account_id IS NOT NULL AND platform <> 'whatsapp';

-- 4) Keep session_partition unique as-is (already unique)

