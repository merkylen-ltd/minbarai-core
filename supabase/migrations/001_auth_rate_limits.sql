-- Migration 001: Supabase-backed rate limiting and account lockout
--
-- Replaces the in-memory Maps in lib/auth/rate-limiting.ts and
-- lib/auth/account-lockout.ts with a shared Postgres table so rate
-- limits and lockouts work correctly across all Cloud Run instances.
--
-- Safe to re-run: uses IF NOT EXISTS / CREATE OR REPLACE throughout.

-- Table -------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.auth_rate_limits (
  key          TEXT        PRIMARY KEY,
  attempts     INTEGER     NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL,
  locked_until TIMESTAMPTZ,
  updated_at   TIMESTAMPTZ NOT NULL
);

-- RLS (service_role only — never exposed to client) -----------------------

ALTER TABLE public.auth_rate_limits ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'auth_rate_limits'
      AND policyname = 'auth_rate_limits_service_role_all'
  ) THEN
    CREATE POLICY "auth_rate_limits_service_role_all"
      ON public.auth_rate_limits
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END
$$;

-- Permissions -------------------------------------------------------------

GRANT ALL ON public.auth_rate_limits TO service_role;

-- Indexes -----------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_auth_rate_limits_locked_until
  ON public.auth_rate_limits(locked_until)
  WHERE locked_until IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_auth_rate_limits_updated_at
  ON public.auth_rate_limits(updated_at);

-- RPC: atomic rate-limit / lockout counter --------------------------------
-- Called by both rate-limiting.ts (key = 'ip:...') and
-- account-lockout.ts (key = 'lockout:...').

CREATE OR REPLACE FUNCTION public.check_and_record_attempt(
  p_key             TEXT,
  p_max_attempts    INTEGER,
  p_window_seconds  INTEGER,
  p_lockout_seconds INTEGER
) RETURNS TABLE (
  cur_attempts  INTEGER,
  is_locked     BOOLEAN,
  locked_until  TIMESTAMPTZ,
  reset_at      TIMESTAMPTZ
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_now TIMESTAMPTZ := now();
BEGIN
  INSERT INTO public.auth_rate_limits AS r
    (key, attempts, window_start, locked_until, updated_at)
  VALUES (
    p_key, 1, v_now,
    CASE WHEN 1 >= p_max_attempts
      THEN v_now + (p_lockout_seconds || ' seconds')::INTERVAL
      ELSE NULL
    END,
    v_now
  )
  ON CONFLICT (key) DO UPDATE SET
    attempts = CASE
      WHEN r.window_start + (p_window_seconds || ' seconds')::INTERVAL <= v_now THEN 1
      ELSE r.attempts + 1
    END,
    window_start = CASE
      WHEN r.window_start + (p_window_seconds || ' seconds')::INTERVAL <= v_now THEN v_now
      ELSE r.window_start
    END,
    locked_until = CASE
      WHEN r.window_start + (p_window_seconds || ' seconds')::INTERVAL <= v_now THEN NULL
      WHEN (r.attempts + 1) >= p_max_attempts
        THEN v_now + (p_lockout_seconds || ' seconds')::INTERVAL
      ELSE NULL
    END,
    updated_at = v_now;

  RETURN QUERY
  SELECT
    a.attempts,
    (a.locked_until IS NOT NULL AND a.locked_until > v_now),
    a.locked_until,
    (a.window_start + (p_window_seconds || ' seconds')::INTERVAL)::TIMESTAMPTZ
  FROM public.auth_rate_limits a
  WHERE a.key = p_key;
END;
$$;

-- Cleanup function (call from a cron job to prune expired rows) -----------

CREATE OR REPLACE FUNCTION public.cleanup_auth_rate_limits()
RETURNS TABLE(deleted_count BIGINT) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_deleted BIGINT;
BEGIN
  DELETE FROM public.auth_rate_limits
  WHERE (locked_until IS NULL OR locked_until < now())
    AND updated_at < now() - INTERVAL '2 hours';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN QUERY SELECT v_deleted;
END;
$$;
