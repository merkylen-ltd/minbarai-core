import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/admin'
import { cookies } from 'next/headers'

/**
 * POST /api/admin/marketing/bulk-seed
 * Create multiple demo accounts at once
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

    const body = await request.json()
    const {
      count = 1,
      emailPrefix = 'demo',
      emailDomain = 'minbarai.com',
      password,
      sessionLimitMinutes = 180,
      withSubscription = false,
      expiresInDays = 30
    } = body

    // Validate inputs
    if (!password) {
      return NextResponse.json({ error: 'Password required' }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }

    if (!Number.isInteger(count) || count < 1 || count > 50) {
      return NextResponse.json({ error: 'Count must be between 1 and 50' }, { status: 400 })
    }

    if (!Number.isInteger(sessionLimitMinutes) || sessionLimitMinutes < 10 || sessionLimitMinutes > 10080) {
      return NextResponse.json({ error: 'Session limit must be between 10 and 10080 minutes' }, { status: 400 })
    }

    const adminClient = createAdminClient()
    const accounts: any[] = []
    let created = 0
    let failed = 0

    // Create accounts sequentially to avoid rate limits
    for (let i = 1; i <= count; i++) {
      const email = `${emailPrefix}+${i}@${emailDomain}`

      try {
        // Create auth user
        const { data, error: authError } = await adminClient.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: {
            demo_account: true,
            bulk_seed: true,
            batch_index: i,
            created_by: 'marketing_bulk_seed',
            created_at_timestamp: Date.now()
          }
        })

        if (authError || !data.user) {
          failed++
          accounts.push({
            email,
            success: false,
            error: authError?.message || 'Failed to create auth user'
          })
          continue
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
            subscription_id: `sub_bulk_${i}_${userId.slice(0, 4)}`,
            customer_id: `cus_bulk_${i}_${userId.slice(0, 4)}`,
            subscription_period_end: subscriptionPeriodEnd.toISOString(),
            session_limit_minutes: sessionLimitMinutes,
            is_suspended: false
          }, { onConflict: 'id' })

          if (upsertError) {
            failed++
            await adminClient.auth.admin.deleteUser(userId)
            accounts.push({
              email,
              success: false,
              error: 'Failed to setup user account'
            })
            continue
          }
        } else {
          const { error: upsertError } = await adminClient.from('users').upsert({
            id: userId,
            email,
            session_limit_minutes: sessionLimitMinutes,
            is_suspended: false
          }, { onConflict: 'id' })

          if (upsertError) {
            failed++
            await adminClient.auth.admin.deleteUser(userId)
            accounts.push({
              email,
              success: false,
              error: 'Failed to setup user account'
            })
            continue
          }
        }

        created++
        accounts.push({
          email,
          success: true,
          userId,
          sessionLimitMinutes,
          withSubscription
        })
      } catch (err) {
        failed++
        accounts.push({
          email,
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error'
        })
      }

      // Small delay between requests to avoid overwhelming Supabase
      if (i < count) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }

    return NextResponse.json({
      success: true,
      created,
      failed,
      total: count,
      accounts
    })
  } catch (error) {
    console.error('[Admin API] Exception in POST /api/admin/marketing/bulk-seed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: error instanceof Error && error.name === 'AdminAccessDeniedError' ? 403 : 500 }
    )
  }
}
