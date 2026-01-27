import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import type { SSEEvent } from '@/types/usage-session'
import type { SupabaseClient } from '@supabase/supabase-js'

// Type for usage session record
interface UsageSessionRecord {
  duration_seconds: number | null
}

// Type for tracking previous session state to detect closures
interface SessionStateCache {
  sessionId: string | null
  status: string
  lastChecked: number
}

// TTL for session expiry
// How long a session can go without activity before being marked as expired
// Set to 30 minutes to accommodate long recording sessions without requiring heartbeat pings
const TTL_SECONDS = 30 * 60 // 30 minutes

// Cache to track previous session state per user for detecting closures
const sessionStateCache = new Map<string, SessionStateCache>()

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * SSE Stream for Real-Time Usage Tracking
 * 
 * Provides real-time updates to connected clients about their usage session state
 * using Server-Sent Events and Supabase Realtime subscriptions.
 */
export async function GET(request: Request) {
  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return new Response('Unauthorized', { status: 401 })
    }

    console.log(`[Usage SSE] Stream connection opened for user ${user.id}`)

    // Set up SSE stream
    const encoder = new TextEncoder()
    let aborted = false
    
    const stream = new ReadableStream({
      async start(controller) {
        // Helper to send SSE event
        const sendEvent = (event: SSEEvent) => {
          if (aborted) return
          try {
            const data = JSON.stringify(event)
            controller.enqueue(encoder.encode(`data: ${data}\n\n`))
            console.log(`[Usage SSE] Sent event: ${event.type}`)
          } catch (error) {
            console.error('[Usage SSE] Error sending event:', error)
          }
        }

        // Send connection heartbeat (keeps connection alive)
        const sendHeartbeat = () => {
          if (aborted) return
          try {
            controller.enqueue(encoder.encode(`: heartbeat\n\n`))
          } catch (error) {
            // Ignore heartbeat errors
          }
        }

        try {
          // Send initial state immediately
          const initialState = await getCurrentUsageState(supabase, user.id)
          sendEvent(initialState)

          // Set up Supabase Realtime subscription for usage_sessions table changes
          const channel = supabase
            .channel(`usage_stream:${user.id}`)
            .on(
              'postgres_changes',
              {
                event: '*',
                schema: 'public',
                table: 'usage_sessions',
                filter: `user_id=eq.${user.id}`,
              },
              async (payload) => {
                if (aborted) return
                
                console.log(`[Usage SSE] Database change detected:`, payload.eventType)
                
                // Fetch updated state and send to client
                const state = await getCurrentUsageState(supabase, user.id)
                sendEvent(state)
              }
            )
            .subscribe((status) => {
              if (status === 'SUBSCRIBED') {
                console.log(`[Usage SSE] Subscribed to realtime updates for user ${user.id}`)
              } else if (status === 'CHANNEL_ERROR') {
                console.error(`[Usage SSE] Channel error for user ${user.id}`)
              } else if (status === 'TIMED_OUT') {
                console.error(`[Usage SSE] Channel timed out for user ${user.id}`)
              }
            })

          // Send heartbeat every 30 seconds to keep connection alive
          const heartbeatInterval = setInterval(() => {
            if (aborted) {
              clearInterval(heartbeatInterval)
              return
            }
            sendHeartbeat()
          }, 30000)

          // Send periodic state updates every 10 seconds
          // This ensures time remaining is accurate even without database changes
          // and that expired/capped sessions are detected and sent to clients
          const stateUpdateInterval = setInterval(async () => {
            if (aborted) {
              clearInterval(stateUpdateInterval)
              return
            }
            
            try {
              const state = await getCurrentUsageState(supabase, user.id)
              // Send all state updates except connection heartbeats
              // This includes active, expired, capped, and idle states
              if (state.type !== 'connection:heartbeat') {
                sendEvent(state)
              }
            } catch (error) {
              console.error('[Usage SSE] Error in periodic update:', error)
            }
          }, 10000)

          // Cleanup on disconnect
          const cleanup = () => {
            if (aborted) return
            aborted = true
            
            console.log(`[Usage SSE] Stream connection closed for user ${user.id}`)
            
            clearInterval(heartbeatInterval)
            clearInterval(stateUpdateInterval)
            
            // Unsubscribe from Supabase Realtime
            channel.unsubscribe().catch((err) => {
              console.error('[Usage SSE] Error unsubscribing:', err)
            })
            
            try {
              controller.close()
            } catch (error) {
              // Ignore close errors
            }
          }

          // Handle client disconnect
          request.signal.addEventListener('abort', cleanup)

          // Handle controller error
          controller.error = () => {
            cleanup()
          }

        } catch (error) {
          console.error('[Usage SSE] Error in stream start:', error)
          if (!aborted) {
            controller.error(error)
          }
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable nginx buffering
      },
    })
  } catch (error) {
    console.error('[Usage SSE] Error setting up stream:', error)
    return new Response('Internal Server Error', { status: 500 })
  }
}

/**
 * Get current usage state for a user
 * Calculates time remaining, total usage, and session details
 * Also detects if an active session should be considered expired/capped
 * Detects session closures and returns appropriate event types
 */
async function getCurrentUsageState(supabase: SupabaseClient, userId: string): Promise<SSEEvent> {
  try {
    const now = Date.now()
    
    // Get previous state from cache to detect transitions
    const previousState = sessionStateCache.get(userId)
    
    // Fetch current active session
    const { data: activeSession, error: sessionError } = await supabase
      .from('usage_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle()

    if (sessionError) {
      console.error('[Usage SSE] Error fetching active session:', sessionError)
    }

    // Calculate total usage from completed sessions only (not including current active session)
    const { data: sessions, error: usageError } = await supabase
      .from('usage_sessions')
      .select('duration_seconds')
      .eq('user_id', userId)
      .not('duration_seconds', 'is', null)

    if (usageError) {
      console.error('[Usage SSE] Error fetching usage:', usageError)
    }

    // totalUsageSeconds = sum of all CLOSED sessions only
    const totalUsageSeconds = sessions?.reduce((sum: number, s: UsageSessionRecord) => sum + (s.duration_seconds || 0), 0) || 0

    // Get user's session limit
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('session_limit_minutes')
      .eq('id', userId)
      .single()

    if (userError) {
      console.error('[Usage SSE] Error fetching user data:', userError)
    }

    const limitSeconds = ((userData?.session_limit_minutes || 180) * 60)

    // Calculate current session duration and check for expiry conditions
    let currentSessionSeconds = 0
    let effectiveStatus: string = 'idle'
    let effectiveSessionId: string | null = null
    let startedAt: string | null = null
    let expiresAt: string | null = null
    let capAt: string | null = null
    let sessionEndedAt: string | null = null
    let closeReason: 'user' | 'expired' | 'capped' | null = null
    
    if (activeSession) {
      const sessionStart = new Date(activeSession.started_at).getTime()
      const sessionLastSeen = new Date(activeSession.last_seen_at).getTime()
      const sessionMaxEnd = new Date(activeSession.max_end_at).getTime()
      
      // Check if session should be considered expired or capped
      const ttlExpired = now > sessionLastSeen + TTL_SECONDS * 1000
      const hitCap = now >= sessionMaxEnd
      
      if (hitCap) {
        // Session hit the cap - use time from start to max_end
        currentSessionSeconds = Math.floor((sessionMaxEnd - sessionStart) / 1000)
        effectiveStatus = 'capped'
        effectiveSessionId = activeSession.id
        sessionEndedAt = new Date(sessionMaxEnd).toISOString()
        closeReason = 'capped'
        // Note: Session will be closed by next ping or cleanup job
      } else if (ttlExpired) {
        // Session TTL expired - use time from start to (last_seen + TTL)
        const expiredAt = sessionLastSeen + TTL_SECONDS * 1000
        currentSessionSeconds = Math.floor((expiredAt - sessionStart) / 1000)
        effectiveStatus = 'expired'
        effectiveSessionId = activeSession.id
        sessionEndedAt = new Date(expiredAt).toISOString()
        closeReason = 'expired'
        // Note: Session will be closed by next ping or cleanup job
      } else {
        // Session is still active
        currentSessionSeconds = Math.floor((now - sessionStart) / 1000)
        effectiveStatus = 'active'
        effectiveSessionId = activeSession.id
        startedAt = activeSession.started_at
        expiresAt = new Date(sessionLastSeen + TTL_SECONDS * 1000).toISOString()
        capAt = activeSession.max_end_at
      }
    }

    // Detect session closure: previous state had an active session, current state doesn't
    // IMPORTANT: Only detect closure once by checking if we haven't already detected it
    const hadActiveSession = previousState && previousState.sessionId && 
                             (previousState.status === 'active' || previousState.status === 'capped' || previousState.status === 'expired')
    const currentHasNoSession = effectiveStatus === 'idle' || effectiveSessionId === null
    const sessionChanged = effectiveSessionId !== previousState?.sessionId
    
    // Only consider it "just closed" if:
    // 1. Previous state had an active/expired/capped session
    // 2. Current state has no session OR different session
    // 3. Previous state wasn't already idle (prevents duplicate detection)
    const sessionJustClosed = hadActiveSession && 
                               currentHasNoSession && 
                               previousState.status !== 'idle'
    
    // Update cache with current state BEFORE returning
    // This prevents duplicate closure detection on the next call
    sessionStateCache.set(userId, {
      sessionId: effectiveSessionId,
      status: effectiveStatus,
      lastChecked: now
    })

    // Calculate time remaining (respecting the limit)
    // IMPORTANT: For expired/capped sessions, we include currentSessionSeconds in the total
    // because the session has effectively ended, even if not yet persisted to DB
    const usedSeconds = totalUsageSeconds + currentSessionSeconds
    const timeRemainingSeconds = Math.max(0, limitSeconds - usedSeconds)

    // Determine event type and return appropriate event
    if (sessionJustClosed && previousState) {
      // Session was closed - return session:closed event
      // Determine close reason from previous state or current detection
      let finalCloseReason: 'user' | 'expired' | 'capped' = 'user'
      if (previousState.status === 'capped') {
        finalCloseReason = 'capped'
      } else if (previousState.status === 'expired') {
        finalCloseReason = 'expired'
      }
      
      return {
        type: 'session:closed',
        sessionId: previousState.sessionId!,
        endedAt: sessionEndedAt || new Date(now).toISOString(),
        totalUsageSeconds: usedSeconds,
        timeRemainingSeconds,
        reason: finalCloseReason,
      } as SSEEvent
    } else if (effectiveStatus === 'active') {
      // Active session - return heartbeat
      return {
        type: 'session:heartbeat',
        sessionId: effectiveSessionId!,
        status: 'active',
        startedAt: startedAt!,
        expiresAt: expiresAt!,
        capAt: capAt!,
        timeRemainingSeconds,
        totalUsageSeconds: usedSeconds, // includes current active session
        currentSessionSeconds,
      } as SSEEvent
    } else if (effectiveStatus === 'expired' || effectiveStatus === 'capped') {
      // Session has expired/capped but not yet closed in DB
      // Return usage:updated with the expired/capped status
      return {
        type: 'usage:updated',
        sessionId: effectiveSessionId,
        status: effectiveStatus as 'expired' | 'capped',
        startedAt: startedAt,
        expiresAt: sessionEndedAt,
        capAt: capAt,
        timeRemainingSeconds,
        totalUsageSeconds: usedSeconds, // includes the expired/capped session time
        currentSessionSeconds, // non-zero to show how much time was used before expiry/cap
      } as SSEEvent
    } else {
      // Idle state - no active session
      return {
        type: 'usage:updated',
        sessionId: null,
        status: 'idle',
        startedAt: null,
        expiresAt: null,
        capAt: null,
        timeRemainingSeconds,
        totalUsageSeconds, // only closed sessions, no active session
        currentSessionSeconds: 0,
      } as SSEEvent
    }
  } catch (error) {
    console.error('[Usage SSE] Error getting current state:', error)
    
    // Return a safe fallback state
    return {
      type: 'usage:updated',
      sessionId: null,
      status: 'idle',
      startedAt: null,
      expiresAt: null,
      capAt: null,
      timeRemainingSeconds: 0,
      totalUsageSeconds: 0,
      currentSessionSeconds: 0,
    } as SSEEvent
  }
}

