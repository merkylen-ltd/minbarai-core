import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/admin'
import { cookies } from 'next/headers'
import { stripe } from '@/lib/stripe/config'
import { logNotification } from '@/lib/admin/notifications'

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

    // Step 3: Clear FK references to this auth user that would block deletion.
    // admin_invoices.supabase_user_id REFERENCES auth.users(id) with default
    // ON DELETE NO ACTION — so unless we null it out first, the auth delete
    // fails with a foreign-key violation and the admin sees an opaque error.
    // The invoice row itself is kept (audit trail) — only the user pointer is
    // cleared. recipient_email remains populated.
    const { data: clearedInvoices, error: clearInvoiceError } = await adminClient
      .from('admin_invoices')
      .update({ supabase_user_id: null })
      .eq('supabase_user_id', userId)
      .select('id')

    if (clearInvoiceError) {
      console.error(`[Admin API] Failed to clear invoice user refs for ${userId}:`, clearInvoiceError)
      return NextResponse.json(
        { error: `Failed to prepare user for deletion: ${clearInvoiceError.message}` },
        { status: 500 }
      )
    }

    // Step 4: Delete the auth user (cascades to public.users via ON DELETE CASCADE,
    // which cascades to usage_sessions via its own ON DELETE CASCADE).
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId)

    if (deleteError) {
      console.error(`[Admin API] Failed to delete auth user ${userId}:`, deleteError)
      return NextResponse.json(
        {
          error: `Failed to delete user: ${deleteError.message}`,
          hint: deleteError.message?.includes('foreign key') || deleteError.message?.includes('violates')
            ? 'User has remaining database references. Check admin_invoices and usage_sessions for this user.'
            : undefined,
        },
        { status: 500 }
      )
    }

    console.log(`[Admin API] User ${user.email} deleted user ${userId} (${userData.email}). Stripe subscription: ${userData.subscription_id ? 'cancelled' : 'none'}, cleared ${clearedInvoices?.length || 0} invoice user refs`)

    await logNotification({
      type: 'account_deleted',
      title: `Deleted user ${userData.email}`,
      message: `Stripe subscription: ${userData.subscription_id ? 'cancelled' : 'none'}${
        (clearedInvoices?.length || 0) > 0
          ? ` · Cleared ${clearedInvoices!.length} invoice reference(s) (kept for audit)`
          : ''
      }${stripeError ? ` · ${stripeError}` : ''}`,
      actorEmail: user.email,
      targetEmail: userData.email,
      metadata: {
        deleted_user_id: userId,
        had_subscription: !!userData.subscription_id,
        stripe_subscription_id: userData.subscription_id || null,
        stripe_customer_id: userData.customer_id || null,
        cleared_invoice_ids: clearedInvoices?.map(i => i.id) || [],
        stripe_cancel_error: stripeError,
      },
      client: adminClient,
    })

    return NextResponse.json({
      success: true,
      message: 'User deleted successfully',
      stripeError: stripeError ? stripeError : undefined,
      clearedInvoiceCount: clearedInvoices?.length || 0,
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
