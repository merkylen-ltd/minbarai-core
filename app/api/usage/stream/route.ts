import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import type { SSEEvent } from '@/types/usage-session'

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
    const cookieStore = cookies()
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
 */
async function getCurrentUsageState(supabase: any, userId: string): Promise<SSEEvent> {
  try {
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

    // Calculate total usage from completed sessions
    const { data: sessions, error: usageError } = await supabase
      .from('usage_sessions')
      .select('duration_seconds')
      .eq('user_id', userId)
      .not('duration_seconds', 'is', null)

    if (usageError) {
      console.error('[Usage SSE] Error fetching usage:', usageError)
    }

    const totalUsageSeconds = sessions?.reduce((sum: number, s: any) => sum + (s.duration_seconds || 0), 0) || 0

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

    // Calculate current session duration if active
    let currentSessionSeconds = 0
    if (activeSession) {
      const start = new Date(activeSession.started_at).getTime()
      const now = Date.now()
      currentSessionSeconds = Math.floor((now - start) / 1000)
    }

    // Calculate time remaining
    const timeRemainingSeconds = Math.max(0, limitSeconds - (totalUsageSeconds + currentSessionSeconds))

    // Determine event type and status
    const status = activeSession?.status || 'idle'
    const eventType = activeSession ? 'session:heartbeat' : 'usage:updated'

    return {
      type: eventType,
      sessionId: activeSession?.id || null,
      status: status as any,
      startedAt: activeSession?.started_at || null,
      expiresAt: activeSession
        ? new Date(new Date(activeSession.last_seen_at).getTime() + 180000).toISOString()
        : null,
      capAt: activeSession?.max_end_at || null,
      timeRemainingSeconds,
      totalUsageSeconds: totalUsageSeconds + currentSessionSeconds,
      currentSessionSeconds,
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

