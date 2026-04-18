-- Migration 003: Webhook rate limiting table
--
-- Replaces the in-memory Map in app/api/stripe/webhooks/route.ts with a
-- shared Postgres table so webhook rate limiting works correctly across
-- all Cloud Run instances (no reset on cold starts).
--
-- Safe to re-run: uses IF NOT EXISTS / CREATE OR REPLACE throughout.

-- Table -------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.webhook_rate_limits (
  ip_address   TEXT        PRIMARY KEY,
  request_count INTEGER    NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL,
  updated_at   TIMESTAMPTZ NOT NULL
);

-- RLS (service_role only — never exposed to client) -----------------------

ALTER TABLE public.webhook_rate_limits ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'webhook_rate_limits'
      AND policyname = 'webhook_rate_limits_service_role_all'
  ) THEN
    CREATE POLICY "webhook_rate_limits_service_role_all"
      ON public.webhook_rate_limits
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END
$$;

-- Permissions -------------------------------------------------------------

GRANT ALL ON public.webhook_rate_limits TO service_role;

-- Indexes -----------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_webhook_rate_limits_window_start
  ON public.webhook_rate_limits(window_start);

CREATE INDEX IF NOT EXISTS idx_webhook_rate_limits_updated_at
  ON public.webhook_rate_limits(updated_at);

-- RPC: Check and record webhook attempt (database-backed rate limiting) ----

CREATE OR REPLACE FUNCTION public.check_and_record_webhook_attempt(
  p_ip_address      TEXT,
  p_max_requests    INTEGER,
  p_window_seconds  INTEGER
) RETURNS TABLE (
  cur_requests  INTEGER,
  is_allowed    BOOLEAN,
  reset_at      TIMESTAMPTZ
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_now TIMESTAMPTZ := now();
  v_window_end TIMESTAMPTZ;
  v_requests INTEGER;
BEGIN
  v_window_end := v_now + (p_window_seconds || ' seconds')::INTERVAL;

  INSERT INTO public.webhook_rate_limits AS w
    (ip_address, request_count, window_start, updated_at)
  VALUES (
    p_ip_address, 1, v_now, v_now
  )
  ON CONFLICT (ip_address) DO UPDATE SET
    request_count = CASE
      WHEN w.window_start + (p_window_seconds || ' seconds')::INTERVAL <= v_now THEN 1
      ELSE w.request_count + 1
    END,
    window_start = CASE
      WHEN w.window_start + (p_window_seconds || ' seconds')::INTERVAL <= v_now THEN v_now
      ELSE w.window_start
    END,
    updated_at = v_now;

  SELECT
    w2.request_count,
    (w2.request_count <= p_max_requests),
    (w2.window_start + (p_window_seconds || ' seconds')::INTERVAL)::TIMESTAMPTZ
  INTO v_requests, NULL, NULL
  FROM public.webhook_rate_limits w2
  WHERE w2.ip_address = p_ip_address;

  RETURN QUERY
  SELECT
    v_requests,
    (v_requests <= p_max_requests),
    (v_window_end)::TIMESTAMPTZ;
END;
$$;

-- Cleanup function (call from a cron job to prune expired rows) -----------

CREATE OR REPLACE FUNCTION public.cleanup_webhook_rate_limits()
RETURNS TABLE(deleted_count BIGINT) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_deleted BIGINT;
BEGIN
  DELETE FROM public.webhook_rate_limits
  WHERE updated_at < now() - INTERVAL '2 hours';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN QUERY SELECT v_deleted;
END;
$$;
