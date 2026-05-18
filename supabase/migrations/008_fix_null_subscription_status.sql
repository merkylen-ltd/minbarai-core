-- Migration 008: Fix null subscription_status for admin-created accounts
--
-- All accounts in this system are admin-created (public signup is disabled).
-- The accounts API previously omitted subscription_status on INSERT, leaving it
-- NULL. The middleware treats NULL as invalid, blocking dashboard access.
--
-- Safe to apply: we set 'active' with a NULL subscription_period_end.
-- The middleware only checks subscription_period_end for status='canceled',
-- so these accounts remain accessible indefinitely until explicitly changed.

UPDATE public.users
SET subscription_status = 'active'
WHERE subscription_status IS NULL
  AND is_suspended = false;
