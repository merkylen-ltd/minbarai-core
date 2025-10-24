import { createClient } from '@supabase/supabase-js'
import { stripe } from '@/lib/stripe/config'
import { NextResponse } from 'next/server'
import Stripe from 'stripe'

export const runtime = 'nodejs'

// Lazy initialization of Supabase client to avoid build-time errors
function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase configuration is missing. Please check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.')
  }
  
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

// Webhook security configuration
const WEBHOOK_MAX_SIZE = 1024 * 1024 // 1MB max payload size
const WEBHOOK_RATE_LIMIT_WINDOW = 60 * 1000 // 1 minute
const WEBHOOK_RATE_LIMIT_MAX_REQUESTS = 100 // 100 requests per minute per IP

// In-memory rate limiting (consider using Redis in production for distributed systems)
const webhookRateLimitMap = new Map<string, { count: number; resetTime: number }>()

// Cleanup old rate limit entries periodically
setInterval(() => {
  const now = Date.now()
  webhookRateLimitMap.forEach((data, ip) => {
    if (now > data.resetTime) {
      webhookRateLimitMap.delete(ip)
    }
  })
}, 5 * 60 * 1000) // Cleanup every 5 minutes

function checkWebhookRateLimit(ip: string): boolean {
  const now = Date.now()
  const ipLimit = webhookRateLimitMap.get(ip)
  
  if (!ipLimit || now > ipLimit.resetTime) {
    webhookRateLimitMap.set(ip, { count: 1, resetTime: now + WEBHOOK_RATE_LIMIT_WINDOW })
    return true
  }
  
  if (ipLimit.count >= WEBHOOK_RATE_LIMIT_MAX_REQUESTS) {
    return false
  }
  
  ipLimit.count++
  return true
}

/**
 * Database-backed idempotency check
 * Returns true if event was already processed, false if new
 */
async function checkWebhookIdempotency(eventId: string, eventType: string, payload: any): Promise<boolean> {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    // Try to insert the event record
    const { data, error } = await supabaseAdmin
      .from('stripe_webhook_events')
      .insert({
        id: eventId,
        event_type: eventType,
        status: 'pending',
        payload: payload,
        created_at: new Date().toISOString()
      })
      .select()
    
    // If insert failed due to duplicate key (event already exists), return true
    if (error) {
      if (error.code === '23505') { // PostgreSQL unique violation
        console.log(`Webhook event ${eventId} already exists in database, skipping`)
        return true
      }
      // Log other errors but don't fail the request
      console.error(`Error checking idempotency for event ${eventId}:`, error)
      return false
    }
    
    // Event was successfully inserted, it's new
    return false
  } catch (error) {
    console.error(`Error in idempotency check for event ${eventId}:`, error)
    // On error, assume not processed to avoid losing events
    return false
  }
}

/**
 * Update webhook event status in database
 */
async function updateWebhookEventStatus(
  eventId: string, 
  status: 'processing' | 'completed' | 'failed', 
  error?: string
) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const updateData: any = {
      status,
      updated_at: new Date().toISOString()
    }
    
    if (status === 'processing') {
      updateData.processing_started_at = new Date().toISOString()
    } else if (status === 'completed') {
      updateData.processing_completed_at = new Date().toISOString()
    } else if (status === 'failed') {
      updateData.processing_error = error
      // Increment retry count
      const { data: currentEvent } = await supabaseAdmin
        .from('stripe_webhook_events')
        .select('retry_count')
        .eq('id', eventId)
        .single()
      
      if (currentEvent) {
        updateData.retry_count = (currentEvent.retry_count || 0) + 1
      }
    }
    
    await supabaseAdmin
      .from('stripe_webhook_events')
      .update(updateData)
      .eq('id', eventId)
  } catch (error) {
    console.error(`Error updating webhook event status for ${eventId}:`, error)
  }
}

function getClientIP(request: Request): string {
  // Cloud Run headers (preferred)
  const cloudTraceContext = request.headers.get('x-cloud-trace-context')
  const forwarded = request.headers.get('x-forwarded-for')
  const realIP = request.headers.get('x-real-ip')
  
  // Legacy headers (for compatibility)
  const cfConnectingIP = request.headers.get('cf-connecting-ip')
  
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  
  if (realIP) {
    return realIP
  }
  
  if (cfConnectingIP) {
    return cfConnectingIP
  }
  
  return 'unknown'
}

// Comprehensive list of events to handle
const relevantEvents = new Set([
  // Checkout events
  'checkout.session.completed',
  'checkout.session.expired',
  
  // Subscription events
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'customer.subscription.trial_will_end',
  
  // Invoice/Payment events
  'invoice.payment_succeeded',
  'invoice.payment_failed',
  'invoice.payment_action_required',
  'invoice.finalized',
  
  // Payment method events
  'payment_method.attached',
  'payment_method.detached',
  'payment_method.updated',
  
  // Customer events
  'customer.updated',
  'customer.deleted',
  
  // Payment intent events
  'payment_intent.succeeded',
  'payment_intent.payment_failed',
  'payment_intent.canceled',
  
  // Dispute events
  'charge.dispute.created',
  'charge.dispute.updated',
  'charge.dispute.closed',
  
  // Refund events
  'charge.refunded',
])

export async function POST(request: Request) {
  const startTime = Date.now()
  const clientIP = getClientIP(request)
  
  // Check if Stripe is properly configured
  if (!stripe) {
    console.error('Stripe is not properly configured for webhook processing')
    return NextResponse.json(
      { error: 'Stripe configuration error' },
      { status: 500 }
    )
  }
  
  // Security: Rate limiting
  if (!checkWebhookRateLimit(clientIP)) {
    console.warn(`Webhook rate limit exceeded for IP: ${clientIP}`)
    return NextResponse.json(
      { error: 'Rate limit exceeded' },
      { status: 429 }
    )
  }

  // Security: Request size validation
  const contentLength = request.headers.get('content-length')
  if (contentLength && parseInt(contentLength) > WEBHOOK_MAX_SIZE) {
    console.warn(`Webhook payload too large: ${contentLength} bytes from IP: ${clientIP}`)
    return NextResponse.json(
      { error: 'Payload too large' },
      { status: 413 }
    )
  }

  // Security: Content-Type validation
  const contentType = request.headers.get('content-type')
  if (contentType && !contentType.includes('application/json')) {
    console.warn(`Invalid content-type: ${contentType} from IP: ${clientIP}`)
    return NextResponse.json(
      { error: 'Invalid content type' },
      { status: 400 }
    )
  }

  const body = await request.text()
  const sig = request.headers.get('stripe-signature')

  console.log(`Webhook received from IP: ${clientIP}, Content-Length: ${body.length}, Signature: ${sig ? 'present' : 'missing'}`)

  let event: Stripe.Event

  try {
    if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
      throw new Error('Missing stripe signature or webhook secret')
    }

    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    )
  } catch (err) {
    console.error(`Webhook signature verification failed from IP: ${clientIP}:`, err)
    return NextResponse.json(
      { error: 'Webhook signature verification failed' },
      { status: 400 }
    )
  }

  // Database-backed idempotency check
  const alreadyProcessed = await checkWebhookIdempotency(event.id, event.type, event.data.object)
  if (alreadyProcessed) {
    console.log(`Webhook event ${event.id} already processed, skipping`)
    return NextResponse.json({ received: true, idempotent: true })
  }

  // Event type validation
  if (!relevantEvents.has(event.type)) {
    console.log(`Webhook event ${event.id} type ${event.type} not relevant, skipping`)
    // Mark as completed even though we're not processing it
    await updateWebhookEventStatus(event.id, 'completed')
    return NextResponse.json({ received: true })
  }

  console.log(`Processing webhook event ${event.id} of type ${event.type} from IP: ${clientIP}`)

  // Mark as processing
  await updateWebhookEventStatus(event.id, 'processing')

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object as Stripe.Checkout.Session
        await handleCheckoutSessionCompleted(session)
        break
      
      case 'checkout.session.expired':
        const expiredSession = event.data.object as Stripe.Checkout.Session
        await handleCheckoutSessionExpired(expiredSession)
        break
      
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionChange(subscription)
        break
      
      case 'customer.subscription.deleted':
        const deletedSubscription = event.data.object as Stripe.Subscription
        await handleSubscriptionDeleted(deletedSubscription)
        break
      
      case 'customer.subscription.trial_will_end':
        const trialEndingSubscription = event.data.object as Stripe.Subscription
        await handleTrialWillEnd(trialEndingSubscription)
        break
      
      case 'invoice.payment_succeeded':
        const invoice = event.data.object as Stripe.Invoice
        await handleInvoicePaymentSucceeded(invoice)
        break
      
      case 'invoice.payment_failed':
        const failedInvoice = event.data.object as Stripe.Invoice
        await handleInvoicePaymentFailed(failedInvoice)
        break
      
      case 'invoice.payment_action_required':
        const actionRequiredInvoice = event.data.object as Stripe.Invoice
        await handleInvoicePaymentActionRequired(actionRequiredInvoice)
        break
      
      case 'customer.updated':
        const customer = event.data.object as Stripe.Customer
        await handleCustomerUpdated(customer)
        break
      
      case 'customer.deleted':
        const deletedCustomer = event.data.object as Stripe.Customer
        await handleCustomerDeleted(deletedCustomer)
        break
      
      case 'payment_intent.payment_failed':
        const failedPaymentIntent = event.data.object as Stripe.PaymentIntent
        await handlePaymentIntentFailed(failedPaymentIntent)
        break
      
      case 'charge.dispute.created':
        const dispute = event.data.object as Stripe.Dispute
        await handleDisputeCreated(dispute)
        break
      
      case 'charge.refunded':
        const refundedCharge = event.data.object as Stripe.Charge
        await handleChargeRefunded(refundedCharge)
        break
    }

    const processingTime = Date.now() - startTime
    console.log(`Webhook event ${event.id} processed successfully in ${processingTime}ms`)
    
    // Mark as completed
    await updateWebhookEventStatus(event.id, 'completed')
    
    return NextResponse.json({ received: true })
  } catch (error) {
    const processingTime = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error(`Webhook handler failed for event ${event.id} from IP: ${clientIP} after ${processingTime}ms:`, error)
    
    // Mark as failed
    await updateWebhookEventStatus(event.id, 'failed', errorMessage)
    
    // Return 500 so Stripe will retry
    // Stripe uses exponential backoff automatically
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    )
  }
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  try {
    console.log(`Handling checkout session completed for session: ${session.id}`)
    
    const user_id = session.metadata?.user_id || session.client_reference_id
    if (!user_id) {
      console.error(`No user_id found in session ${session.id} metadata or client_reference_id`)
      return
    }

    if (!session.subscription) {
      console.error(`No subscription found in session ${session.id}`)
      return
    }

    // Get the subscription details
    const subscription = await stripe!.subscriptions.retrieve(session.subscription as string)
    
    console.log(`Updating user ${user_id} subscription to status: ${subscription.status}`)

    const supabaseAdmin = getSupabaseAdmin()
    const { error } = await supabaseAdmin
      .from('users')
      .update({
        subscription_status: subscription.status,
        subscription_id: subscription.id,
        customer_id: session.customer as string,
        subscription_period_end: subscription.current_period_end 
          ? new Date(subscription.current_period_end * 1000).toISOString()
          : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user_id)

    if (error) {
      console.error(`Failed to update user ${user_id} subscription:`, error)
      throw error
    }

    console.log(`Successfully updated user ${user_id} subscription from checkout session`)
  } catch (error) {
    console.error(`Error in handleCheckoutSessionCompleted for session ${session.id}:`, error)
    throw error
  }
}

async function handleCheckoutSessionExpired(session: Stripe.Checkout.Session) {
  console.log(`Checkout session ${session.id} expired without completion`)
  // Optional: Send notification to user or track abandoned checkouts
}

async function handleSubscriptionChange(subscription: Stripe.Subscription) {
  try {
    console.log(`Handling subscription change for subscription: ${subscription.id}, customer: ${subscription.customer}`)
    
    const customer = await stripe!.customers.retrieve(subscription.customer as string)
    
    if (customer.deleted) {
      console.error(`Customer ${subscription.customer} was deleted, skipping subscription update`)
      return
    }

    const supabaseUserId = customer.metadata?.supabase_user_id
    
    if (!supabaseUserId) {
      console.error(`No supabase user id found in customer ${subscription.customer} metadata`)
      return
    }

    console.log(`Updating user ${supabaseUserId} subscription to status: ${subscription.status}`)

    const supabaseAdmin = getSupabaseAdmin()
    const { error } = await supabaseAdmin
      .from('users')
      .update({
        subscription_id: subscription.id,
        subscription_status: subscription.status,
        customer_id: customer.id,
        subscription_period_end: subscription.current_period_end 
          ? new Date(subscription.current_period_end * 1000).toISOString()
          : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', supabaseUserId)

    if (error) {
      console.error(`Failed to update user ${supabaseUserId} subscription:`, error)
      throw error
    }

    console.log(`Successfully updated user ${supabaseUserId} subscription`)
  } catch (error) {
    console.error(`Error in handleSubscriptionChange for subscription ${subscription.id}:`, error)
    throw error
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  try {
    console.log(`Handling subscription deletion for subscription: ${subscription.id}, customer: ${subscription.customer}`)
    
    const customer = await stripe!.customers.retrieve(subscription.customer as string)
    
    if (customer.deleted) {
      console.error(`Customer ${subscription.customer} was deleted, skipping subscription cancellation`)
      return
    }

    let supabaseUserId = customer.metadata?.supabase_user_id
    
    if (!supabaseUserId) {
      console.log(`No supabase user id in metadata, trying to find by email: ${customer.email}`)
      
      // Try to find user by email as fallback
      if (customer.email) {
        const supabaseAdmin = getSupabaseAdmin()
        const { data: userData, error: userError } = await supabaseAdmin
          .from('users')
          .select('id')
          .eq('email', customer.email)
          .single()
        
        if (userError || !userData) {
          console.error(`No supabase user found for customer ${subscription.customer}`)
          return
        }
        
        supabaseUserId = userData.id
      } else {
        console.error(`No supabase user found for customer ${subscription.customer}`)
        return
      }
    }

    // Handle subscription period end
    let subscriptionPeriodEnd: string | null = null
    if (subscription.current_period_end) {
      subscriptionPeriodEnd = new Date(subscription.current_period_end * 1000).toISOString()
    }

    const updateData: any = {
      subscription_status: 'canceled',
      updated_at: new Date().toISOString(),
    }
    
    if (subscriptionPeriodEnd) {
      updateData.subscription_period_end = subscriptionPeriodEnd
    }

    const supabaseAdmin = getSupabaseAdmin()
    const { error } = await supabaseAdmin
      .from('users')
      .update(updateData)
      .eq('id', supabaseUserId)

    if (error) {
      console.error(`Failed to cancel user ${supabaseUserId} subscription:`, error)
      throw error
    }

    console.log(`Successfully canceled user ${supabaseUserId} subscription`)
  } catch (error) {
    console.error(`Error in handleSubscriptionDeleted for subscription ${subscription.id}:`, error)
    throw error
  }
}

async function handleTrialWillEnd(subscription: Stripe.Subscription) {
  console.log(`Trial ending soon for subscription: ${subscription.id}`)
  // TODO: Send email notification to user about trial ending
  // You can implement email notifications here using your email service
}

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  try {
    console.log(`Invoice payment succeeded: ${invoice.id}`)
    
    if (invoice.subscription) {
      const subscription = await stripe!.subscriptions.retrieve(
        invoice.subscription as string
      )
      await handleSubscriptionChange(subscription)
    }
  } catch (error) {
    console.error(`Error in handleInvoicePaymentSucceeded for invoice ${invoice.id}:`, error)
    throw error
  }
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  try {
    console.log(`Invoice payment failed: ${invoice.id}`)
    
    if (invoice.subscription) {
      const subscription = await stripe!.subscriptions.retrieve(
        invoice.subscription as string
      )
      // Update subscription status to reflect payment failure
      await handleSubscriptionChange(subscription)
    }
    
    // TODO: Send email notification to user about payment failure
    // Implement notification logic here
  } catch (error) {
    console.error(`Error in handleInvoicePaymentFailed for invoice ${invoice.id}:`, error)
    throw error
  }
}

async function handleInvoicePaymentActionRequired(invoice: Stripe.Invoice) {
  console.log(`Invoice requires payment action: ${invoice.id}`)
  // TODO: Send email notification to user about required action
  // This happens when 3D Secure authentication is required
}

async function handleCustomerUpdated(customer: Stripe.Customer) {
  try {
    console.log(`Customer updated: ${customer.id}`)
    
    const supabaseUserId = customer.metadata?.supabase_user_id
    if (!supabaseUserId) {
      console.log(`No supabase user id in customer ${customer.id} metadata`)
      return
    }

    // Update email if it changed
    if (customer.email) {
      const supabaseAdmin = getSupabaseAdmin()
      const { error } = await supabaseAdmin
        .from('users')
        .update({
          email: customer.email,
          updated_at: new Date().toISOString(),
        })
        .eq('id', supabaseUserId)

      if (error) {
        console.error(`Failed to update user ${supabaseUserId} email:`, error)
      } else {
        console.log(`Updated user ${supabaseUserId} email to ${customer.email}`)
      }
    }
  } catch (error) {
    console.error(`Error in handleCustomerUpdated for customer ${customer.id}:`, error)
    throw error
  }
}

async function handleCustomerDeleted(customer: Stripe.Customer) {
  console.log(`Customer deleted: ${customer.id}`)
  // Stripe customer was deleted - this is rare but should be handled
  // Usually you'd want to keep the user record but clear Stripe-related fields
  
  const supabaseUserId = customer.metadata?.supabase_user_id
  if (supabaseUserId) {
    const supabaseAdmin = getSupabaseAdmin()
    await supabaseAdmin
      .from('users')
      .update({
        customer_id: null,
        subscription_id: null,
        subscription_status: null,
        subscription_period_end: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', supabaseUserId)
  }
}

async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
  console.log(`Payment intent failed: ${paymentIntent.id}`)
  // TODO: Track failed payment intents for monitoring
  // You might want to send notifications or track these for analytics
}

async function handleDisputeCreated(dispute: Stripe.Dispute) {
  console.log(`Dispute created: ${dispute.id} for charge: ${dispute.charge}`)
  // TODO: Alert admin about dispute
  // Disputes require immediate attention - consider sending alerts
}

async function handleChargeRefunded(charge: Stripe.Charge) {
  console.log(`Charge refunded: ${charge.id}`)
  // TODO: Handle refund logic if needed
  // You might want to update user status or notify them
}
