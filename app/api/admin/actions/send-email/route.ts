import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/admin'
import { cookies } from 'next/headers'
import { sendAdminEmail } from '@/lib/email/resend'
import { generateAdminMessageHtml } from '@/lib/email/templates/admin-message'

/**
 * POST /api/admin/actions/send-email
 * Send an email to a user
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
    const { userId, userEmail, subject, message } = body

    // Validate required fields
    if (!subject || !message) {
      return NextResponse.json({ error: 'Subject and message are required' }, { status: 400 })
    }

    if (!userId && !userEmail) {
      return NextResponse.json({ error: 'Either userId or userEmail must be provided' }, { status: 400 })
    }

    const adminClient = createAdminClient()
    let recipientEmail: string | null = null
    let recipientUserId: string | null = null

    // If userId provided, fetch and verify user exists
    if (userId) {
      const { data: userData, error: fetchError } = await adminClient
        .from('users')
        .select('id, email')
        .eq('id', userId)
        .single()

      if (fetchError || !userData) {
        return NextResponse.json({ error: 'User not found in system' }, { status: 404 })
      }

      recipientEmail = userData.email
      recipientUserId = userData.id
    }
    // If only userEmail provided, verify it exists in users table
    else if (userEmail) {
      const { data: userData, error: fetchError } = await adminClient
        .from('users')
        .select('id, email')
        .eq('email', userEmail)
        .single()

      if (fetchError || !userData) {
        return NextResponse.json({
          error: 'User email not found in system. Only registered users can receive emails.',
          code: 'USER_NOT_FOUND'
        }, { status: 404 })
      }

      recipientEmail = userData.email
      recipientUserId = userData.id
    }

    // This should never happen due to earlier checks, but be defensive
    if (!recipientEmail || !recipientUserId) {
      return NextResponse.json({ error: 'Unable to verify recipient' }, { status: 400 })
    }

    // Generate email HTML
    const emailHtml = generateAdminMessageHtml(subject, message, user.email)

    // Send email
    const result = await sendAdminEmail(recipientEmail, subject, emailHtml)

    if (!result.success) {
      console.error('[Admin API] Failed to send email to', recipientEmail, ':', result.error)
      return NextResponse.json({ error: result.error || 'Failed to send email' }, { status: 500 })
    }

    // Log successful email send for audit trail
    console.log('[Admin API] Email sent by', user.email, 'to user', recipientUserId, '(', recipientEmail, ')')

    return NextResponse.json({
      success: true,
      message: 'Email sent successfully',
      emailId: result.id,
      recipientUserId,
      recipientEmail,
    })
  } catch (error) {
    console.error('[Admin API] Exception in POST /api/admin/actions/send-email:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: error instanceof Error && error.name === 'AdminAccessDeniedError' ? 403 : 500 }
    )
  }
}
