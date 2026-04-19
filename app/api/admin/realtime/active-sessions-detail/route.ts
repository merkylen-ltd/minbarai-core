import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/admin'
import { cookies } from 'next/headers'

/**
 * GET /api/admin/realtime/active-sessions-detail
 * Detailed active sessions with account information
 */
export async function GET(request: NextRequest) {
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

    // Fetch active sessions with user details
    const { data: sessions, error } = await adminClient
      .from('usage_sessions')
      .select(`
        id,
        user_id,
        status,
        started_at,
        ended_at,
        duration_seconds,
        users:user_id (
          id,
          email,
          subscription_status,
          session_limit_minutes
        )
      `)
      .eq('status', 'active')
      .order('started_at', { ascending: false })

    if (error) {
      console.error('[Admin API] Error fetching active sessions:', error)
      return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 })
    }

    // Fetch all statuses for summary
    const { count: activeCount } = await adminClient
      .from('usage_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active')

    const { count: cappedCount } = await adminClient
      .from('usage_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'capped')

    const { count: expiredCount } = await adminClient
      .from('usage_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'expired')

    // Transform data
    const activeSessions = sessions?.map((session: any) => ({
      id: session.id,
      userId: session.user_id,
      email: session.users?.email || 'Unknown',
      subscriptionStatus: session.users?.subscription_status || 'none',
      sessionLimitMinutes: session.users?.session_limit_minutes || 0,
      status: session.status,
      startedAt: session.started_at,
      endedAt: session.ended_at,
      durationSeconds: session.duration_seconds,
      durationMinutes: Math.round((session.duration_seconds || 0) / 60),
    })) || []

    return NextResponse.json({
      success: true,
      activeSessions,
      summary: {
        active: activeCount || 0,
        capped: cappedCount || 0,
        expired: expiredCount || 0,
        total: (activeCount || 0) + (cappedCount || 0) + (expiredCount || 0),
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[Admin API] Exception in GET /api/admin/realtime/active-sessions-detail:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: error instanceof Error && error.name === 'AdminAccessDeniedError' ? 403 : 500 }
    )
  }
}
