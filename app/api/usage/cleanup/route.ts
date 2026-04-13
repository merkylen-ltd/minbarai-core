import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

import { USAGE_SESSION_TTL_SECONDS } from '@/lib/usage/constants'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Must match ping/route.ts and supabase/database.sql — see lib/usage/constants.ts
const TTL_SECONDS = USAGE_SESSION_TTL_SECONDS

/**
 * Stale Session Cleanup API
 * 
 * This endpoint should be called periodically (e.g., every 5 minutes via cron)
 * to clean up sessions that:
 * 1. Have exceeded their TTL (no ping for 3+ minutes)
 * 2. Have hit their max_end_at cap
 * 
 * This is critical for accurate usage tracking - without cleanup,
 * stale sessions would never be closed and usage wouldn't be recorded.
 * 
 * Usage:
 * - POST /api/usage/cleanup - Run cleanup (requires CRON_SECRET header for production)
 * - GET /api/usage/cleanup - Check status (no auth required)
 */

// Lazy initialization of Supabase admin client
function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase configuration is missing')
  }
  
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

interface CleanupResult {
  success: boolean
  closedSessions: number
  details: Array<{
    sessionId: string
    userId: string
    status: 'expired' | 'capped'
    durationSeconds: number
  }>
  timestamp: string
}

/**
 * GET - Check cleanup status and stale session count
 */
export async function GET() {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const now = new Date()
    const ttlCutoff = new Date(now.getTime() - TTL_SECONDS * 1000)
    
    // Count stale sessions that need cleanup
    const { data: staleSessions, error } = await supabaseAdmin
      .from('usage_sessions')
      .select('id, user_id, started_at, last_seen_at, max_end_at')
      .eq('status', 'active')
      .or(`last_seen_at.lt.${ttlCutoff.toISOString()},max_end_at.lte.${now.toISOString()}`)
    
    if (error) {
      console.error('[Cleanup] Error checking stale sessions:', error)
      return NextResponse.json({ error: 'Failed to check stale sessions' }, { status: 500 })
    }
    
    return NextResponse.json({
      staleSessionCount: staleSessions?.length || 0,
      staleSessions: staleSessions?.map(s => ({
        sessionId: s.id,
        userId: s.user_id,
        lastSeenAt: s.last_seen_at,
        maxEndAt: s.max_end_at
      })),
      timestamp: now.toISOString(),
      ttlSeconds: TTL_SECONDS
    })
  } catch (error) {
    console.error('[Cleanup] Exception in GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST - Execute cleanup of stale sessions
 */
export async function POST(request: Request) {
  try {
    // In production, verify the CRON_SECRET to prevent unauthorized cleanup
    const cronSecret = process.env.CRON_SECRET
    const authHeader = request.headers.get('authorization')
    
    // Skip auth check in development or if CRON_SECRET not set
    if (cronSecret && process.env.NODE_ENV === 'production') {
      if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
        console.warn('[Cleanup] Unauthorized cleanup attempt')
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }
    
    const supabaseAdmin = getSupabaseAdmin()
    const now = new Date()
    const ttlCutoff = new Date(now.getTime() - TTL_SECONDS * 1000)
    
    console.log(`[Cleanup] Starting stale session cleanup at ${now.toISOString()}`)
    
    // Find all active sessions that need to be closed
    const { data: staleSessions, error: fetchError } = await supabaseAdmin
      .from('usage_sessions')
      .select('*')
      .eq('status', 'active')
      .or(`last_seen_at.lt.${ttlCutoff.toISOString()},max_end_at.lte.${now.toISOString()}`)
    
    if (fetchError) {
      console.error('[Cleanup] Error fetching stale sessions:', fetchError)
      return NextResponse.json({ error: 'Failed to fetch stale sessions' }, { status: 500 })
    }
    
    if (!staleSessions || staleSessions.length === 0) {
      console.log('[Cleanup] No stale sessions to clean up')
      return NextResponse.json({
        success: true,
        closedSessions: 0,
        details: [],
        timestamp: now.toISOString()
      } as CleanupResult)
    }
    
    console.log(`[Cleanup] Found ${staleSessions.length} stale sessions to close`)
    
    const closedDetails: CleanupResult['details'] = []
    
    for (const session of staleSessions) {
      const sessionStarted = new Date(session.started_at)
      const sessionLastSeen = new Date(session.last_seen_at)
      const sessionMaxEnd = new Date(session.max_end_at)
      
      // Determine if session hit cap or TTL expired
      const hitCap = now >= sessionMaxEnd
      const ttlExpired = now > new Date(sessionLastSeen.getTime() + TTL_SECONDS * 1000)
      
      // Calculate the actual end time
      let endedAt: Date
      let finalStatus: 'expired' | 'capped'
      
      if (hitCap) {
        // Session hit the time cap - use max_end_at as end time
        endedAt = sessionMaxEnd
        finalStatus = 'capped'
      } else if (ttlExpired) {
        // Session TTL expired - use last_seen_at + TTL as end time
        endedAt = new Date(sessionLastSeen.getTime() + TTL_SECONDS * 1000)
        finalStatus = 'expired'
      } else {
        // This shouldn't happen but handle it gracefully
        console.warn(`[Cleanup] Session ${session.id} matched query but neither cap nor TTL condition`)
        continue
      }
      
      // Calculate duration (from start to actual end, not now)
      const durationSeconds = Math.max(0, Math.floor((endedAt.getTime() - sessionStarted.getTime()) / 1000))
      
      // Update the session in database
      const { error: updateError } = await supabaseAdmin
        .from('usage_sessions')
        .update({
          status: finalStatus,
          ended_at: endedAt.toISOString(),
          duration_seconds: durationSeconds,
          updated_at: now.toISOString()
        })
        .eq('id', session.id)
        .eq('status', 'active') // Only update if still active (prevent race)
      
      if (updateError) {
        console.error(`[Cleanup] Error closing session ${session.id}:`, updateError)
        continue
      }
      
      console.log(`[Cleanup] Closed session ${session.id}: ${finalStatus}, duration: ${durationSeconds}s`)
      
      closedDetails.push({
        sessionId: session.id,
        userId: session.user_id,
        status: finalStatus,
        durationSeconds
      })
    }
    
    console.log(`[Cleanup] Completed. Closed ${closedDetails.length}/${staleSessions.length} sessions`)
    
    return NextResponse.json({
      success: true,
      closedSessions: closedDetails.length,
      details: closedDetails,
      timestamp: now.toISOString()
    } as CleanupResult)
    
  } catch (error) {
    console.error('[Cleanup] Exception in POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
