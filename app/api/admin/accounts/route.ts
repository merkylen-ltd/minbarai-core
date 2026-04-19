import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/admin'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { sendAdminEmail } from '@/lib/email/resend'
import { adminWelcomeNewUserEmail } from '@/lib/email/templates/admin-welcome-new-user'

function generateTemporaryPassword(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'
  let password = ''
  for (let i = 0; i < 16; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return password
}

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

    const adminClient = createAdminClient()
    const body = await request.json()
    const {
      email,
      organizationName = null,
      durationDays = 30,
      sessionLimitMinutes = 120,
      sendWelcomeEmail = false,
    } = body

    // Validate input
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
    }

    // Check if account already exists
    const { data: existingUser, error: checkError } = await adminClient
      .from('users')
      .select('id, email')
      .eq('email', email.toLowerCase())
      .single()

    if (existingUser) {
      // Account exists - return 409 to indicate it exists but allow invoice creation
      return NextResponse.json(
        {
          existed: true,
          userId: existingUser.id,
          email: existingUser.email,
        },
        { status: 409 }
      )
    }

    // Generate temporary password
    const temporaryPassword = generateTemporaryPassword()

    // Create auth user
    const { data, error: authError } = await adminClient.auth.admin.createUser({
      email: email.toLowerCase(),
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: {
        temporary_password: temporaryPassword,
        created_by_admin: true,
        created_at_timestamp: Date.now(),
      },
    })

    if (authError || !data.user) {
      console.error('Auth creation error:', authError)
      return NextResponse.json(
        { error: authError?.message || 'Failed to create account' },
        { status: 400 }
      )
    }

    const userId = data.user.id

    // Create user record in public.users table
    const { error: upsertError } = await adminClient.from('users').upsert(
      {
        id: userId,
        email: email.toLowerCase(),
        session_limit_minutes: sessionLimitMinutes,
        is_suspended: false,
      },
      { onConflict: 'id' }
    )

    if (upsertError) {
      console.error('User upsert error:', upsertError)
      // Clean up the auth user if upsert fails
      await adminClient.auth.admin.deleteUser(userId)
      return NextResponse.json({ error: 'Failed to setup user account' }, { status: 500 })
    }

    // Send welcome email if requested
    if (sendWelcomeEmail) {
      try {
        const emailTemplate = adminWelcomeNewUserEmail({
          organizationName: organizationName || 'MinberAI',
          email,
          temporaryPassword,
          dashboardUrl: process.env.NEXT_PUBLIC_SITE_URL || 'https://minbarai.com',
        })
        await sendAdminEmail(email, emailTemplate.subject, emailTemplate.html)
      } catch (emailError) {
        console.error('Failed to send welcome email:', emailError)
      }
    }

    return NextResponse.json({
      success: true,
      userId,
      email: email.toLowerCase(),
      temporaryPassword,
      existed: false,
      orgName: organizationName || null,
    })
  } catch (error) {
    console.error('[Admin API] Exception in POST /api/admin/accounts:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
