-- Create promo_codes table
CREATE TABLE public.promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  amount_off_cents INT,
  percent_off NUMERIC(5, 2),
  currency TEXT,
  stripe_coupon_id TEXT UNIQUE,
  stripe_promotion_code_id TEXT UNIQUE,
  max_redemptions INT,
  redemptions_count INT DEFAULT 0,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_by_email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT check_discount_type CHECK (
    (amount_off_cents IS NOT NULL AND percent_off IS NULL AND currency IS NOT NULL) OR
    (amount_off_cents IS NULL AND percent_off IS NOT NULL AND currency IS NULL)
  )
);

-- Create admin_invoices table
CREATE TABLE public.admin_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by_email TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  org_name TEXT,
  amount_cents INT NOT NULL,
  currency TEXT NOT NULL,
  description TEXT NOT NULL,
  duration_days INT NOT NULL,
  session_limit_minutes INT NOT NULL,
  due_date DATE NOT NULL,
  promo_code_id UUID REFERENCES public.promo_codes(id),
  discount_amount_cents INT DEFAULT 0,
  final_amount_cents INT NOT NULL,
  stripe_customer_id TEXT,
  stripe_invoice_id TEXT UNIQUE,
  stripe_invoice_url TEXT,
  status TEXT DEFAULT 'open',
  activated_at TIMESTAMPTZ,
  supabase_user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for admin_invoices
CREATE INDEX idx_admin_invoices_recipient_email ON public.admin_invoices(recipient_email);
CREATE INDEX idx_admin_invoices_status ON public.admin_invoices(status);
CREATE INDEX idx_admin_invoices_stripe_invoice_id ON public.admin_invoices(stripe_invoice_id);

-- Enable RLS on both tables
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_invoices ENABLE ROW LEVEL SECURITY;

-- Create trigger to update updated_at on promo_codes
CREATE OR REPLACE FUNCTION public.update_promo_codes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_promo_codes_updated_at_trigger
BEFORE UPDATE ON public.promo_codes
FOR EACH ROW
EXECUTE FUNCTION public.update_promo_codes_updated_at();

-- Create trigger to update updated_at on admin_invoices
CREATE OR REPLACE FUNCTION public.update_admin_invoices_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_admin_invoices_updated_at_trigger
BEFORE UPDATE ON public.admin_invoices
FOR EACH ROW
EXECUTE FUNCTION public.update_admin_invoices_updated_at();
