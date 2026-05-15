import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/admin'
import { cookies } from 'next/headers'
import { stripe } from '@/lib/stripe/config'

/**
 * POST /api/admin/users/[id]/sync-stripe
 * Sync user data with Stripe
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

    // Get user data
    const { data: userData, error: fetchError } = await adminClient
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()

    if (fetchError || !userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (!userData.subscription_id || !stripe) {
      return NextResponse.json({ error: 'No Stripe subscription found' }, { status: 404 })
    }

    // Fetch latest data from Stripe
    const subscription = await stripe.subscriptions.retrieve(userData.subscription_id)
    const customer = await stripe.customers.retrieve(subscription.customer as string)

    // Prepare update data
    const updateData: any = {
      subscription_status: subscription.status,
      updated_at: new Date().toISOString(),
    }

    // Update period end if available
    if (subscription.current_period_end) {
      updateData.subscription_period_end = new Date(subscription.current_period_end * 1000).toISOString()
    }

    // Update customer email if different
    if (customer && !customer.deleted && (customer as any).email !== userData.email) {
      updateData.email = (customer as any).email
    }

    // Update database
    const { error: updateError } = await adminClient
      .from('users')
      .update(updateData)
      .eq('id', userId)

    if (updateError) {
      console.error('[Admin API] Error updating user:', updateError)
      return NextResponse.json({ error: 'Failed to update user' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'User synced with Stripe successfully',
      stripeData: {
        status: subscription.status,
        current_period_end: subscription.current_period_end,
        cancel_at_period_end: subscription.cancel_at_period_end,
        canceled_at: subscription.canceled_at,
      },
    })
  } catch (error) {
    console.error('[Admin API] Exception in POST /api/admin/users/[id]/sync-stripe:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: error instanceof Error && error.name === 'AdminAccessDeniedError' ? 403 : 500 }
    )
  }
}
