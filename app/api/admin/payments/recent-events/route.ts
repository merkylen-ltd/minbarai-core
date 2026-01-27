import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/admin'
import { cookies } from 'next/headers'

/**
 * GET /api/admin/payments/recent-events
 * Get recent payment webhook events
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

    // Get recent payment-related events
    const { data: events, error } = await adminClient
      .from('stripe_webhook_events')
      .select('*')
      .or('event_type.ilike.%invoice%,event_type.ilike.%payment%,event_type.ilike.%subscription%,event_type.ilike.%charge%')
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      console.error('[Admin API] Error fetching recent events:', error)
      return NextResponse.json({ error: 'Failed to fetch recent events' }, { status: 500 })
    }

    return NextResponse.json({
      events: events || [],
    })
  } catch (error) {
    console.error('[Admin API] Exception in GET /api/admin/payments/recent-events:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: error instanceof Error && error.name === 'AdminAccessDeniedError' ? 403 : 500 }
    )
  }
}
