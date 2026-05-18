import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/admin'
import { cookies } from 'next/headers'
import { stripe } from '@/lib/stripe/config'

/**
 * POST /api/admin/subscriptions/[id]/reactivate
 * Reactivate a canceled subscription
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify admin access
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    requireAdmin(user.email)

    const { id: userId } = await params
    const adminClient = createAdminClient()

    // Get user subscription data
    const { data: userData, error: fetchError } = await adminClient
      .from('users')
      .select('subscription_id, subscription_period_end')
      .eq('id', userId)
      .single()

    if (fetchError || !userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (!userData.subscription_id) {
      return NextResponse.json({ error: 'No subscription found' }, { status: 404 })
    }

    // Reactivate subscription in Stripe and fetch the current period end
    let newPeriodEnd: string | null = null
    if (stripe) {
      try {
        const reactivated = await stripe.subscriptions.update(userData.subscription_id, {
          cancel_at_period_end: false,
        })
        newPeriodEnd = new Date(reactivated.current_period_end * 1000).toISOString()
      } catch (stripeError) {
        console.error('[Admin API] Error reactivating Stripe subscription:', stripeError)
        return NextResponse.json({ error: 'Failed to reactivate subscription in Stripe' }, { status: 500 })
      }
    }

    // Restore subscription_period_end so middleware grants access again.
    // If we have a fresh value from Stripe, use it; otherwise fall back to
    // the existing DB value (covers the case where Stripe is unavailable but
    // the period_end was never nulled — still better than leaving it in the past).
    const periodEndToWrite =
      newPeriodEnd ??
      (userData.subscription_period_end &&
      new Date(userData.subscription_period_end) > new Date()
        ? userData.subscription_period_end
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString())

    // Update database
    const { error: updateError } = await adminClient
      .from('users')
      .update({
        subscription_status: 'active',
        subscription_period_end: periodEndToWrite,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)

    if (updateError) {
      console.error('[Admin API] Error updating user subscription status:', updateError)
      return NextResponse.json({ error: 'Failed to update subscription status' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Subscription reactivated successfully',
    })
  } catch (error) {
    console.error('[Admin API] Exception in POST /api/admin/subscriptions/[id]/reactivate:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: error instanceof Error && error.name === 'AdminAccessDeniedError' ? 403 : 500 }
    )
  }
}
