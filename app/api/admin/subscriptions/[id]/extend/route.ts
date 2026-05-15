import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/admin'
import { cookies } from 'next/headers'

/**
 * POST /api/admin/subscriptions/[id]/extend
 * Extend a user's subscription period
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
    const body = await request.json()
    const { days = 30 } = body

    if (!Number.isInteger(days) || days <= 0 || days > 3650) {
      return NextResponse.json(
        { error: 'days must be a positive integer between 1 and 3650' },
        { status: 400 }
      )
    }

    const adminClient = createAdminClient()

    // Get current subscription data
    const { data: userData, error: fetchError } = await adminClient
      .from('users')
      .select('subscription_period_end')
      .eq('id', userId)
      .single()

    if (fetchError || !userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Calculate new period end
    const currentEnd = userData.subscription_period_end 
      ? new Date(userData.subscription_period_end)
      : new Date()
    
    const newEnd = new Date(currentEnd.getTime() + days * 24 * 60 * 60 * 1000)

    // Update subscription period
    const { error: updateError } = await adminClient
      .from('users')
      .update({
        subscription_period_end: newEnd.toISOString(),
        subscription_status: 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)

    if (updateError) {
      console.error('[Admin API] Error extending subscription:', updateError)
      return NextResponse.json({ error: 'Failed to extend subscription' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `Subscription extended by ${days} days`,
      newPeriodEnd: newEnd.toISOString(),
    })
  } catch (error) {
    console.error('[Admin API] Exception in POST /api/admin/subscriptions/[id]/extend:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: error instanceof Error && error.name === 'AdminAccessDeniedError' ? 403 : 500 }
    )
  }
}
