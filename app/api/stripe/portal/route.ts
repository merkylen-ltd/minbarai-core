import { createClient } from '@/lib/supabase/server'
import { stripe, getURL } from '@/lib/stripe/config'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const cookieStore = cookies()
    const supabase = createClient(cookieStore)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'You must be signed in to access the customer portal' },
        { status: 401 }
      )
    }

    // Get user data to find customer ID
    const { data: userData } = await supabase
      .from('users')
      .select('customer_id')
      .eq('id', user.id)
      .single()

    if (!userData?.customer_id) {
      return NextResponse.json(
        { error: 'No customer found. Please subscribe first.' },
        { status: 400 }
      )
    }

    if (!stripe) {
      return NextResponse.json(
        { error: 'Stripe is not properly configured' },
        { status: 500 }
      )
    }

    // Create a portal session
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: userData.customer_id,
      return_url: `${process.env.NEXT_PUBLIC_SITE_URL || getURL()}dashboard/billing`,
    })

    return NextResponse.json({ url: portalSession.url })
  } catch (error) {
    console.error('Error creating portal session:', error)
    
    if (error instanceof Error) {
      if (error.message.includes('STRIPE_SECRET_KEY')) {
        return NextResponse.json(
          { error: 'Stripe configuration error: Please set up your Stripe API keys' },
          { status: 500 }
        )
      }
    }
    
    return NextResponse.json(
      { error: 'Unable to create customer portal session. Please contact support.' },
      { status: 500 }
    )
  }
}
