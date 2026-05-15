import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/admin'

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    requireAdmin(user.email)

    const searchParams = request.nextUrl.searchParams
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200)
    const since = searchParams.get('since') // ISO date — for bell polling

    const adminClient = createAdminClient()
    let query = adminClient
      .from('admin_notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (since) {
      query = query.gte('created_at', since)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Also return the 24h count so the bell doesn't need a second query
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { count } = await adminClient
      .from('admin_notifications')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', dayAgo)

    return NextResponse.json({
      notifications: data || [],
      recentCount: count || 0,
    })
  } catch (error) {
    console.error('[Admin API] Exception in GET /api/admin/notifications:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: error instanceof Error && error.name === 'AdminAccessDeniedError' ? 403 : 500 }
    )
  }
}
