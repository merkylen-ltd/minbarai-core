import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/admin'
import { cookies } from 'next/headers'
import { startOfDay, subDays, format } from 'date-fns'

/**
 * GET /api/admin/analytics/signups
 * Get signup trends over time
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

    // Get query parameters
    const searchParams = request.nextUrl.searchParams
    const period = searchParams.get('period') || '30d'

    // Parse period
    const days = period === '7d' ? 7 : period === '90d' ? 90 : 30

    const adminClient = createAdminClient()

    // Get all users created in the period
    const periodStart = startOfDay(subDays(new Date(), days))
    
    const { data: users, error } = await adminClient
      .from('users')
      .select('created_at')
      .gte('created_at', periodStart.toISOString())
      .order('created_at', { ascending: true })

    if (error) {
      console.error('[Admin API] Error fetching signups:', error)
      return NextResponse.json({ error: 'Failed to fetch signups' }, { status: 500 })
    }

    // Group by day
    const signupsByDay: { [key: string]: number } = {}
    
    // Initialize all days with 0
    for (let i = 0; i < days; i++) {
      const date = startOfDay(subDays(new Date(), days - i - 1))
      const dateKey = format(date, 'yyyy-MM-dd')
      signupsByDay[dateKey] = 0
    }

    // Count signups per day
    users?.forEach((userData) => {
      const date = startOfDay(new Date(userData.created_at))
      const dateKey = format(date, 'yyyy-MM-dd')
      if (signupsByDay.hasOwnProperty(dateKey)) {
        signupsByDay[dateKey]++
      }
    })

    // Convert to array format
    const signupTrend = Object.entries(signupsByDay).map(([date, count]) => ({
      date,
      count,
    }))

    return NextResponse.json({
      period: `${days}d`,
      signups: signupTrend,
    })
  } catch (error) {
    console.error('[Admin API] Exception in GET /api/admin/analytics/signups:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: error instanceof Error && error.name === 'AdminAccessDeniedError' ? 403 : 500 }
    )
  }
}
