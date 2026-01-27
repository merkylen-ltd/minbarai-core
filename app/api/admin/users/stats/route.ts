import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/admin'
import { cookies } from 'next/headers'

/**
 * GET /api/admin/users/stats
 * Get aggregated user statistics
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

    // Get counts by status
    const { data: statusCounts } = await adminClient
      .from('users')
      .select('subscription_status')

    // Count by status
    const stats: Record<string, number> = {}
    statusCounts?.forEach((user) => {
      const status = user.subscription_status || 'unknown'
      stats[status] = (stats[status] || 0) + 1
    })

    // Get user activity (last 7 days)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const { count: activeLastWeek } = await adminClient
      .from('usage_sessions')
      .select('user_id', { count: 'exact', head: true })
      .gte('started_at', sevenDaysAgo.toISOString())

    // Get total usage time
    const { data: usageStats } = await adminClient
      .rpc('get_usage_statistics')

    return NextResponse.json({
      statusBreakdown: stats,
      activeLastWeek: activeLastWeek || 0,
      totalUsage: usageStats || null,
    })
  } catch (error) {
    console.error('[Admin API] Exception in GET /api/admin/users/stats:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: error instanceof Error && error.name === 'AdminAccessDeniedError' ? 403 : 500 }
    )
  }
}
