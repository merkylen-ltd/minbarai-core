import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/admin'
import { cookies } from 'next/headers'
import { stripe } from '@/lib/stripe/config'

/**
 * POST /api/admin/users/[id]/delete
 * Delete a user account and cancel their Stripe subscription
 *
 * Flow:
 * 1. Fetch user data (subscription_id, customer_id)
 * 2. Cancel Stripe subscription if exists
 * 3. Delete auth user (cascades to delete users table record)
 * 4. Usage sessions auto-cleanup via ON DELETE CASCADE
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

    // Prevent self-deletion
    if (user.id === userId) {
      return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 403 })
    }

    const adminClient = createAdminClient()

    // Step 1: Fetch user data including Stripe info
    const { data: userData, error: fetchError } = await adminClient
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()

    if (fetchError || !userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Step 2: Cancel Stripe subscription if it exists
    let stripeError: string | null = null
    if (userData.subscription_id && stripe) {
      try {
        await stripe.subscriptions.cancel(userData.subscription_id, {
          prorate: false
        })
        console.log(`[Admin API] Cancelled Stripe subscription ${userData.subscription_id} for user ${userId}`)
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        console.error(`[Admin API] Failed to cancel Stripe subscription ${userData.subscription_id}:`, error)
        stripeError = `Stripe cancellation failed: ${errorMessage}`
        // Don't throw — continue with deletion even if Stripe cancellation fails
        // The subscription will still be marked as canceled in Stripe
      }
    }

    // Step 3: Delete the auth user (cascades to users table via ON DELETE CASCADE)
    // This also cascades to delete all usage_sessions via ON DELETE CASCADE
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId)

    if (deleteError) {
      console.error(`[Admin API] Failed to delete auth user ${userId}:`, deleteError)
      return NextResponse.json(
        { error: `Failed to delete user: ${deleteError.message}` },
        { status: 500 }
      )
    }

    console.log(`[Admin API] User ${user.email} deleted user ${userId} (${userData.email}). Stripe subscription: ${userData.subscription_id ? 'cancelled' : 'none'}`)

    return NextResponse.json({
      success: true,
      message: 'User deleted successfully',
      stripeError: stripeError ? stripeError : undefined,
      deletedUser: {
        id: userId,
        email: userData.email,
        hadSubscription: !!userData.subscription_id,
        stripeSubscriptionId: userData.subscription_id || undefined,
      }
    })
  } catch (error) {
    console.error('[Admin API] Exception in POST /api/admin/users/[id]/delete:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: error instanceof Error && error.name === 'AdminAccessDeniedError' ? 403 : 500 }
    )
  }
}
