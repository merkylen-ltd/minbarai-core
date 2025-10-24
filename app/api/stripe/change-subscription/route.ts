import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe/config'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'

/**
 * API endpoint for upgrading or downgrading subscriptions
 * Handles proration automatically via Stripe
 * 
 * POST /api/stripe/change-subscription
 * Body: { new_price_id: string, proration_behavior?: 'create_prorations' | 'none' | 'always_invoice' }
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies()
    const supabase = createClient(cookieStore)

    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { new_price_id, proration_behavior = 'create_prorations' } = body

    if (!new_price_id) {
      return NextResponse.json(
        { error: 'new_price_id is required' },
        { status: 400 }
      )
    }

    // Validate proration_behavior
    const validProrationBehaviors = ['create_prorations', 'none', 'always_invoice']
    if (!validProrationBehaviors.includes(proration_behavior)) {
      return NextResponse.json(
        { error: `Invalid proration_behavior. Must be one of: ${validProrationBehaviors.join(', ')}` },
        { status: 400 }
      )
    }

    // Get user data from database
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('subscription_id, customer_id, subscription_status')
      .eq('id', user.id)
      .single()

    if (userError || !userData) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    if (!userData.subscription_id) {
      return NextResponse.json(
        { error: 'No active subscription found. Please create a subscription first.' },
        { status: 400 }
      )
    }

    if (!['active', 'trialing'].includes(userData.subscription_status)) {
      return NextResponse.json(
        { 
          error: `Cannot change subscription with status: ${userData.subscription_status}. Subscription must be active or trialing.`,
          current_status: userData.subscription_status
        },
        { status: 400 }
      )
    }

    if (!stripe) {
      return NextResponse.json(
        { error: 'Stripe is not properly configured' },
        { status: 500 }
      )
    }

    try {
      // Get current subscription
      const currentSubscription = await stripe.subscriptions.retrieve(userData.subscription_id)
      
      // Check if subscription has only one item (as expected)
      if (currentSubscription.items.data.length !== 1) {
        return NextResponse.json(
          { error: 'Subscription has multiple items. Please contact support for plan changes.' },
          { status: 400 }
        )
      }

      const subscriptionItem = currentSubscription.items.data[0]
      const currentPriceId = subscriptionItem.price.id

      // Check if trying to change to the same price
      if (currentPriceId === new_price_id) {
        return NextResponse.json(
          { error: 'You are already on this plan' },
          { status: 400 }
        )
      }

      // Get the new price details to validate it exists
      let newPrice
      try {
        newPrice = await stripe.prices.retrieve(new_price_id)
      } catch (error) {
        return NextResponse.json(
          { error: 'Invalid price ID. The selected plan may not exist.' },
          { status: 400 }
        )
      }

      // Ensure the new price is for a subscription (not one-time)
      if (newPrice.type !== 'recurring') {
        return NextResponse.json(
          { error: 'Selected price is not for a subscription plan' },
          { status: 400 }
        )
      }

      // Ensure the new price has the same billing interval (month/year)
      // Changing intervals (e.g., monthly to yearly) requires special handling
      if (newPrice.recurring?.interval !== subscriptionItem.price.recurring?.interval) {
        return NextResponse.json(
          { 
            error: 'Cannot change billing interval (monthly/yearly) with this endpoint. Please cancel and create a new subscription.',
            current_interval: subscriptionItem.price.recurring?.interval,
            new_interval: newPrice.recurring?.interval
          },
          { status: 400 }
        )
      }

      console.log(`Changing subscription ${userData.subscription_id} from ${currentPriceId} to ${new_price_id}`)

      // Update the subscription with the new price
      // Stripe will automatically handle proration
      const updatedSubscription = await stripe.subscriptions.update(
        userData.subscription_id,
        {
          items: [
            {
              id: subscriptionItem.id,
              price: new_price_id,
            },
          ],
          proration_behavior: proration_behavior,
          // Optionally prorate immediately and invoice
          billing_cycle_anchor: 'unchanged', // Keep current billing cycle
          metadata: {
            ...currentSubscription.metadata,
            previous_price_id: currentPriceId,
            changed_at: new Date().toISOString(),
            changed_by: 'user',
          }
        }
      )

      console.log(`Successfully changed subscription ${userData.subscription_id} to new price ${new_price_id}`)

      // Calculate proration details if available
      let prorationAmount = 0
      if (proration_behavior === 'create_prorations') {
        // The proration will be added to the next invoice
        // We can retrieve the upcoming invoice to show the proration
        try {
          const upcomingInvoice = await stripe.invoices.retrieveUpcoming({
            customer: userData.customer_id,
            subscription: userData.subscription_id,
          })
          
          // Sum up proration line items
          const prorationLines = upcomingInvoice.lines.data.filter(line => line.proration)
          prorationAmount = prorationLines.reduce((sum, line) => sum + (line.amount || 0), 0)
        } catch (error) {
          console.error('Error retrieving upcoming invoice:', error)
        }
      }

      // Note: Database will be updated via webhook (customer.subscription.updated)
      // But we can update immediately for faster UX
      await supabase
        .from('users')
        .update({
          subscription_status: updatedSubscription.status,
          subscription_period_end: updatedSubscription.current_period_end 
            ? new Date(updatedSubscription.current_period_end * 1000).toISOString()
            : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)

      return NextResponse.json({
        success: true,
        message: 'Subscription plan changed successfully',
        subscription: {
          id: updatedSubscription.id,
          status: updatedSubscription.status,
          current_period_end: updatedSubscription.current_period_end,
          new_price_id: new_price_id,
          previous_price_id: currentPriceId,
        },
        proration: {
          behavior: proration_behavior,
          amount: prorationAmount,
          currency: newPrice.currency,
          description: prorationAmount > 0 
            ? 'You will be charged a prorated amount for the upgrade' 
            : prorationAmount < 0 
            ? 'You will receive a credit for the downgrade' 
            : 'No proration will be applied',
        }
      })

    } catch (stripeError: any) {
      console.error('Stripe error changing subscription:', stripeError)
      
      // Handle specific Stripe errors
      if (stripeError.type === 'StripeInvalidRequestError') {
        return NextResponse.json(
          { 
            error: 'Invalid request to Stripe',
            message: stripeError.message 
          },
          { status: 400 }
        )
      }
      
      throw stripeError
    }

  } catch (error: any) {
    console.error('Error changing subscription:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to change subscription',
        message: error.message || 'An unexpected error occurred'
      },
      { status: 500 }
    )
  }
}

/**
 * GET endpoint to preview subscription changes
 * Shows proration amounts before making the change
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies()
    const supabase = createClient(cookieStore)

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get new_price_id from query params
    const { searchParams } = new URL(request.url)
    const new_price_id = searchParams.get('new_price_id')

    if (!new_price_id) {
      return NextResponse.json(
        { error: 'new_price_id query parameter is required' },
        { status: 400 }
      )
    }

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('subscription_id, customer_id, subscription_status')
      .eq('id', user.id)
      .single()

    if (userError || !userData || !userData.subscription_id) {
      return NextResponse.json(
        { error: 'No active subscription found' },
        { status: 404 }
      )
    }

    if (!stripe) {
      return NextResponse.json(
        { error: 'Stripe is not properly configured' },
        { status: 500 }
      )
    }

    // Get current subscription
    const currentSubscription = await stripe.subscriptions.retrieve(userData.subscription_id)
    const subscriptionItem = currentSubscription.items.data[0]

    // Preview what the upcoming invoice would look like with the change
    const upcomingInvoice = await stripe.invoices.retrieveUpcoming({
      customer: userData.customer_id,
      subscription: userData.subscription_id,
      subscription_items: [
        {
          id: subscriptionItem.id,
          price: new_price_id,
        },
      ],
      subscription_proration_behavior: 'create_prorations',
    })

    // Calculate proration details
    const prorationLines = upcomingInvoice.lines.data.filter(line => line.proration)
    const prorationAmount = prorationLines.reduce((sum, line) => sum + (line.amount || 0), 0)

    return NextResponse.json({
      preview: {
        current_price_id: subscriptionItem.price.id,
        new_price_id: new_price_id,
        immediate_charge: upcomingInvoice.amount_due,
        proration_amount: prorationAmount,
        currency: upcomingInvoice.currency,
        next_payment_date: upcomingInvoice.period_end,
        line_items: upcomingInvoice.lines.data.map(line => ({
          description: line.description,
          amount: line.amount,
          proration: line.proration,
        })),
      }
    })

  } catch (error: any) {
    console.error('Error previewing subscription change:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to preview subscription change',
        message: error.message || 'An unexpected error occurred'
      },
      { status: 500 }
    )
  }
}

