import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/admin'
import { cookies } from 'next/headers'

/**
 * GET /api/admin/analytics/usage
 * Get usage statistics across all users
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

    // Get total usage statistics
    const { data: totalStats, error: totalError } = await adminClient
      .rpc('get_usage_statistics')

    if (totalError) {
      console.error('[Admin API] Error fetching total usage stats:', totalError)
    }

    // Get session counts by status
    const { data: sessionStats, error: sessionError } = await adminClient
      .from('usage_sessions')
      .select('status')

    if (sessionError) {
      console.error('[Admin API] Error fetching session stats:', sessionError)
    }

    // Count sessions by status
    const statusCounts: { [key: string]: number } = {
      active: 0,
      closed: 0,
      expired: 0,
      capped: 0,
    }

    sessionStats?.forEach((session) => {
      const status = session.status || 'closed'
      statusCounts[status] = (statusCounts[status] || 0) + 1
    })

    return NextResponse.json({
      total: totalStats || null,
      sessionsByStatus: statusCounts,
    })
  } catch (error) {
    console.error('[Admin API] Exception in GET /api/admin/analytics/usage:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: error instanceof Error && error.name === 'AdminAccessDeniedError' ? 403 : 500 }
    )
  }
}
