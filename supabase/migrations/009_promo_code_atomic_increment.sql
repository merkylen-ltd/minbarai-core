-- Atomic check-and-increment for promo code redemptions.
-- Replaces the non-atomic read-check + later-increment pattern, which allowed
-- two concurrent requests to both pass the max_redemptions check and both apply
-- the same promo code.
--
-- Returns TRUE if the increment succeeded (slot was available),
-- FALSE if max_redemptions was already reached (caller should abort).
CREATE OR REPLACE FUNCTION public.use_promo_code(promo_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rows_updated int;
BEGIN
  UPDATE public.promo_codes
  SET redemptions_count = redemptions_count + 1
  WHERE id = promo_id
    AND is_active = true
    AND (max_redemptions IS NULL OR redemptions_count < max_redemptions);
  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  RETURN rows_updated > 0;
END;
$$;

-- Keep the old function as a no-op shim in case anything still calls it.
CREATE OR REPLACE FUNCTION public.increment_promo_redemptions(promo_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.use_promo_code(promo_id);
$$;
