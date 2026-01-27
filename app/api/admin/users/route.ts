import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/admin'
import { cookies } from 'next/headers'
import { stripe } from '@/lib/stripe/config'

/**
 * GET /api/admin/users
 * List all users with pagination, search, filters, and Stripe data
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
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search') || ''
    const subscriptionStatus = searchParams.get('subscription_status') || ''
    const sortBy = searchParams.get('sort_by') || 'created_at'
    const sortOrder = searchParams.get('sort_order') || 'desc'
    const enrichStripe = searchParams.get('enrich_stripe') === 'true'

    // Use admin client to bypass RLS
    const adminClient = createAdminClient()

    // Build query
    let query = adminClient
      .from('users')
      .select('*', { count: 'exact' })

    // Apply search filter
    if (search) {
      query = query.ilike('email', `%${search}%`)
    }

    // Apply subscription status filter
    if (subscriptionStatus) {
      query = query.eq('subscription_status', subscriptionStatus)
    }

    // Apply sorting
    query = query.order(sortBy, { ascending: sortOrder === 'asc' })

    // Apply pagination
    const from = (page - 1) * limit
    const to = from + limit - 1
    query = query.range(from, to)

    const { data: users, error, count } = await query

    if (error) {
      console.error('[Admin API] Error fetching users:', error)
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
    }

    // Enrich with Stripe data if requested
    let enrichedUsers = users || []
    if (enrichStripe && stripe) {
      const stripeClient = stripe
      enrichedUsers = await Promise.all(
        (users || []).map(async (userData) => {
          try {
            if (userData.stripe_subscription_id) {
              const subscription = await stripeClient.subscriptions.retrieve(userData.stripe_subscription_id)
              
              return {
                ...userData,
                stripe_data: {
                  status: subscription.status,
                  current_period_end: subscription.current_period_end,
                  cancel_at_period_end: subscription.cancel_at_period_end,
                  canceled_at: subscription.canceled_at,
                  plan_amount: subscription.items.data[0]?.price.unit_amount || null,
                  plan_currency: subscription.items.data[0]?.price.currency || null,
                  plan_interval: subscription.items.data[0]?.price.recurring?.interval || null,
                },
              }
            }
            return userData
          } catch (stripeError) {
            console.error('[Admin API] Error fetching Stripe data for user:', stripeError)
            return userData
          }
        })
      )
    }

    return NextResponse.json({
      users: enrichedUsers,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    })
  } catch (error) {
    console.error('[Admin API] Exception in GET /api/admin/users:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: error instanceof Error && error.name === 'AdminAccessDeniedError' ? 403 : 500 }
    )
  }
}
