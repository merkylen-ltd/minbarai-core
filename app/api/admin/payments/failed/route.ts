import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/admin'
import { cookies } from 'next/headers'

/**
 * GET /api/admin/payments/failed
 * Get failed payment attempts
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

    // Query webhook events for failed invoice payments
    const { data: failedPayments, error } = await adminClient
      .from('stripe_webhook_events')
      .select('*')
      .in('event_type', [
        'invoice.payment_failed',
        'payment_intent.payment_failed',
        'charge.failed'
      ])
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      console.error('[Admin API] Error fetching failed payments:', error)
      return NextResponse.json({ error: 'Failed to fetch failed payments' }, { status: 500 })
    }

    // Parse event data to extract relevant info
    const parsedPayments = (failedPayments || []).map((event) => {
      try {
        const eventData = typeof event.event_data === 'string' 
          ? JSON.parse(event.event_data) 
          : event.event_data

        return {
          id: event.id,
          eventType: event.event_type,
          createdAt: event.created_at,
          customerEmail: eventData?.data?.object?.customer_email || null,
          amount: eventData?.data?.object?.amount_due || eventData?.data?.object?.amount || null,
          currency: eventData?.data?.object?.currency || 'usd',
          failureMessage: eventData?.data?.object?.last_payment_error?.message || 
                         eventData?.data?.object?.failure_message || 
                         'Unknown error',
        }
      } catch {
        return {
          id: event.id,
          eventType: event.event_type,
          createdAt: event.created_at,
          customerEmail: null,
          amount: null,
          currency: 'usd',
          failureMessage: 'Error parsing event data',
        }
      }
    })

    return NextResponse.json({
      failedPayments: parsedPayments,
    })
  } catch (error) {
    console.error('[Admin API] Exception in GET /api/admin/payments/failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: error instanceof Error && error.name === 'AdminAccessDeniedError' ? 403 : 500 }
    )
  }
}
