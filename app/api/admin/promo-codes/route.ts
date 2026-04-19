import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/admin'
import { cookies } from 'next/headers'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
})

interface CreatePromoCodeRequest {
  code: string
  discountType: 'amount_off' | 'percent_off'
  amount?: number
  percent?: number
  currency?: string
  maxRedemptions?: number
  expiresAt?: string
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    requireAdmin(user.email)

    const body: CreatePromoCodeRequest = await request.json()

    if (!body.code || !body.discountType) {
      return NextResponse.json(
        { error: 'Missing required fields: code, discountType' },
        { status: 400 }
      )
    }

    const adminClient = createAdminClient()

    const { data: existing } = await adminClient
      .from('promo_codes')
      .select('id')
      .eq('code', body.code.toUpperCase())
      .single()

    if (existing) {
      return NextResponse.json(
        { error: 'Promo code already exists' },
        { status: 409 }
      )
    }

    let amountOffCents: number | null = null
    let percentOff: number | null = null
    let currency: string | null = null

    if (body.discountType === 'amount_off') {
      if (!body.amount || !body.currency) {
        return NextResponse.json(
          { error: 'amount_off requires amount and currency' },
          { status: 400 }
        )
      }
      amountOffCents = Math.round(body.amount * 100)
      currency = body.currency.toLowerCase()
    } else if (body.discountType === 'percent_off') {
      if (!body.percent || body.percent <= 0 || body.percent > 100) {
        return NextResponse.json(
          { error: 'percent_off must be between 0 and 100' },
          { status: 400 }
        )
      }
      percentOff = parseFloat(body.percent.toFixed(2))
    }

    const couponParams: Stripe.CouponCreateParams = {
      name: body.code.toUpperCase(),
      ...(body.maxRedemptions && { max_redemptions: body.maxRedemptions }),
    }

    if (amountOffCents !== null && currency) {
      couponParams.amount_off = amountOffCents
      couponParams.currency = currency
    } else if (percentOff !== null) {
      couponParams.percent_off = percentOff
    }

    const stripeCoupon = await stripe.coupons.create(couponParams)

    const stripePromotionCode = await stripe.promotionCodes.create({
      coupon: stripeCoupon.id,
      code: body.code.toUpperCase(),
      active: true,
      max_redemptions: body.maxRedemptions || undefined,
      expires_at: body.expiresAt ? Math.floor(new Date(body.expiresAt).getTime() / 1000) : undefined,
    })

    const { data: promoCode, error: insertError } = await adminClient
      .from('promo_codes')
      .insert({
        code: body.code.toUpperCase(),
        amount_off_cents: amountOffCents,
        percent_off: percentOff,
        currency: currency,
        stripe_coupon_id: stripeCoupon.id,
        stripe_promotion_code_id: stripePromotionCode.id,
        max_redemptions: body.maxRedemptions || null,
        created_by_email: user.email || '',
        expires_at: body.expiresAt ? new Date(body.expiresAt).toISOString() : null,
      })
      .select()
      .single()

    if (insertError) {
      console.error('Failed to insert promo code:', insertError)
      return NextResponse.json(
        { error: 'Failed to save promo code' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      promoCode: promoCode,
    })
  } catch (error) {
    console.error('Create promo code error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create promo code' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    requireAdmin(user.email)

    const adminClient = createAdminClient()
    const { data: promoCodes, error } = await adminClient
      .from('promo_codes')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      promoCodes: promoCodes || [],
    })
  } catch (error) {
    console.error('Get promo codes error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch promo codes' },
      { status: 500 }
    )
  }
}
