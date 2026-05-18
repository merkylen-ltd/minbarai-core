import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/admin'
import { cookies } from 'next/headers'

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
    const code = searchParams.get('code')
    const currency = searchParams.get('currency')
    const amountCents = searchParams.get('amountCents')

    if (!code || !currency || !amountCents) {
      return NextResponse.json(
        { error: 'Missing required query params: code, currency, amountCents' },
        { status: 400 }
      )
    }

    const adminClient = createAdminClient()
    const { data: promo, error } = await adminClient
      .from('promo_codes')
      .select('*')
      .eq('code', code.toUpperCase())
      .single()

    if (error || !promo) {
      return NextResponse.json({
        valid: false,
        reason: 'Code not found',
      })
    }

    if (!promo.is_active) {
      return NextResponse.json({
        valid: false,
        reason: 'Code is not active',
      })
    }

    if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
      return NextResponse.json({
        valid: false,
        reason: 'Code has expired',
      })
    }

    if (promo.max_redemptions && promo.redemptions_count >= promo.max_redemptions) {
      return NextResponse.json({
        valid: false,
        reason: 'Code has reached max redemptions',
      })
    }

    if (promo.amount_off_cents && promo.currency !== currency.toLowerCase()) {
      return NextResponse.json({
        valid: false,
        reason: `Code currency (${promo.currency}) does not match (${currency.toLowerCase()})`,
      })
    }

    const amountCentsNum = parseInt(amountCents, 10)
    if (isNaN(amountCentsNum) || amountCentsNum <= 0) {
      return NextResponse.json({ error: 'amountCents must be a positive integer' }, { status: 400 })
    }
    let discountCents = 0

    if (promo.amount_off_cents) {
      discountCents = promo.amount_off_cents
    } else if (promo.percent_off) {
      discountCents = Math.round((amountCentsNum * parseFloat(promo.percent_off.toString())) / 100)
    }

    const finalAmountCents = Math.max(0, amountCentsNum - discountCents)

    return NextResponse.json({
      valid: true,
      code: promo.code,
      discountType: promo.amount_off_cents ? 'amount_off' : 'percent_off',
      discountAmount: discountCents,
      originalAmount: amountCentsNum,
      finalAmount: finalAmountCents,
      savings: discountCents,
      savingsPercent: amountCentsNum > 0 ? ((discountCents / amountCentsNum) * 100).toFixed(1) : '0.0',
    })
  } catch (error) {
    console.error('Validate promo code error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to validate promo code' },
      { status: 500 }
    )
  }
}
