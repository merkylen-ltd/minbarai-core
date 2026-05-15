-- Migration 002: Add is_suspended column to the users table
--
-- Enables admin account suspension without deleting users.
-- The middleware, admin suspend/activate endpoints, and /auth/suspended page
-- all reference this column.
--
-- Safe to re-run: uses ADD COLUMN IF NOT EXISTS.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN NOT NULL DEFAULT false;

-- Partial index — only non-trivial for the small subset of suspended users
CREATE INDEX IF NOT EXISTS idx_users_is_suspended
  ON public.users(is_suspended)
  WHERE is_suspended = true;
