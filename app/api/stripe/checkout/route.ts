import { createClient } from '@/lib/supabase/server'
import { stripe, getURL, PRICE_ID } from '@/lib/stripe/config'
import { PRICING_CONFIG, getPlanById, PricingPlan } from '@/lib/pricing'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    // Check if Stripe is properly configured
    if (!stripe) {
      return NextResponse.json(
        { error: 'Stripe is not properly configured. Please contact support.' },
        { status: 500 }
      )
    }

    const { price_id = PRICE_ID, planId, price, planName } = await request.json()
    
    let finalPriceId = price_id
    let planData: PricingPlan | null = null
    
    // If planId is provided, get plan data from pricing config
    if (planId) {
      planData = getPlanById(planId) || null
      if (!planData) {
        return NextResponse.json(
          { error: `Plan with ID '${planId}' not found in pricing configuration` },
          { status: 400 }
        )
      }
      
      // Use plan data for price and name if not provided
      const planPrice = price || planData.price
      const planNameToUse = planName || planData.name
      
      if (!planPrice) {
        return NextResponse.json(
          { error: `Plan '${planId}' is not available for purchase (coming soon or no price set)` },
          { status: 400 }
        )
      }
      
      // If we don't have a valid price ID but have plan info, create a price dynamically
      if ((!price_id || 
          price_id === 'price_1SB0jD484U6B4yaGMAb6nlZ8' || 
          price_id === 'price_placeholder_50_euro_monthly' ||
          price_id.startsWith('prod_')) && planPrice && planNameToUse) {
        
        // First, try to find an existing product with the same name
        const existingProducts = await stripe.products.list({
          active: true,
          limit: 100
        })
        
        let product = existingProducts.data.find(p => p.name === planNameToUse)
        
        // If no existing product found, create a new one
        if (!product) {
          console.log(`Creating new product: ${planNameToUse}`)
          product = await stripe.products.create({
            name: planNameToUse,
            description: planData.description,
          })
        } else {
          console.log(`Using existing product: ${product.id} for ${planNameToUse}`)
        }
        
        // Check if there's already a price for this product with the same amount
        const existingPrices = await stripe.prices.list({
          product: product.id,
          active: true,
          limit: 100
        })
        
        let stripePrice = existingPrices.data.find(p => 
          p.unit_amount === Math.round(planPrice * 100) && 
          p.currency === PRICING_CONFIG.currency.toLowerCase() &&
          p.recurring?.interval === planData?.interval
        )
        
        // If no existing price found, create a new one
        if (!stripePrice) {
          console.log(`Creating new price for product: ${product.id}`)
          stripePrice = await stripe.prices.create({
            product: product.id,
            unit_amount: Math.round(planPrice * 100), // Convert to cents
            currency: PRICING_CONFIG.currency.toLowerCase(),
            recurring: {
              interval: planData.interval,
            },
          })
        } else {
          console.log(`Using existing price: ${stripePrice.id} for product: ${product.id}`)
        }
        
        finalPriceId = stripePrice.id
      }
    } else if ((!price_id || 
        price_id === 'price_1SB0jD484U6B4yaGMAb6nlZ8' || 
        price_id === 'price_placeholder_50_euro_monthly' ||
        price_id.startsWith('prod_')) && price && planName) {
      
      // Fallback for direct price/name provided without planId
      // First, try to find an existing product with the same name
      const existingProducts = await stripe.products.list({
        active: true,
        limit: 100
      })
      
      let product = existingProducts.data.find(p => p.name === planName)
      
      // If no existing product found, create a new one
      if (!product) {
        console.log(`Creating new product: ${planName}`)
        product = await stripe.products.create({
          name: planName,
          description: `Subscription plan for ${planName}`,
        })
      } else {
        console.log(`Using existing product: ${product.id} for ${planName}`)
      }
      
      // Check if there's already a price for this product with the same amount
      const existingPrices = await stripe.prices.list({
        product: product.id,
        active: true,
        limit: 100
      })
      
      let stripePrice = existingPrices.data.find(p => 
        p.unit_amount === Math.round(price * 100) && 
        p.currency === PRICING_CONFIG.currency.toLowerCase() &&
        p.recurring?.interval === 'month'
      )
      
      // If no existing price found, create a new one
      if (!stripePrice) {
        console.log(`Creating new price for product: ${product.id}`)
        stripePrice = await stripe.prices.create({
          product: product.id,
          unit_amount: Math.round(price * 100), // Convert to cents
          currency: PRICING_CONFIG.currency.toLowerCase(),
          recurring: {
            interval: 'month',
          },
        })
      } else {
        console.log(`Using existing price: ${stripePrice.id} for product: ${product.id}`)
      }
      
      finalPriceId = stripePrice.id
    } else if (!finalPriceId || 
        finalPriceId === 'price_1SB0jD484U6B4yaGMAb6nlZ8' || 
        finalPriceId === 'price_placeholder_50_euro_monthly' ||
        finalPriceId.startsWith('prod_')) {
      return NextResponse.json(
        { error: 'Stripe price ID not configured. Please set up a valid price ID in your Stripe dashboard. Current value appears to be a product ID instead of a price ID.' },
        { status: 400 }
      )
    }
    
    const cookieStore = cookies()
    const supabase = createClient(cookieStore)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'You must be signed in to subscribe' },
        { status: 401 }
      )
    }

    // Get or create customer
    let customer_id: string | undefined
    
    console.log(`Checkout: Checking if user ${user.id} exists in database`)
    const { data: userData, error: userDataError } = await supabase
      .from('users')
      .select('customer_id, subscription_status')
      .eq('id', user.id)
      .single()

    if (userDataError) {
      console.log('Checkout: Error fetching user data:', userDataError)
    }

    console.log('Checkout: User data from database:', userData)

    // Comprehensive check for existing subscriptions
    // Check database first for active subscriptions
    if (userData?.subscription_status && ['active', 'trialing', 'past_due'].includes(userData.subscription_status)) {
      console.log(`User ${user.id} already has subscription with status: ${userData.subscription_status}`)
      return NextResponse.json(
        { 
          error: 'You already have an active subscription. Please manage your subscription in the billing page.',
          current_status: userData.subscription_status 
        },
        { status: 400 }
      )
    }

    if (userData?.customer_id) {
      customer_id = userData.customer_id
      
      // Double-check with Stripe for any active subscriptions
      // This catches edge cases where database might be out of sync
      try {
        const existingSubscriptions = await stripe.subscriptions.list({
          customer: customer_id,
          status: 'active',
          limit: 10
        })
        
        if (existingSubscriptions.data.length > 0) {
          console.log(`Found ${existingSubscriptions.data.length} active subscriptions in Stripe for customer ${customer_id}`)
          
          // Sync the database with Stripe's data
          const latestSubscription = existingSubscriptions.data[0]
          await supabase
            .from('users')
            .update({
              subscription_id: latestSubscription.id,
              subscription_status: latestSubscription.status,
              subscription_period_end: latestSubscription.current_period_end 
                ? new Date(latestSubscription.current_period_end * 1000).toISOString()
                : null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', user.id)
          
          return NextResponse.json(
            { 
              error: 'You already have an active subscription in Stripe. Your account has been updated.',
              current_status: latestSubscription.status
            },
            { status: 400 }
          )
        }
        
        // Also check for incomplete/past_due subscriptions that might need attention
        const incompleteSubscriptions = await stripe.subscriptions.list({
          customer: customer_id,
          status: 'incomplete',
          limit: 5
        })
        
        if (incompleteSubscriptions.data.length > 0) {
          console.log(`Found ${incompleteSubscriptions.data.length} incomplete subscriptions for customer ${customer_id}`)
          return NextResponse.json(
            { 
              error: 'You have an incomplete payment. Please complete your existing subscription or contact support.',
              current_status: 'incomplete'
            },
            { status: 400 }
          )
        }
      } catch (stripeError) {
        console.error('Error checking existing subscriptions in Stripe:', stripeError)
        // Continue with checkout - don't fail if Stripe check fails
      }
      
      console.log(`Checkout: Using existing customer_id: ${customer_id}`)
    } else {
      console.log('Checkout: Creating new Stripe customer')
      // Create new customer
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          supabase_user_id: user.id,
        },
      })
      customer_id = customer.id
      console.log(`Checkout: Created customer_id: ${customer_id}`)

      // Update user with customer_id
      console.log('Checkout: Creating/updating user record in database')
      const { error: upsertError } = await supabase
        .from('users')
        .upsert({
          id: user.id,
          email: user.email,
          customer_id: customer_id,
          subscription_status: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })

      if (upsertError) {
        console.log('Checkout: Error upserting user:', upsertError)
      } else {
        console.log('Checkout: User record created/updated successfully')
      }
    }

    // Generate URLs for Stripe checkout
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || getURL().slice(0, -1)
    const successUrl = `${baseUrl}/dashboard/success`
    const cancelUrl = `${baseUrl}/subscribe?canceled=true`
    
    console.log(`Creating checkout session with URLs:`)
    console.log(`- Success URL: ${successUrl}`)
    console.log(`- Cancel URL: ${cancelUrl}`)

    // Create checkout session with additional configurations for better UX and security
    const sessionParams: any = {
      line_items: [
        {
          price: finalPriceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      // Include user_id in both metadata and client_reference_id for redundancy
      metadata: {
        user_id: user.id,
        email: user.email,
      },
      client_reference_id: user.id,
      // Allow discount codes if you have any promotional campaigns
      allow_promotion_codes: true,
      // Set billing address collection
      billing_address_collection: 'auto',
      // Subscription data
      subscription_data: {
        metadata: {
          user_id: user.id,
          created_via: 'checkout_session',
        },
        // Optional: Add trial period
        // trial_period_days: 7,
      },
      // Automatic tax calculation (if enabled in Stripe)
      automatic_tax: {
        enabled: false, // Set to true if you've configured Stripe Tax
      },
      // Session expiration (default is 24 hours)
      expires_at: Math.floor(Date.now() / 1000) + (30 * 60), // 30 minutes
    }

    // Add customer if we have one, otherwise use customer_email
    if (customer_id) {
      sessionParams.customer = customer_id
    } else {
      sessionParams.customer_email = user.email
    }

    const session = await stripe.checkout.sessions.create(sessionParams)

    console.log(`Created checkout session ${session.id} for user ${user.id}`)

    return NextResponse.json({ 
      url: session.url,
      session_id: session.id 
    })
  } catch (error: any) {
    console.error('Error creating checkout session:', error)
    
    // Provide more specific error messages based on error type
    if (error instanceof Error) {
      // Stripe API errors
      if (error.message.includes('No such price')) {
        return NextResponse.json(
          { error: 'Invalid price configuration. Please contact support.' },
          { status: 400 }
        )
      }
      
      if (error.message.includes('No such customer')) {
        return NextResponse.json(
          { error: 'Customer not found. Please try again or contact support.' },
          { status: 404 }
        )
      }
      
      if (error.message.includes('STRIPE_SECRET_KEY')) {
        return NextResponse.json(
          { error: 'Stripe configuration error: Please set up your Stripe API keys' },
          { status: 500 }
        )
      }
      
      if (error.message.includes('PRICE_ID')) {
        return NextResponse.json(
          { error: 'Stripe configuration error: Please set up your Stripe price ID' },
          { status: 500 }
        )
      }
      
      // Rate limit errors
      if (error.message.includes('rate_limit')) {
        return NextResponse.json(
          { error: 'Too many requests. Please try again in a moment.' },
          { status: 429 }
        )
      }
      
      // API connection errors
      if (error.message.includes('API connection') || error.message.includes('network')) {
        return NextResponse.json(
          { error: 'Unable to connect to payment processor. Please try again.' },
          { status: 503 }
        )
      }
    }
    
    // Generic error with safe message (don't expose internal details)
    return NextResponse.json(
      { 
        error: 'Unable to create checkout session. Please try again or contact support.',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    )
  }
}
