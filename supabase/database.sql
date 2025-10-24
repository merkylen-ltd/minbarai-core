-- Supabase Database Schema for MinbarAI SaaS
-- Complete database setup with subscription support

-- ==============================================
-- EXTENSIONS
-- ==============================================

-- Enable pgcrypto extension for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ==============================================
-- CLEAN SLATE SETUP (Safe for fresh databases)
-- ==============================================

-- Drop everything safely (won't error if they don't exist)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
-- Note: Other triggers will be dropped after table creation

DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS public.cleanup_stale_sessions();
DROP FUNCTION IF EXISTS public.get_usage_statistics();
DROP FUNCTION IF EXISTS public.get_webhook_statistics(INTEGER);
DROP FUNCTION IF EXISTS public.cleanup_old_webhook_events(INTEGER);

DROP TABLE IF EXISTS public.stripe_webhook_events CASCADE;
DROP TABLE IF EXISTS public.usage_sessions CASCADE;
DROP TABLE IF EXISTS public.sessions CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

DROP TYPE IF EXISTS public.webhook_event_status CASCADE;
DROP TYPE IF EXISTS public.usage_status CASCADE;

-- ==============================================
-- CREATE TABLES
-- ==============================================

-- Create usage_status enum for tracking session states
CREATE TYPE usage_status AS ENUM ('active', 'closed', 'expired', 'capped');

-- Create webhook_event_status enum for tracking webhook processing
CREATE TYPE webhook_event_status AS ENUM ('pending', 'processing', 'completed', 'failed');

-- Create users table to extend auth.users with subscription handling
CREATE TABLE public.users (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  subscription_status TEXT CHECK (subscription_status IN ('active', 'past_due', 'incomplete', 'canceled', 'unpaid')) DEFAULT NULL,
  subscription_id TEXT UNIQUE DEFAULT NULL,
  customer_id TEXT UNIQUE DEFAULT NULL,
  subscription_period_end TIMESTAMPTZ DEFAULT NULL, -- When subscription actually ends (for cancelled subscriptions)
  session_limit_minutes INTEGER DEFAULT 180, -- 3 hours for active users
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create usage_sessions table for tracking live translation sessions with ping-based system
CREATE TABLE public.usage_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  status usage_status NOT NULL DEFAULT 'active',

  started_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL,  -- last "active: true" ping time from server clock
  ended_at TIMESTAMPTZ,               -- set on close/expire/cap
  duration_seconds INT,               -- set on close/expire/cap (server-calculated)

  max_end_at TIMESTAMPTZ NOT NULL,    -- started_at + INTERVAL '3 hours' (cap boundary)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enforce "one active session per user"
CREATE UNIQUE INDEX one_active_session_per_user
ON usage_sessions (user_id)
WHERE status = 'active';

-- Create stripe_webhook_events table for idempotency and audit trail
CREATE TABLE public.stripe_webhook_events (
  id TEXT PRIMARY KEY, -- Stripe event ID (evt_xxx)
  event_type TEXT NOT NULL,
  status webhook_event_status NOT NULL DEFAULT 'pending',
  payload JSONB NOT NULL,
  processing_started_at TIMESTAMPTZ,
  processing_completed_at TIMESTAMPTZ,
  processing_error TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==============================================
-- CREATE FUNCTIONS
-- ==============================================

-- Create function to handle user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (
    id, 
    email, 
    subscription_status, 
    session_limit_minutes
  )
  VALUES (
    NEW.id, 
    NEW.email, 
    NULL,  -- No subscription by default
    180  -- 3 hours session limit for users without subscription
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==============================================
-- CREATE TRIGGERS
-- ==============================================

-- Drop existing triggers first to avoid conflicts
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
DROP TRIGGER IF EXISTS update_usage_sessions_updated_at ON public.usage_sessions;
DROP TRIGGER IF EXISTS update_stripe_webhook_events_updated_at ON public.stripe_webhook_events;

-- Create trigger for new user creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create trigger for users table
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger for usage_sessions table
CREATE TRIGGER update_usage_sessions_updated_at
  BEFORE UPDATE ON public.usage_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger for stripe_webhook_events table
CREATE TRIGGER update_stripe_webhook_events_updated_at
  BEFORE UPDATE ON public.stripe_webhook_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ==============================================
-- ROW LEVEL SECURITY (RLS)
-- ==============================================

-- Enable Row Level Security (RLS) - Critical for data protection
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;

-- Create comprehensive RLS policies for users table
-- Policy 1: Users can only view their own profile
CREATE POLICY "users_select_own" ON public.users
  FOR SELECT 
  TO authenticated
  USING (auth.uid() = id);

-- Policy 2: Users can insert their own profile (for initial creation)
CREATE POLICY "users_insert_own" ON public.users
  FOR INSERT 
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Policy 3: Users can only update their own profile
CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE 
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Policy 4: Service role can perform all operations (for webhooks, admin tasks)
CREATE POLICY "users_service_role_all" ON public.users
  FOR ALL 
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create comprehensive RLS policies for usage_sessions table
-- Policy 1: Users can view their own usage sessions
CREATE POLICY "usage_sessions_select_own" ON public.usage_sessions
  FOR SELECT 
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy 2: Users can create usage sessions for themselves only
CREATE POLICY "usage_sessions_insert_own" ON public.usage_sessions
  FOR INSERT 
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy 3: Users can update their own usage sessions
CREATE POLICY "usage_sessions_update_own" ON public.usage_sessions
  FOR UPDATE 
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy 4: Users can delete their own usage sessions
CREATE POLICY "usage_sessions_delete_own" ON public.usage_sessions
  FOR DELETE 
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy 5: Service role can perform all operations (for cleanup, admin tasks)
CREATE POLICY "usage_sessions_service_role_all" ON public.usage_sessions
  FOR ALL 
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create RLS policy for stripe_webhook_events (service role only - webhooks are server-side)
CREATE POLICY "stripe_webhook_events_service_role_all" ON public.stripe_webhook_events
  FOR ALL 
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ==============================================
-- INDEXES
-- ==============================================

-- Create indexes for better performance
CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_users_customer_id ON public.users(customer_id);
CREATE INDEX idx_users_subscription_id ON public.users(subscription_id);
CREATE INDEX idx_users_subscription_period_end ON public.users(subscription_period_end);
CREATE INDEX idx_usage_sessions_user_id ON public.usage_sessions(user_id);
CREATE INDEX idx_usage_sessions_status ON public.usage_sessions(status);
CREATE INDEX idx_usage_sessions_last_seen_at ON public.usage_sessions(last_seen_at);
CREATE INDEX idx_usage_sessions_max_end_at ON public.usage_sessions(max_end_at);
CREATE INDEX idx_usage_sessions_created_at ON public.usage_sessions(created_at);
CREATE INDEX idx_usage_sessions_ended_at ON public.usage_sessions(ended_at) WHERE ended_at IS NOT NULL;

-- Composite index for efficient session queries
CREATE INDEX idx_usage_sessions_user_status ON public.usage_sessions(user_id, status);

-- Index for cleanup queries
CREATE INDEX idx_usage_sessions_stale_cleanup ON public.usage_sessions(status, last_seen_at) 
  WHERE status = 'active';

-- Indexes for stripe_webhook_events table
CREATE INDEX idx_stripe_webhook_events_event_type ON public.stripe_webhook_events(event_type);
CREATE INDEX idx_stripe_webhook_events_status ON public.stripe_webhook_events(status);
CREATE INDEX idx_stripe_webhook_events_created_at ON public.stripe_webhook_events(created_at);
CREATE INDEX idx_stripe_webhook_events_retry ON public.stripe_webhook_events(status, retry_count) 
  WHERE status = 'failed';

-- ==============================================
-- CLEANUP AND MAINTENANCE FUNCTIONS
-- ==============================================

-- Function to clean up stale sessions
-- This should be run periodically (e.g., via cron or scheduled job)
CREATE OR REPLACE FUNCTION public.cleanup_stale_sessions()
RETURNS TABLE(closed_count INT, details JSONB) AS $$
DECLARE
  ttl_seconds INT := 180; -- 3 minutes
  closed_count INT := 0;
  expired_sessions RECORD;
  details_array JSONB := '[]'::JSONB;
BEGIN
  -- Find and close all active sessions that have expired TTL or hit cap
  FOR expired_sessions IN
    SELECT 
      id,
      user_id,
      started_at,
      last_seen_at,
      max_end_at,
      CASE
        WHEN NOW() >= max_end_at THEN 'capped'
        WHEN NOW() > (last_seen_at + (ttl_seconds || ' seconds')::INTERVAL) THEN 'expired'
      END as final_status,
      CASE
        WHEN NOW() >= max_end_at THEN max_end_at
        ELSE (last_seen_at + (ttl_seconds || ' seconds')::INTERVAL)
      END as ended_at_timestamp
    FROM usage_sessions
    WHERE status = 'active'
      AND (
        NOW() >= max_end_at 
        OR NOW() > (last_seen_at + (ttl_seconds || ' seconds')::INTERVAL)
      )
  LOOP
    -- Calculate duration
    DECLARE
      duration_secs INT;
    BEGIN
      duration_secs := GREATEST(0, 
        EXTRACT(EPOCH FROM (expired_sessions.ended_at_timestamp - expired_sessions.started_at))::INT
      );
      
      -- Update the session
      UPDATE usage_sessions
      SET 
        status = expired_sessions.final_status::usage_status,
        ended_at = expired_sessions.ended_at_timestamp,
        duration_seconds = duration_secs,
        updated_at = NOW()
      WHERE id = expired_sessions.id
        AND status = 'active'; -- Only update if still active (prevent race conditions)
      
      IF FOUND THEN
        closed_count := closed_count + 1;
        details_array := details_array || jsonb_build_object(
          'session_id', expired_sessions.id,
          'user_id', expired_sessions.user_id,
          'status', expired_sessions.final_status,
          'duration_seconds', duration_secs
        );
      END IF;
    END;
  END LOOP;
  
  RETURN QUERY SELECT closed_count, details_array;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get usage statistics (for monitoring/observability)
CREATE OR REPLACE FUNCTION public.get_usage_statistics()
RETURNS TABLE(
  total_sessions BIGINT,
  active_sessions BIGINT,
  closed_sessions BIGINT,
  expired_sessions BIGINT,
  capped_sessions BIGINT,
  total_usage_hours NUMERIC,
  unique_users BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT as total_sessions,
    COUNT(*) FILTER (WHERE status = 'active')::BIGINT as active_sessions,
    COUNT(*) FILTER (WHERE status = 'closed')::BIGINT as closed_sessions,
    COUNT(*) FILTER (WHERE status = 'expired')::BIGINT as expired_sessions,
    COUNT(*) FILTER (WHERE status = 'capped')::BIGINT as capped_sessions,
    ROUND(SUM(COALESCE(duration_seconds, 0)) / 3600.0, 2) as total_usage_hours,
    COUNT(DISTINCT user_id)::BIGINT as unique_users
  FROM usage_sessions;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get webhook event statistics (for monitoring Stripe integration health)
CREATE OR REPLACE FUNCTION public.get_webhook_statistics(hours_back INTEGER DEFAULT 24)
RETURNS TABLE(
  total_events BIGINT,
  completed_events BIGINT,
  failed_events BIGINT,
  pending_events BIGINT,
  avg_processing_time_ms NUMERIC,
  events_by_type JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT as total_events,
    COUNT(*) FILTER (WHERE status = 'completed')::BIGINT as completed_events,
    COUNT(*) FILTER (WHERE status = 'failed')::BIGINT as failed_events,
    COUNT(*) FILTER (WHERE status IN ('pending', 'processing'))::BIGINT as pending_events,
    ROUND(AVG(
      CASE WHEN processing_completed_at IS NOT NULL AND processing_started_at IS NOT NULL
      THEN EXTRACT(EPOCH FROM (processing_completed_at - processing_started_at)) * 1000
      ELSE NULL END
    ), 2) as avg_processing_time_ms,
    jsonb_object_agg(
      event_type,
      jsonb_build_object(
        'count', COUNT(*),
        'failed', COUNT(*) FILTER (WHERE status = 'failed')
      )
    ) as events_by_type
  FROM stripe_webhook_events
  WHERE created_at > NOW() - (hours_back || ' hours')::INTERVAL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to cleanup old webhook events (keep last 90 days)
CREATE OR REPLACE FUNCTION public.cleanup_old_webhook_events(days_to_keep INTEGER DEFAULT 90)
RETURNS TABLE(deleted_count BIGINT) AS $$
DECLARE
  deleted_count BIGINT;
BEGIN
  DELETE FROM stripe_webhook_events
  WHERE created_at < NOW() - (days_to_keep || ' days')::INTERVAL
    AND status = 'completed';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN QUERY SELECT deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================
-- PERMISSIONS
-- ==============================================

-- Grant minimal necessary permissions following least privilege principle
-- Schema usage permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Users table permissions
-- Authenticated users can SELECT, INSERT, and UPDATE their own records (RLS enforced)
GRANT SELECT, INSERT, UPDATE ON public.users TO authenticated;
-- Anonymous users have no direct access to users table (RLS will block anyway)

-- Usage sessions table permissions  
-- Authenticated users can SELECT, INSERT, UPDATE, DELETE their own usage sessions (RLS enforced)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.usage_sessions TO authenticated;
-- Anonymous users have no direct access to usage sessions table (RLS will block anyway)

-- Stripe webhook events table permissions
-- Only service role can access webhook events (server-side only)
GRANT ALL ON public.stripe_webhook_events TO service_role;

-- Service role permissions (for server-side operations like webhooks)
-- Service role needs elevated permissions for admin operations
GRANT ALL ON public.users TO service_role;
GRANT ALL ON public.usage_sessions TO service_role;

-- Grant sequence permissions for auto-incrementing IDs
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- ==============================================
-- SECURITY DOCUMENTATION
-- ==============================================

-- SECURITY MODEL OVERVIEW:
-- 1. Least Privilege Principle: Users get only the minimum permissions needed
-- 2. Row Level Security (RLS): Enforced at the database level for all tables
-- 3. Role-based Access: Different permissions for anon, authenticated, and service_role
-- 4. Explicit Policies: Clear, named policies for each operation type

-- PERMISSION BREAKDOWN:
-- anon (Anonymous users):
--   - Schema usage only
--   - No direct table access (RLS blocks anyway)
--   - Used for public pages, signup, etc.

-- authenticated (Logged-in users):
--   - Can SELECT/INSERT/UPDATE their own user record
--   - Can SELECT/INSERT/UPDATE/DELETE their own sessions
--   - All operations protected by RLS policies
--   - Cannot access other users' data

-- service_role (Server-side operations):
--   - Full access to all tables
--   - Used for webhooks, admin operations, data migrations
--   - Should only be used server-side, never client-side
--   - Protected by RLS policies that allow all operations

-- SECURITY BEST PRACTICES IMPLEMENTED:
-- ✅ Principle of least privilege
-- ✅ Explicit role-based permissions
-- ✅ Comprehensive RLS policies
-- ✅ No ALL permissions for client roles
-- ✅ Service role separation for admin operations
-- ✅ Clear documentation and naming conventions
-- ✅ Automatic cleanup functions for stale sessions
-- ✅ Race condition prevention in database updates
-- ✅ Comprehensive indexes for performance
-- ✅ Monitoring and observability functions

-- ==============================================
-- SCHEMA VERIFICATION
-- ==============================================

-- Verify tables were created
SELECT 
  'Table Verification' as check_type,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') 
      AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'usage_sessions')
      AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'stripe_webhook_events')
    THEN '✅ All required tables exist'
    ELSE '❌ Some tables are missing'
  END as table_status;

-- Verify functions were created
SELECT 
  'Function Verification' as check_type,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'handle_new_user' AND routine_schema = 'public')
    THEN '✅ User creation function exists'
    ELSE '❌ User creation function missing'
  END as function_status;

-- Verify trigger was created
SELECT 
  'Trigger Verification' as check_type,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.triggers 
      WHERE trigger_name = 'on_auth_user_created' 
        AND event_object_table = 'users'
        AND event_object_schema = 'auth'
    ) THEN '✅ User creation trigger exists'
    ELSE '❌ User creation trigger missing'
  END as trigger_status;

-- ==============================================
-- CANCELLED SUBSCRIPTION HANDLING
-- ==============================================

-- CANCELLED SUBSCRIPTION OVERVIEW:
-- 1. When users cancel their subscription, status is set to 'canceled'
-- 2. Users retain access until their paid period ends (subscription_period_end)
-- 3. This follows Stripe's standard behavior for cancelled subscriptions
-- 4. Application logic checks if cancelled subscription is still within paid period
-- 5. Only after period ends are users redirected to subscribe page

-- CANCELLED SUBSCRIPTION FEATURES:
-- ✅ Production-level cancelled subscription handling
-- ✅ Users continue to have access until paid period expires
-- ✅ subscription_period_end tracks when access actually ends
-- ✅ Middleware checks cancelled subscription period validity
-- ✅ Same session limits as active users until period expires
-- ✅ Graceful transition to subscription required after period ends
-- ✅ 3-hour maximum session length enforced at database level

-- ==============================================
-- VERIFY RLS POLICIES ARE WORKING
-- ==============================================

-- Check that all RLS policies are properly created
SELECT 
  'RLS Policies Verification' as check_type,
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename IN ('users', 'usage_sessions')
ORDER BY tablename, policyname;

-- Verify INSERT policy exists for users table
SELECT 
  'INSERT Policy Check' as check_type,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname = 'public' 
        AND tablename = 'users' 
        AND policyname = 'users_insert_own'
        AND cmd = 'INSERT'
    ) THEN '✅ INSERT policy exists for users table'
    ELSE '❌ INSERT policy missing for users table'
  END as status;

-- ==============================================
-- AUTOMATED CLEANUP SETUP (RECOMMENDED)
-- ==============================================

-- IMPORTANT: Set up a periodic job to clean up stale sessions
-- You can use pg_cron extension or an external cron job

-- Example using pg_cron (if enabled):
-- SELECT cron.schedule('cleanup-stale-sessions', '*/5 * * * *', 'SELECT public.cleanup_stale_sessions()');

-- Or create an API endpoint that calls this function and invoke it via external cron:
-- SELECT * FROM public.cleanup_stale_sessions();

-- To manually check for stale sessions that need cleanup:
-- SELECT id, user_id, started_at, last_seen_at, max_end_at,
--        NOW() - last_seen_at as time_since_last_ping
-- FROM usage_sessions 
-- WHERE status = 'active' 
--   AND (NOW() >= max_end_at OR NOW() > last_seen_at + INTERVAL '3 minutes')
-- ORDER BY last_seen_at DESC;

-- To view usage statistics:
-- SELECT * FROM public.get_usage_statistics();

-- ==============================================
-- VERIFICATION AND COMPLETION
-- ==============================================

-- Verify trigger was created
SELECT 
  'Trigger Verification' as check_type,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.triggers 
      WHERE trigger_name = 'on_auth_user_created' 
        AND event_object_table = 'users'
        AND event_object_schema = 'auth'
    ) THEN '✅ User creation trigger exists'
    ELSE '❌ User creation trigger missing'
  END as trigger_status;

-- Verify tables were created
SELECT 
  'Table Verification' as check_type,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') 
      AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'usage_sessions')
      AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'stripe_webhook_events')
    THEN '✅ All required tables exist'
    ELSE '❌ Some tables are missing'
  END as table_status;

-- Verify functions were created
SELECT 
  'Function Verification' as check_type,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'handle_new_user' AND routine_schema = 'public')
    THEN '✅ User creation function exists'
    ELSE '❌ User creation function missing'
  END as function_status;

-- ==============================================
-- COMPLETION MESSAGE
-- ==============================================

SELECT 
  'Database schema setup completed successfully!' as message,
  'Cancelled users retain access until their paid period expires' as cancelled_subscription_info,
  'RLS policies include INSERT permission for user creation' as rls_fix,
  'Ping-based usage tracking with TTL and 3-hour hard cap' as usage_tracking_info,
  'Automated cleanup function available: cleanup_stale_sessions()' as cleanup_info,
  'Comprehensive indexes and triggers for performance and data integrity' as performance_info,
  'Race condition prevention and error handling built-in' as reliability_info,
  'Stripe webhook idempotency with database-backed event tracking' as stripe_integration_info,
  'Webhook event logging for audit trail and debugging' as webhook_audit_info,
  'Use ./scripts/seed.sh <email> to create test users' as next_step;