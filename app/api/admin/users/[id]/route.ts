import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/admin'
import { cookies } from 'next/headers'

/**
 * GET /api/admin/users/[id]
 * Get detailed information about a specific user
 */
export async function GET(
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

    // Fetch user data
    const { data: userData, error: userError } = await adminClient
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()

    if (userError) {
      console.error('[Admin API] Error fetching user:', userError)
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Fetch usage statistics
    const { data: usageStats, error: usageError } = await adminClient
      .rpc('get_usage_statistics', { p_user_id: userId })

    if (usageError) {
      console.error('[Admin API] Error fetching usage stats:', usageError)
    }

    // Fetch recent sessions
    const { data: recentSessions, error: sessionsError } = await adminClient
      .from('usage_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('started_at', { ascending: false })
      .limit(20)

    if (sessionsError) {
      console.error('[Admin API] Error fetching sessions:', sessionsError)
    }

    // Count total sessions
    const { count: totalSessions } = await adminClient
      .from('usage_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)

    return NextResponse.json({
      user: userData,
      stats: {
        usage: usageStats || null,
        totalSessions: totalSessions || 0,
      },
      recentSessions: recentSessions || [],
    })
  } catch (error) {
    console.error('[Admin API] Exception in GET /api/admin/users/[id]:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: error instanceof Error && error.name === 'AdminAccessDeniedError' ? 403 : 500 }
    )
  }
}
