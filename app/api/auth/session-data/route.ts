import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { isValidSubscriptionStatus, getSessionLimit, isValidForTranslation } from '@/lib/subscription'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const cookieStore = cookies()
    const supabase = createClient(cookieStore)
    
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Get user data
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select(`
        id,
        email,
        subscription_status,
        subscription_id,
        customer_id,
        subscription_period_end,
        session_limit_minutes,
        created_at,
        updated_at
      `)
      .eq('id', user.id)
      .single()

    if (userError || !userData) {
      return NextResponse.json(
        { error: 'User data not found' },
        { status: 404 }
      )
    }

    // Get active usage session
    const { data: activeSession } = await supabase
      .from('usage_sessions')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single()

    // Get total usage for user
    const { data: usageData } = await supabase
      .from('usage_sessions')
      .select('duration_seconds')
      .eq('user_id', user.id)

    const totalUsageSeconds = usageData?.reduce((sum, session) => sum + (session.duration_seconds || 0), 0) || 0
    const totalUsageMinutes = Math.floor(totalUsageSeconds / 60)

    const sessionLimitMinutes = getSessionLimit(userData.subscription_status, userData.session_limit_minutes)

    // Prepare response data
    const responseData = {
      user: userData,
      activeSession: activeSession ? {
        id: activeSession.id,
        started_at: activeSession.started_at,
        last_seen_at: activeSession.last_seen_at,
        max_end_at: activeSession.max_end_at,
        status: activeSession.status
      } : null,
      sessionLimitMinutes,
      isValidSubscription: isValidForTranslation(userData.subscription_status),
      totalUsageMinutes,
      totalUsageSeconds,
      isSessionExpired: activeSession ? 
        (new Date() >= new Date(activeSession.max_end_at)) : false
    }

    return NextResponse.json(responseData)
  } catch (error) {
    console.error('Session data API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
