import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/admin'
import { cookies } from 'next/headers'

/**
 * GET /api/admin/realtime/active-sessions
 * SSE endpoint for realtime active session count
 */
export async function GET(request: NextRequest) {
  try {
    // Verify admin access
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return new Response('Unauthorized', { status: 401 })
    }
    
    requireAdmin(user.email)

    const adminClient = createAdminClient()

    // Create SSE stream
    const encoder = new TextEncoder()
    let intervalId: NodeJS.Timeout | null = null
    let isClosed = false

    const stream = new ReadableStream({
      async start(controller) {
        // Send initial count
        const sendCount = async () => {
          // Check if stream is closed
          if (isClosed) {
            if (intervalId) clearInterval(intervalId)
            return
          }

          try {
            const { count } = await adminClient
              .from('usage_sessions')
              .select('*', { count: 'exact', head: true })
              .eq('status', 'active')

            const { count: cappedCount } = await adminClient
              .from('usage_sessions')
              .select('*', { count: 'exact', head: true })
              .eq('status', 'capped')

            const { count: expiredCount } = await adminClient
              .from('usage_sessions')
              .select('*', { count: 'exact', head: true })
              .eq('status', 'expired')

            const data = {
              active: count || 0,
              capped: cappedCount || 0,
              expired: expiredCount || 0,
              total: (count || 0) + (cappedCount || 0) + (expiredCount || 0),
              timestamp: new Date().toISOString(),
            }

            // Only enqueue if not closed
            if (!isClosed) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
              )
            }
          } catch (error) {
            console.error('[Admin Realtime] Error fetching session count:', error)
          }
        }

        // Send initial count
        await sendCount()

        // Update every 5 seconds
        intervalId = setInterval(sendCount, 5000)

        // Cleanup on close
        request.signal.addEventListener('abort', () => {
          isClosed = true
          if (intervalId) clearInterval(intervalId)
          try {
            controller.close()
          } catch (e) {
            // Controller already closed, ignore
          }
        })
      },
      cancel() {
        isClosed = true
        if (intervalId) clearInterval(intervalId)
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error) {
    console.error('[Admin API] Exception in GET /api/admin/realtime/active-sessions:', error)
    return new Response(
      error instanceof Error ? error.message : 'Internal server error',
      { status: error instanceof Error && error.name === 'AdminAccessDeniedError' ? 403 : 500 }
    )
  }
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
