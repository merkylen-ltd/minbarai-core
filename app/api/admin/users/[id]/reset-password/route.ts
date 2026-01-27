import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/admin'
import { cookies } from 'next/headers'

/**
 * POST /api/admin/users/[id]/reset-password
 * Send a password reset email to a user
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

    // Get user email
    const { data: userData, error: fetchError } = await adminClient
      .from('users')
      .select('email')
      .eq('id', userId)
      .single()

    if (fetchError || !userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Use Supabase Auth to send password reset email
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      userData.email,
      {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/reset-password`,
      }
    )

    if (resetError) {
      console.error('[Admin API] Error sending password reset:', resetError)
      return NextResponse.json({ error: 'Failed to send password reset email' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Password reset email sent successfully',
    })
  } catch (error) {
    console.error('[Admin API] Exception in POST /api/admin/users/[id]/reset-password:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: error instanceof Error && error.name === 'AdminAccessDeniedError' ? 403 : 500 }
    )
  }
}
