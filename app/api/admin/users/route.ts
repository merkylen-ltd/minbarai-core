import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/admin'
import { cookies } from 'next/headers'
import { stripe } from '@/lib/stripe/config'
import { validateEmailStrict } from '@/lib/auth/email-validation'

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
    const ALLOWED_SORT_FIELDS = ['created_at', 'updated_at', 'email', 'subscription_status', 'subscription_period_end']
    const rawSortBy = searchParams.get('sort_by') || 'created_at'
    const sortBy = ALLOWED_SORT_FIELDS.includes(rawSortBy) ? rawSortBy : 'created_at'
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
            if (userData.subscription_id) {
              const subscription = await stripeClient.subscriptions.retrieve(userData.subscription_id)
              
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

/**
 * POST /api/admin/users
 * Create a new demo/seed account
 */
export async function POST(request: NextRequest) {
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
    const body = await request.json()
    const {
      email,
      password,
      sessionLimitMinutes = 180,
      withSubscription = false,
      expiresInDays = 30,
      note = ''
    } = body

    // Validate input
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
    }

    // Email validation
    const emailValidation = validateEmailStrict(email)
    if (!emailValidation.isValid) {
      return NextResponse.json({ error: emailValidation.errors[0] || 'Invalid email format' }, { status: 400 })
    }

    // Password validation
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }

    // Session limit validation
    const limits = [10, 10080]
    if (!Number.isInteger(sessionLimitMinutes) || sessionLimitMinutes < limits[0] || sessionLimitMinutes > limits[1]) {
      return NextResponse.json({ error: `Session limit must be between ${limits[0]} and ${limits[1]} minutes` }, { status: 400 })
    }

    // Create auth user
    const { data, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        demo_account: true,
        admin_note: note,
        created_by: 'marketing_admin',
        created_at_timestamp: Date.now()
      }
    })

    if (authError || !data.user) {
      return NextResponse.json({ error: authError?.message || 'Failed to create user' }, { status: 400 })
    }

    const userId = data.user.id

    // Upsert public.users with subscription info if needed
    if (withSubscription) {
      const subscriptionPeriodEnd = new Date()
      subscriptionPeriodEnd.setDate(subscriptionPeriodEnd.getDate() + expiresInDays)

      const { error: upsertError } = await adminClient.from('users').upsert({
        id: userId,
        email,
        subscription_status: 'active',
        subscription_id: `sub_demo_${userId.slice(0, 8)}`,
        customer_id: `cus_demo_${userId.slice(0, 8)}`,
        subscription_period_end: subscriptionPeriodEnd.toISOString(),
        session_limit_minutes: sessionLimitMinutes,
        is_suspended: false
      }, { onConflict: 'id' })

      if (upsertError) {
        // Clean up the auth user if upsert fails
        await adminClient.auth.admin.deleteUser(userId)
        return NextResponse.json({ error: 'Failed to setup user account' }, { status: 500 })
      }
    } else {
      // Free trial account: just update session limit
      const { error: upsertError } = await adminClient.from('users').upsert({
        id: userId,
        email,
        session_limit_minutes: sessionLimitMinutes,
        is_suspended: false
      }, { onConflict: 'id' })

      if (upsertError) {
        await adminClient.auth.admin.deleteUser(userId)
        return NextResponse.json({ error: 'Failed to setup user account' }, { status: 500 })
      }
    }

    return NextResponse.json({
      success: true,
      userId,
      email,
      sessionLimitMinutes,
      withSubscription
    })
  } catch (error) {
    console.error('[Admin API] Exception in POST /api/admin/users:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: error instanceof Error && error.name === 'AdminAccessDeniedError' ? 403 : 500 }
    )
  }
}
