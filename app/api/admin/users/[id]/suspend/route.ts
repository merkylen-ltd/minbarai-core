import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/admin'
import { cookies } from 'next/headers'
import { sendAdminEmail } from '@/lib/email/resend'
import { generateSuspensionEmailHtml } from '@/lib/email/templates/admin-message'

/**
 * POST /api/admin/users/[id]/suspend
 * Suspend a user account
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

    // Prevent self-suspension
    if (user.id === userId) {
      return NextResponse.json({ error: 'Cannot suspend your own account' }, { status: 403 })
    }

    const body = await request.json()
    const { reason, sendEmail = true } = body

    const adminClient = createAdminClient()

    // Get user data first
    const { data: userData, error: fetchError } = await adminClient
      .from('users')
      .select('email, subscription_status')
      .eq('id', userId)
      .single()

    if (fetchError || !userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { error: updateError } = await adminClient
      .from('users')
      .update({
        is_suspended: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)

    if (updateError) {
      console.error('[Admin API] Error suspending user:', updateError)
      return NextResponse.json({ error: 'Failed to suspend user' }, { status: 500 })
    }

    // Close any active usage session — suspended users must not continue recording
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

    // Send suspension email if requested
    if (sendEmail && userData.email) {
      const emailHtml = generateSuspensionEmailHtml(reason)
      await sendAdminEmail(userData.email, 'Account Suspended', emailHtml)
    }

    console.log(`[Admin API] User ${user.email} suspended user ${userId} (${userData.email})${reason ? ` - Reason: ${reason}` : ''}`)

    return NextResponse.json({
      success: true,
      message: 'User suspended successfully',
    })
  } catch (error) {
    console.error('[Admin API] Exception in POST /api/admin/users/[id]/suspend:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: error instanceof Error && error.name === 'AdminAccessDeniedError' ? 403 : 500 }
    )
  }
}
