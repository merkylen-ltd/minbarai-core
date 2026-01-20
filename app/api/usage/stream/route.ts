import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import type { SSEEvent } from '@/types/usage-session'
import type { SupabaseClient } from '@supabase/supabase-js'

// Type for usage session record
interface UsageSessionRecord {
  duration_seconds: number | null
}

// TTL for session expiry (3 minutes)
const TTL_SECONDS = 3 * 60

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

          // Send periodic state updates every 10 seconds when session is active
          // This ensures time remaining is accurate even without database changes
          const stateUpdateInterval = setInterval(async () => {
            if (aborted) {
              clearInterval(stateUpdateInterval)
              return
            }
            
            try {
              const state = await getCurrentUsageState(supabase, user.id)
              // Only send updates if session is active
              if (state.type !== 'connection:heartbeat' && 
                  'sessionId' in state && state.sessionId && 
                  'status' in state && state.status === 'active') {
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
 */
async function getCurrentUsageState(supabase: SupabaseClient, userId: string): Promise<SSEEvent> {
  try {
    const now = Date.now()
    
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

    // Calculate total usage from completed sessions only
    const { data: sessions, error: usageError } = await supabase
      .from('usage_sessions')
      .select('duration_seconds')
      .eq('user_id', userId)
      .not('duration_seconds', 'is', null)

    if (usageError) {
      console.error('[Usage SSE] Error fetching usage:', usageError)
    }

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
        // Note: Session will be closed by next ping or cleanup job
      } else if (ttlExpired) {
        // Session TTL expired - use time from start to (last_seen + TTL)
        const expiredAt = sessionLastSeen + TTL_SECONDS * 1000
        currentSessionSeconds = Math.floor((expiredAt - sessionStart) / 1000)
        effectiveStatus = 'expired'
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

    // Calculate time remaining (respecting the limit)
    const usedSeconds = totalUsageSeconds + currentSessionSeconds
    const timeRemainingSeconds = Math.max(0, limitSeconds - usedSeconds)

    // Determine event type
    const eventType = effectiveStatus === 'active' ? 'session:heartbeat' : 'usage:updated'

    return {
      type: eventType,
      sessionId: effectiveSessionId,
      status: effectiveStatus as 'idle' | 'active' | 'closed' | 'expired' | 'capped',
      startedAt,
      expiresAt,
      capAt,
      timeRemainingSeconds,
      totalUsageSeconds: usedSeconds, // Include current session in total
      currentSessionSeconds: effectiveStatus === 'active' ? currentSessionSeconds : 0,
    } as SSEEvent
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

