import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe/config'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    // Check if Stripe is properly configured
    if (!stripe) {
      return NextResponse.json(
        { subscription: null, invoices: [] },
        { status: 200 }
      )
    }

    const cookieStore = cookies()
    const supabase = createClient(cookieStore)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'You must be signed in to access billing data' },
        { status: 401 }
      )
    }

    const { data: userData } = await supabase
      .from('users')
      .select('customer_id, subscription_id')
      .eq('id', user.id)
      .single()

    if (!userData?.customer_id || userData.customer_id.startsWith('cus_test_')) {
      return NextResponse.json(
        { subscription: null, invoices: [] },
        { status: 200 }
      )
    }

    let subscription = null
    let invoices: any[] = []

    try {
      // Get subscription details from Stripe
      if (userData.subscription_id && !userData.subscription_id.startsWith('sub_test_')) {
        subscription = await stripe!.subscriptions.retrieve(userData.subscription_id)
        
        // Get recent invoices
        const invoiceList = await stripe!.invoices.list({
          customer: userData.customer_id,
          limit: 10,
        })
        invoices = invoiceList.data
      }
    } catch (error) {
      console.error('Error fetching Stripe data:', error)
    }

    return NextResponse.json({ subscription, invoices })
  } catch (error) {
    console.error('Error in billing data API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
