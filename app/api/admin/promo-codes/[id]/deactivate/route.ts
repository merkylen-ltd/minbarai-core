import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/admin'
import { cookies } from 'next/headers'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
})

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    requireAdmin(user.email)

    const adminClient = createAdminClient()
    const promoId = params.id

    const { data: promo, error } = await adminClient
      .from('promo_codes')
      .select('*')
      .eq('id', promoId)
      .single()

    if (error || !promo) {
      return NextResponse.json(
        { error: 'Promo code not found' },
        { status: 404 }
      )
    }

    if (!promo.stripe_promotion_code_id) {
      return NextResponse.json(
        { error: 'Promo code has no Stripe ID' },
        { status: 400 }
      )
    }

    await stripe.promotionCodes.update(promo.stripe_promotion_code_id, {
      active: false,
    })

    const { error: updateError } = await adminClient
      .from('promo_codes')
      .update({ is_active: false })
      .eq('id', promoId)

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to update promo code' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Promo code deactivated successfully',
    })
  } catch (error) {
    console.error('Deactivate promo code error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to deactivate promo code' },
      { status: 500 }
    )
  }
}
