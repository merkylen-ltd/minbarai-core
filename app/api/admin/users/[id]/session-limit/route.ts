import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/admin'
import { cookies } from 'next/headers'

/**
 * PATCH /api/admin/users/[id]/session-limit
 * Update session_limit_minutes for a user
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = params.id

    // Verify admin access
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    requireAdmin(user.email)

    const body = await request.json()
    const { sessionLimitMinutes } = body

    // Validate input
    if (sessionLimitMinutes === undefined || sessionLimitMinutes === null) {
      return NextResponse.json({ error: 'sessionLimitMinutes is required' }, { status: 400 })
    }

    if (!Number.isInteger(sessionLimitMinutes) || sessionLimitMinutes < 10 || sessionLimitMinutes > 10080) {
      return NextResponse.json({ error: 'Session limit must be between 10 and 10080 minutes' }, { status: 400 })
    }

    const adminClient = createAdminClient()

    // Verify user exists
    const { data: userData, error: userError } = await adminClient
      .from('users')
      .select('id, email')
      .eq('id', userId)
      .single()

    if (userError || !userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Update session limit
    const { error: updateError } = await adminClient
      .from('users')
      .update({ session_limit_minutes: sessionLimitMinutes })
      .eq('id', userId)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      email: userData.email,
      sessionLimitMinutes
    })
  } catch (error) {
    console.error('[Admin API] Exception in PATCH /api/admin/users/[id]/session-limit:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: error instanceof Error && error.name === 'AdminAccessDeniedError' ? 403 : 500 }
    )
  }
}
