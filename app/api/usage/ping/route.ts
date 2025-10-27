import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Constants for the ping-based usage tracking system
const TTL_SECONDS = 3 * 60 // 3 minutes TTL
// Note: MAX_SESSION_DURATION_SECONDS removed - now using user's session_limit_minutes from database

interface PingRequest {
  active: boolean
}

interface SessionResponse {
  session_id?: string
  status: 'active' | 'closed' | 'expired' | 'capped'
  started_at?: string
  expires_at?: string
  cap_at?: string
  
  // NEW: Backend-calculated time data
  time_remaining_seconds: number
  total_usage_seconds: number
  current_session_seconds?: number
  
  // Backward compatibility
  totals: {
    total_seconds: number
  }
}

/**
 * Helper function to calculate total usage seconds for a user
 * Uses a single aggregation query for performance
 */
async function getTotalUsageSeconds(supabase: any, userId: string): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('usage_sessions')
      .select('duration_seconds')
      .eq('user_id', userId)
      .not('duration_seconds', 'is', null)

    if (error) {
      console.error('[Usage Tracking] Error fetching total usage:', error)
      return 0
    }

    return data?.reduce((sum: number, session: any) => sum + (session.duration_seconds || 0), 0) || 0
  } catch (err) {
    console.error('[Usage Tracking] Exception calculating total usage:', err)
    return 0
  }
}

/**
 * Helper function to calculate time remaining
 */
function calculateTimeRemaining(
  userSessionLimitMinutes: number,
  totalUsageSeconds: number,
  currentSessionSeconds: number = 0
): number {
  const limitSeconds = userSessionLimitMinutes * 60
  const usedSeconds = totalUsageSeconds + currentSessionSeconds
  return Math.max(0, limitSeconds - usedSeconds)
}

/**
 * Helper function to close a session with proper error handling
 */
async function closeSession(
  supabase: any,
  sessionId: string,
  status: 'closed' | 'expired' | 'capped',
  endedAt: Date,
  startedAt: Date,
  now: Date
): Promise<boolean> {
  try {
    const durationSeconds = Math.max(0, Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000))
    
    const { error } = await supabase
      .from('usage_sessions')
      .update({
        status,
        ended_at: endedAt.toISOString(),
        duration_seconds: durationSeconds,
        updated_at: now.toISOString()
      })
      .eq('id', sessionId)
      .eq('status', 'active') // Only update if still active (prevents race conditions)

    if (error) {
      console.error(`[Usage Tracking] Error closing session ${sessionId}:`, error)
      return false
    }

    console.log(`[Usage Tracking] Session ${sessionId} closed with status: ${status}, duration: ${durationSeconds}s`)
    return true
  } catch (err) {
    console.error(`[Usage Tracking] Exception closing session ${sessionId}:`, err)
    return false
  }
}

export async function POST(request: Request) {
  const requestId = Math.random().toString(36).substring(7) // For tracing
  
  try {
    const cookieStore = cookies()
    const supabase = createClient(cookieStore)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      console.warn(`[Usage Tracking] Unauthorized ping attempt`)
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body: PingRequest = await request.json()
    const { active } = body

    if (typeof active !== 'boolean') {
      console.warn(`[Usage Tracking] Invalid request from user ${user.id}: active must be boolean`)
      return NextResponse.json(
        { error: 'Invalid request: active must be a boolean' },
        { status: 400 }
      )
    }

    // Get user's session limit from database
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('session_limit_minutes')
      .eq('id', user.id)
      .single()

    if (userError || !userData) {
      console.error(`[Usage Tracking] [${requestId}] Error fetching user data:`, userError)
      return NextResponse.json(
        { error: 'Failed to fetch user data' },
        { status: 500 }
      )
    }

    const now = new Date()
    const ttlExpiry = new Date(now.getTime() + TTL_SECONDS * 1000)
    // Use user's actual session limit from database instead of hardcoded value
    const userSessionLimitSeconds = (userData.session_limit_minutes || 180) * 60
    const maxEndTime = new Date(now.getTime() + userSessionLimitSeconds * 1000)

    console.log(`[Usage Tracking] [${requestId}] Ping from user ${user.id}, active=${active}`)

    // Find active session for user
    const { data: activeSession, error: fetchError } = await supabase
      .from('usage_sessions')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle() // Use maybeSingle to avoid error when no session exists

    if (fetchError) {
      console.error(`[Usage Tracking] [${requestId}] Error fetching active session:`, fetchError)
      return NextResponse.json(
        { error: 'Failed to fetch session data' },
        { status: 500 }
      )
    }

    // If an active session exists, eagerly evaluate auto-stop conditions first
    if (activeSession) {
      const sessionLastSeen = new Date(activeSession.last_seen_at)
      const sessionMaxEnd = new Date(activeSession.max_end_at)
      const sessionStarted = new Date(activeSession.started_at)
      
      const ttlExpired = now > new Date(sessionLastSeen.getTime() + TTL_SECONDS * 1000)
      const hitCap = now >= sessionMaxEnd

      if (ttlExpired || hitCap) {
        const endedAt = hitCap ? sessionMaxEnd : new Date(sessionLastSeen.getTime() + TTL_SECONDS * 1000)
        const finalStatus = hitCap ? 'capped' : 'expired'
        
        console.log(`[Usage Tracking] [${requestId}] Auto-closing session ${activeSession.id}: ${finalStatus}`)
        
        // Close the session with proper error handling
        const closed = await closeSession(supabase, activeSession.id, finalStatus, endedAt, sessionStarted, now)
        
        if (!closed) {
          // If we failed to close the session, return error to prevent data inconsistency
          return NextResponse.json(
            { error: 'Failed to close expired session' },
            { status: 500 }
          )
        }
      }
    }

    // Re-fetch active session in case we closed it above
    const { data: currentSession, error: refetchError } = await supabase
      .from('usage_sessions')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle()

    if (refetchError) {
      console.error(`[Usage Tracking] [${requestId}] Error re-fetching active session:`, refetchError)
      return NextResponse.json(
        { error: 'Failed to fetch session data' },
        { status: 500 }
      )
    }

    if (active === false) {
      // User wants to stop tracking
      if (currentSession) {
        const endedAt = new Date(Math.min(now.getTime(), new Date(currentSession.max_end_at).getTime()))
        const sessionStarted = new Date(currentSession.started_at)
        
        console.log(`[Usage Tracking] [${requestId}] User stopping session ${currentSession.id}`)
        
        const closed = await closeSession(supabase, currentSession.id, 'closed', endedAt, sessionStarted, now)
        
        if (!closed) {
          return NextResponse.json(
            { error: 'Failed to close session' },
            { status: 500 }
          )
        }
      } else {
        console.log(`[Usage Tracking] [${requestId}] Stop ping but no active session found`)
      }

      // Return totals for user
      const totalSeconds = await getTotalUsageSeconds(supabase, user.id)
      const timeRemaining = calculateTimeRemaining(userData.session_limit_minutes || 180, totalSeconds)

      return NextResponse.json({
        status: 'closed',
        time_remaining_seconds: timeRemaining,
        total_usage_seconds: totalSeconds,
        current_session_seconds: 0,
        totals: { total_seconds: totalSeconds }
      } as SessionResponse)
    }

    if (active === true) {
      if (!currentSession) {
        // Create new session
        console.log(`[Usage Tracking] [${requestId}] Creating new session for user ${user.id}`)
        
        const { data: newSession, error: createError } = await supabase
          .from('usage_sessions')
          .insert({
            user_id: user.id,
            status: 'active',
            started_at: now.toISOString(),
            last_seen_at: now.toISOString(),
            max_end_at: maxEndTime.toISOString()
          })
          .select()
          .single()

        if (createError) {
          console.error(`[Usage Tracking] [${requestId}] Error creating usage session:`, createError)
          
          // Check if error is due to unique constraint violation (race condition)
          if (createError.code === '23505') {
            console.warn(`[Usage Tracking] [${requestId}] Duplicate session detected, fetching existing session`)
            
            // Another request created a session concurrently, fetch it
            const { data: existingSession, error: existingError } = await supabase
              .from('usage_sessions')
              .select('*')
              .eq('user_id', user.id)
              .eq('status', 'active')
              .single()

            if (existingError || !existingSession) {
              return NextResponse.json(
                { error: 'Failed to create or fetch session' },
                { status: 500 }
              )
            }

            const totalSeconds = await getTotalUsageSeconds(supabase, user.id)
            const sessionStart = new Date(existingSession.started_at).getTime()
            const currentSessionSeconds = Math.floor((now.getTime() - sessionStart) / 1000)
            const timeRemaining = calculateTimeRemaining(userData.session_limit_minutes || 180, totalSeconds, currentSessionSeconds)

            return NextResponse.json({
              session_id: existingSession.id,
              status: 'active',
              started_at: existingSession.started_at,
              expires_at: ttlExpiry.toISOString(),
              cap_at: existingSession.max_end_at,
              time_remaining_seconds: timeRemaining,
              total_usage_seconds: totalSeconds + currentSessionSeconds,
              current_session_seconds: currentSessionSeconds,
              totals: { total_seconds: totalSeconds }
            } as SessionResponse)
          }

          return NextResponse.json(
            { error: 'Failed to create usage session' },
            { status: 500 }
          )
        }

        console.log(`[Usage Tracking] [${requestId}] New session created: ${newSession.id}`)

        const totalSeconds = await getTotalUsageSeconds(supabase, user.id)
        const currentSessionSeconds = 0 // Just created
        const timeRemaining = calculateTimeRemaining(userData.session_limit_minutes || 180, totalSeconds, currentSessionSeconds)

        return NextResponse.json({
          session_id: newSession.id,
          status: 'active',
          started_at: newSession.started_at,
          expires_at: ttlExpiry.toISOString(),
          cap_at: newSession.max_end_at,
          time_remaining_seconds: timeRemaining,
          total_usage_seconds: totalSeconds + currentSessionSeconds,
          current_session_seconds: currentSessionSeconds,
          totals: { total_seconds: totalSeconds }
        } as SessionResponse)
      } else {
        // Renew lease (heartbeat)
        console.log(`[Usage Tracking] [${requestId}] Heartbeat for session ${currentSession.id}`)
        
        const { error: updateError } = await supabase
          .from('usage_sessions')
          .update({
            last_seen_at: now.toISOString(),
            updated_at: now.toISOString()
          })
          .eq('id', currentSession.id)
          .eq('status', 'active') // Only update if still active

        if (updateError) {
          console.error(`[Usage Tracking] [${requestId}] Error updating session heartbeat:`, updateError)
          return NextResponse.json(
            { error: 'Failed to update session' },
            { status: 500 }
          )
        }

        const totalSeconds = await getTotalUsageSeconds(supabase, user.id)
        const sessionStart = new Date(currentSession.started_at).getTime()
        const currentSessionSeconds = Math.floor((now.getTime() - sessionStart) / 1000)
        const timeRemaining = calculateTimeRemaining(userData.session_limit_minutes || 180, totalSeconds, currentSessionSeconds)

        return NextResponse.json({
          session_id: currentSession.id,
          status: 'active',
          started_at: currentSession.started_at,
          expires_at: ttlExpiry.toISOString(),
          cap_at: currentSession.max_end_at,
          time_remaining_seconds: timeRemaining,
          total_usage_seconds: totalSeconds + currentSessionSeconds,
          current_session_seconds: currentSessionSeconds,
          totals: { total_seconds: totalSeconds }
        } as SessionResponse)
      }
    }

    console.warn(`[Usage Tracking] [${requestId}] Invalid request state`)
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    )
  } catch (error) {
    console.error(`[Usage Tracking] [${requestId}] Exception in ping API:`, error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}