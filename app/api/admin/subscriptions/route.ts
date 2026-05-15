import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/admin'
import { cookies } from 'next/headers'
import { stripe } from '@/lib/stripe/config'

/**
 * GET /api/admin/subscriptions
 * List all subscriptions with filters
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

    // Get query parameters
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    // Use admin client to fetch users with subscriptions
    const adminClient = createAdminClient()

    let query = adminClient
      .from('users')
      .select('*', { count: 'exact' })
      .not('customer_id', 'is', null)

    // Apply status filter
    if (status) {
      query = query.eq('subscription_status', status)
    }

    // Apply pagination
    const from = (page - 1) * limit
    const to = from + limit - 1
    query = query.range(from, to)

    // Sort by subscription period end
    query = query.order('subscription_period_end', { ascending: false })

    const { data: users, error, count } = await query

    if (error) {
      console.error('[Admin API] Error fetching subscriptions:', error)
      return NextResponse.json({ error: 'Failed to fetch subscriptions' }, { status: 500 })
    }

    // Enrich with Stripe data for specific fields (hybrid approach)
    const stripeClient = stripe
    const enrichedUsers = await Promise.all(
      (users || []).map(async (userData) => {
        try {
          if (userData.subscription_id && stripeClient) {
            const subscription = await stripeClient.subscriptions.retrieve(
              userData.subscription_id
            )
            
            return {
              ...userData,
              stripe_data: {
                current_period_end: subscription.current_period_end,
                cancel_at_period_end: subscription.cancel_at_period_end,
                plan_amount: subscription.items.data[0]?.price.unit_amount || null,
                plan_currency: subscription.items.data[0]?.price.currency || null,
              },
            }
          }
          return userData
        } catch (stripeError) {
          console.error('[Admin API] Error fetching Stripe subscription:', stripeError)
          return userData
        }
      })
    )

    return NextResponse.json({
      subscriptions: enrichedUsers,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    })
  } catch (error) {
    console.error('[Admin API] Exception in GET /api/admin/subscriptions:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: error instanceof Error && error.name === 'AdminAccessDeniedError' ? 403 : 500 }
    )
  }
}
