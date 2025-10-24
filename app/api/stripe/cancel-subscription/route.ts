import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe/config'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'

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
        { error: 'No active subscription found' },
        { status: 400 }
      )
    }

    // Check if subscription is already canceled
    if (userData.subscription_status === 'canceled') {
      return NextResponse.json(
        { error: 'Subscription is already canceled' },
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
      // Get the current subscription from Stripe to check its status
      const currentSubscription = await stripe.subscriptions.retrieve(userData.subscription_id)
      
      // Check if subscription is already set to cancel at period end
      if (currentSubscription.cancel_at_period_end) {
        return NextResponse.json({
          success: true,
          message: 'Subscription is already set to cancel at period end',
          subscription: {
            id: currentSubscription.id,
            status: currentSubscription.status,
            cancel_at_period_end: true,
            current_period_end: currentSubscription.current_period_end,
          }
        })
      }

      // Cancel at period end (allows user to continue using until paid period expires)
      // This is the recommended approach for better user experience
      const updatedSubscription = await stripe.subscriptions.update(
        userData.subscription_id,
        { 
          cancel_at_period_end: true,
          // Optional: Add cancellation metadata for tracking
          metadata: {
            ...currentSubscription.metadata,
            canceled_at: new Date().toISOString(),
            canceled_by: 'user',
          }
        }
      )

      console.log(`Subscription ${userData.subscription_id} set to cancel at period end`)
      console.log(`User will retain access until: ${new Date(updatedSubscription.current_period_end * 1000).toISOString()}`)

      // Note: We don't update the database here because the webhook will handle it
      // when the subscription actually ends. The subscription status remains 'active'
      // until the period end, then Stripe will send customer.subscription.deleted webhook

      return NextResponse.json({
        success: true,
        message: 'Subscription will be canceled at the end of the current billing period',
        subscription: {
          id: updatedSubscription.id,
          status: updatedSubscription.status,
          cancel_at_period_end: true,
          current_period_end: updatedSubscription.current_period_end,
          canceled_at: updatedSubscription.canceled_at,
        }
      })

    } catch (stripeError: any) {
      console.error('Stripe error canceling subscription:', stripeError)
      
      // Handle specific Stripe errors
      if (stripeError.type === 'StripeInvalidRequestError') {
        if (stripeError.message.includes('No such subscription')) {
          // Subscription doesn't exist in Stripe, clean up database
          await supabase
            .from('users')
            .update({
              subscription_status: null,
              subscription_id: null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', user.id)
          
          return NextResponse.json(
            { error: 'Subscription not found in Stripe. Your account has been updated.' },
            { status: 404 }
          )
        }
      }
      
      throw stripeError
    }

  } catch (error: any) {
    console.error('Error canceling subscription:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to cancel subscription',
        message: error.message || 'An unexpected error occurred'
      },
      { status: 500 }
    )
  }
}

/**
 * Optional: Add a DELETE endpoint for immediate cancellation (admin use only or explicit user request)
 * This immediately cancels the subscription without waiting for period end
 */
export async function DELETE(request: NextRequest) {
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

    // Parse request body to check for immediate cancellation confirmation
    const body = await request.json()
    const { immediate, confirm } = body

    if (!immediate || !confirm) {
      return NextResponse.json(
        { error: 'Immediate cancellation requires explicit confirmation' },
        { status: 400 }
      )
    }

    // Get user data from database
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('subscription_id, customer_id')
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

    // Immediately cancel the subscription (pro-rate and issue credit if applicable)
    const canceledSubscription = await stripe.subscriptions.cancel(
      userData.subscription_id,
      {
        prorate: true, // Issue credit for unused time
        invoice_now: false, // Don't immediately invoice
      }
    )

    console.log(`Subscription ${userData.subscription_id} immediately canceled`)

    // The webhook will handle database updates, but we can update immediately for faster UX
    await supabase
      .from('users')
      .update({
        subscription_status: 'canceled',
        subscription_period_end: null, // No period end for immediate cancellation
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)

    return NextResponse.json({
      success: true,
      message: 'Subscription canceled immediately',
      subscription: {
        id: canceledSubscription.id,
        status: canceledSubscription.status,
        canceled_at: canceledSubscription.canceled_at,
      }
    })

  } catch (error: any) {
    console.error('Error with immediate cancellation:', error)
    return NextResponse.json(
      { 
        error: 'Failed to cancel subscription immediately',
        message: error.message || 'An unexpected error occurred'
      },
      { status: 500 }
    )
  }
}
