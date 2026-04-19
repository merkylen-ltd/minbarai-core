import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/admin'
import { cookies } from 'next/headers'
import { sendAdminEmail } from '@/lib/email/resend'
import { generateReactivationEmailHtml } from '@/lib/email/templates/admin-message'

/**
 * POST /api/admin/users/[id]/activate
 * Activate a suspended user account
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
    const { sendEmail = true } = body

    const adminClient = createAdminClient()

    // Get user data first
    const { data: userData, error: fetchError } = await adminClient
      .from('users')
      .select('email')
      .eq('id', userId)
      .single()

    if (fetchError || !userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Clear the admin suspension flag — leave subscription_status to Stripe
    const { error: updateError } = await adminClient
      .from('users')
      .update({
        is_suspended: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)

    if (updateError) {
      console.error('[Admin API] Error activating user:', updateError)
      return NextResponse.json({ error: 'Failed to activate user' }, { status: 500 })
    }

    // Send reactivation email if requested
    if (sendEmail && userData.email) {
      const emailHtml = generateReactivationEmailHtml()
      await sendAdminEmail(userData.email, 'Account Reactivated', emailHtml)
    }

    console.log(`[Admin API] User ${user.email} activated user ${userId} (${userData.email})`)

    return NextResponse.json({
      success: true,
      message: 'User activated successfully',
    })
  } catch (error) {
    console.error('[Admin API] Exception in POST /api/admin/users/[id]/activate:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: error instanceof Error && error.name === 'AdminAccessDeniedError' ? 403 : 500 }
    )
  }
}
