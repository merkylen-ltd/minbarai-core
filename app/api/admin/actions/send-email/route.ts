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
    const { userId, userEmail, subject, message, template } = body

    // Validate required fields
    if (!subject || !message) {
      return NextResponse.json({ error: 'Subject and message are required' }, { status: 400 })
    }

    let recipientEmail = userEmail

    // If userId provided, fetch user email
    if (userId && !userEmail) {
      const adminClient = createAdminClient()
      const { data: userData, error: fetchError } = await adminClient
        .from('users')
        .select('email')
        .eq('id', userId)
        .single()

      if (fetchError || !userData) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }

      recipientEmail = userData.email
    }

    if (!recipientEmail) {
      return NextResponse.json({ error: 'Recipient email is required' }, { status: 400 })
    }

    // Generate email HTML
    const emailHtml = generateAdminMessageHtml(subject, message, user.email)

    // Send email
    const result = await sendAdminEmail(recipientEmail, subject, emailHtml)

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to send email' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Email sent successfully',
      emailId: result.id,
    })
  } catch (error) {
    console.error('[Admin API] Exception in POST /api/admin/actions/send-email:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: error instanceof Error && error.name === 'AdminAccessDeniedError' ? 403 : 500 }
    )
  }
}
