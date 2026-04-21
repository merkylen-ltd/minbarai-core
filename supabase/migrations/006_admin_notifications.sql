-- Admin activity log / notifications.
--
-- Append-only, reverse-chron. No read/unread state — UI just surfaces the
-- most recent 24h via a "new" dot on the bell. Simpler now; read state can
-- be added later without touching this table.
CREATE TABLE IF NOT EXISTS public.admin_notifications (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  type        TEXT        NOT NULL,
  title       TEXT        NOT NULL,
  message     TEXT,
  actor_email TEXT,
  target_email TEXT,
  metadata    JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_notifications_created_at
  ON public.admin_notifications(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_notifications_type
  ON public.admin_notifications(type);

COMMENT ON TABLE public.admin_notifications IS
  'Admin activity feed: invoice created/paid/voided, promo code created, account created, etc. Append-only.';

ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;
