import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/admin'
import { cookies } from 'next/headers'
import { stripe } from '@/lib/stripe/config'

/**
 * GET /api/admin/analytics/overview
 * Get dashboard overview metrics
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

    // Get total users count
    const { count: totalUsers } = await adminClient
      .from('users')
      .select('*', { count: 'exact', head: true })

    // Get active subscriptions count
    const { count: activeSubscriptions } = await adminClient
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('subscription_status', 'active')

    // Get active sessions count (realtime)
    const { count: activeSessions } = await adminClient
      .from('usage_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active')

    // Get new signups this month
    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)
    
    const { count: newSignupsThisMonth } = await adminClient
      .from('users')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', monthStart.toISOString())

    // Get new signups this week
    const weekStart = new Date()
    weekStart.setDate(weekStart.getDate() - weekStart.getDay())
    weekStart.setHours(0, 0, 0, 0)
    
    const { count: newSignupsThisWeek } = await adminClient
      .from('users')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', weekStart.toISOString())

    // Get new signups today
    const dayStart = new Date()
    dayStart.setHours(0, 0, 0, 0)
    
    const { count: newSignupsToday } = await adminClient
      .from('users')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', dayStart.toISOString())

    // Calculate MRR (Monthly Recurring Revenue)
    let mrr = 0
    if (stripe) {
      try {
        // Get all active subscriptions
        const { data: usersWithSubs } = await adminClient
          .from('users')
          .select('stripe_subscription_id')
          .eq('subscription_status', 'active')
          .not('stripe_subscription_id', 'is', null)

        if (usersWithSubs) {
          const subscriptionAmounts = await Promise.all(
            usersWithSubs.map(async (userData) => {
              try {
                const subscription = await stripe.subscriptions.retrieve(
                  userData.stripe_subscription_id!
                )
                const amount = subscription.items.data[0]?.price.unit_amount || 0
                return amount / 100 // Convert from cents
              } catch {
                return 0
              }
            })
          )
          mrr = subscriptionAmounts.reduce((sum, amount) => sum + amount, 0)
        }
      } catch (error) {
        console.error('[Admin API] Error calculating MRR:', error)
      }
    }

    return NextResponse.json({
      totalUsers: totalUsers || 0,
      activeSubscriptions: activeSubscriptions || 0,
      activeSessions: activeSessions || 0,
      newSignups: {
        today: newSignupsToday || 0,
        thisWeek: newSignupsThisWeek || 0,
        thisMonth: newSignupsThisMonth || 0,
      },
      mrr,
    })
  } catch (error) {
    console.error('[Admin API] Exception in GET /api/admin/analytics/overview:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: error instanceof Error && error.name === 'AdminAccessDeniedError' ? 403 : 500 }
    )
  }
}
