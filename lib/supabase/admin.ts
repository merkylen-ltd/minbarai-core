/**
 * Supabase Admin Client
 * 
 * Creates a Supabase client with service_role key for admin operations.
 * This bypasses Row Level Security (RLS) policies and should only be used server-side.
 */

import { createClient } from '@supabase/supabase-js'

/**
 * Create a Supabase client with service_role privileges
 * WARNING: This bypasses all RLS policies. Use only for admin operations.
 * @returns Supabase client with service_role access
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables for admin client')
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
