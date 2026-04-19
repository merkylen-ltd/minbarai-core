import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/admin'
import { cookies } from 'next/headers'

/**
 * POST /api/admin/users/[id]/reset-usage
 * Delete all usage sessions for a user (reset quota)
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
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

    // Delete all usage sessions for this user
    const { count, error: deleteError } = await adminClient
      .from('usage_sessions')
      .delete()
      .eq('user_id', userId)

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      email: userData.email,
      deletedCount: count || 0
    })
  } catch (error) {
    console.error('[Admin API] Exception in POST /api/admin/users/[id]/reset-usage:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: error instanceof Error && error.name === 'AdminAccessDeniedError' ? 403 : 500 }
    )
  }
}
