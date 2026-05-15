-- Make admin_invoices.supabase_user_id FK self-healing on user deletion.
--
-- The original migration 004 declared:
--   supabase_user_id UUID REFERENCES auth.users(id)
-- with the default ON DELETE NO ACTION. That blocks deleting an auth user
-- who has any paid admin_invoices referencing them, with an opaque FK error.
--
-- We want invoice rows to survive user deletion (audit trail: what was billed,
-- to whom, for how much) but clear the user pointer so auth.users can be
-- removed. ON DELETE SET NULL does exactly that. recipient_email is kept
-- populated so admins can still see which email the invoice went to.

DO $$
DECLARE
  fk_name TEXT;
BEGIN
  SELECT conname
    INTO fk_name
    FROM pg_constraint
    WHERE contype = 'f'
      AND conrelid = 'public.admin_invoices'::regclass
      AND confrelid = 'auth.users'::regclass
    LIMIT 1;

  IF fk_name IS NOT NULL THEN
    EXECUTE format(
      'ALTER TABLE public.admin_invoices DROP CONSTRAINT %I',
      fk_name
    );
  END IF;
END $$;

ALTER TABLE public.admin_invoices
  ADD CONSTRAINT admin_invoices_supabase_user_id_fkey
  FOREIGN KEY (supabase_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
