import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/admin'
import { cookies } from 'next/headers'
import { stripe } from '@/lib/stripe/config'

/**
 * GET /api/admin/health/status
 * Check health status of all services
 */
export async function GET(request: NextRequest) {
  try {
    // This endpoint can be accessed without auth for monitoring
    // Check if request has admin auth, otherwise return limited data
    let isAdmin = false
    try {
      const cookieStore = await cookies()
      const supabase = createClient(cookieStore)
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        requireAdmin(user.email)
        isAdmin = true
      }
    } catch {
      // Not admin, continue with limited data
    }

    const serviceStatus: {
      [key: string]: {
        status: 'up' | 'down' | 'unknown'
        responseTime?: number
        error?: string
        message?: string
      }
    } = {}

    // Check Supabase
    const supabaseStart = Date.now()
    try {
      const adminClient = createAdminClient()
      await adminClient.from('users').select('id').limit(1).single()
      serviceStatus.supabase = {
        status: 'up',
        responseTime: Date.now() - supabaseStart,
      }
    } catch (error) {
      serviceStatus.supabase = {
        status: 'down',
        responseTime: Date.now() - supabaseStart,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }

    // Check Stripe
    if (stripe) {
      const stripeStart = Date.now()
      try {
        await stripe.invoices.list({ limit: 1 })
        serviceStatus.stripe = {
          status: 'up',
          responseTime: Date.now() - stripeStart,
        }
      } catch (error) {
        serviceStatus.stripe = {
          status: 'down',
          responseTime: Date.now() - stripeStart,
          error: error instanceof Error ? error.message : 'Unknown error',
        }
      }
    } else {
      serviceStatus.stripe = {
        status: 'unknown',
        error: 'Stripe not configured',
      }
    }

    // Check VoiceFlow WebSocket Service
    const voiceflowStart = Date.now()
    try {
      const voiceflowWsUrl = process.env.NEXT_PUBLIC_VOICEFLOW_WS_URL || process.env.NEXT_PUBLIC_VOICEFLOW_WS_URL_PROD
      const voiceflowToken = process.env.NEXT_PUBLIC_VOICEFLOW_WS_TOKEN
      
      if (!voiceflowWsUrl || !voiceflowToken) {
        serviceStatus.voiceflow = {
          status: 'unknown',
          responseTime: Date.now() - voiceflowStart,
          error: 'VoiceFlow credentials not configured',
        }
      } else {
        // VoiceFlow uses WebSocket, so we just check if the endpoint is configured
        // Full WebSocket health check would require a client connection
        const urlCheck = voiceflowWsUrl.startsWith('ws://') || voiceflowWsUrl.startsWith('wss://')
        
        if (urlCheck && voiceflowToken.length > 0) {
          serviceStatus.voiceflow = {
            status: 'up',
            responseTime: Date.now() - voiceflowStart,
            message: 'VoiceFlow configured correctly',
          }
        } else {
          serviceStatus.voiceflow = {
            status: 'down',
            responseTime: Date.now() - voiceflowStart,
            error: 'Invalid VoiceFlow configuration',
          }
        }
      }
    } catch (error) {
      serviceStatus.voiceflow = {
        status: 'down',
        responseTime: Date.now() - voiceflowStart,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }

    // Return full details if admin, limited if not
    const overallStatus = Object.values(serviceStatus).every(s => s.status === 'up' || s.status === 'unknown')
      ? 'healthy'
      : 'degraded'

    if (!isAdmin) {
      return NextResponse.json({
        status: overallStatus,
        timestamp: new Date().toISOString(),
      })
    }

    return NextResponse.json({
      status: overallStatus,
      services: serviceStatus,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[Admin API] Exception in GET /api/admin/health/status:', error)
    return NextResponse.json(
      { 
        status: 'error',
        error: error instanceof Error ? error.message : 'Internal server error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}
