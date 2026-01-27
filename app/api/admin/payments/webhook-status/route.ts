import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/admin'
import { cookies } from 'next/headers'

/**
 * GET /api/admin/payments/webhook-status
 * Get webhook health and statistics
 */
export async function GET(request: NextRequest) {
  try {
    // Verify admin access
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    requireAdmin(user.email)

    const adminClient = createAdminClient()

    // Get webhook statistics
    const { data: stats, error: statsError } = await adminClient
      .rpc('get_webhook_statistics')

    if (statsError) {
      console.error('[Admin API] Error fetching webhook statistics:', statsError)
    }

    // Get recent webhook events
    const { data: recentEvents, error: eventsError } = await adminClient
      .from('stripe_webhook_events')
      .select('status, created_at')
      .order('created_at', { ascending: false })
      .limit(100)

    if (eventsError) {
      console.error('[Admin API] Error fetching recent events:', eventsError)
    }

    // Calculate success rate from recent events
    let successRate = 100
    if (recentEvents && recentEvents.length > 0) {
      const completedCount = recentEvents.filter(e => e.status === 'completed').length
      successRate = (completedCount / recentEvents.length) * 100
    }

    // Determine health status
    const isHealthy = successRate >= 95

    return NextResponse.json({
      healthy: isHealthy,
      successRate: Math.round(successRate * 100) / 100,
      statistics: stats || null,
      recentEventsCount: recentEvents?.length || 0,
    })
  } catch (error) {
    console.error('[Admin API] Exception in GET /api/admin/payments/webhook-status:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: error instanceof Error && error.name === 'AdminAccessDeniedError' ? 403 : 500 }
    )
  }
}
