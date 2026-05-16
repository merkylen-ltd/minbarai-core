import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/admin'
import { cookies } from 'next/headers'
import { stripe } from '@/lib/stripe/config'

/**
 * POST /api/admin/subscriptions/[id]/cancel
 * Cancel a user's subscription
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
    const body = await request.json()
    const { cancelImmediately = false } = body

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
      return NextResponse.json({ error: 'No active subscription found' }, { status: 404 })
    }

    // Cancel subscription in Stripe
    if (stripe) {
      try {
        if (cancelImmediately) {
          await stripe.subscriptions.cancel(userData.subscription_id)
        } else {
          await stripe.subscriptions.update(userData.subscription_id, {
            cancel_at_period_end: true,
          })
        }
      } catch (stripeError) {
        console.error('[Admin API] Error canceling Stripe subscription:', stripeError)
        return NextResponse.json({ error: 'Failed to cancel subscription in Stripe' }, { status: 500 })
      }
    }

    // Update database
    const updateData: any = {
      subscription_status: cancelImmediately ? 'canceled' : 'active',
      updated_at: new Date().toISOString(),
    }

    if (cancelImmediately) {
      updateData.subscription_period_end = new Date().toISOString()
    }

    const { error: updateError } = await adminClient
      .from('users')
      .update(updateData)
      .eq('id', userId)

    if (updateError) {
      console.error('[Admin API] Error updating user subscription status:', updateError)
      return NextResponse.json({ error: 'Failed to update subscription status' }, { status: 500 })
    }

    // Close active session immediately when cancelling now — access is revoked instantly
    if (cancelImmediately) {
      const now = new Date()
      const { data: activeSession } = await adminClient
        .from('usage_sessions')
        .select('id, started_at, max_end_at')
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle()
      if (activeSession) {
        const endedAt = new Date(Math.min(now.getTime(), new Date(activeSession.max_end_at).getTime()))
        await adminClient
          .from('usage_sessions')
          .update({
            status: 'closed',
            ended_at: endedAt.toISOString(),
            duration_seconds: Math.max(0, Math.floor((endedAt.getTime() - new Date(activeSession.started_at).getTime()) / 1000)),
            updated_at: now.toISOString(),
          })
          .eq('id', activeSession.id)
          .eq('status', 'active')
      }
    }

    return NextResponse.json({
      success: true,
      message: cancelImmediately 
        ? 'Subscription canceled immediately'
        : 'Subscription will be canceled at period end',
    })
  } catch (error) {
    console.error('[Admin API] Exception in POST /api/admin/subscriptions/[id]/cancel:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: error instanceof Error && error.name === 'AdminAccessDeniedError' ? 403 : 500 }
    )
  }
}
