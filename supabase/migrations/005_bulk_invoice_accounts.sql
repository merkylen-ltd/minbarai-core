-- Add support for multi-account invoices (one invoice pays for N accounts)
ALTER TABLE public.admin_invoices
  ADD COLUMN IF NOT EXISTS account_emails TEXT[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE public.admin_invoices
  ADD COLUMN IF NOT EXISTS activated_account_emails TEXT[] NOT NULL DEFAULT '{}'::text[];

COMMENT ON COLUMN public.admin_invoices.account_emails IS
  'Child account emails activated on payment when invoice covers multiple seats. Empty array = single-account invoice where only recipient_email is activated.';

COMMENT ON COLUMN public.admin_invoices.activated_account_emails IS
  'Subset of account_emails (or [recipient_email] for single-account) already activated. Used for per-email webhook idempotency so Stripe retries only re-activate emails that did not succeed.';

CREATE INDEX IF NOT EXISTS idx_admin_invoices_account_emails
  ON public.admin_invoices USING GIN (account_emails);
