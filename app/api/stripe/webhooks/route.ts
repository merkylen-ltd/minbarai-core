import { createClient } from '@supabase/supabase-js'
import { stripe } from '@/lib/stripe/config'
import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import {
  sendPaymentFailedEmail,
  sendPaymentActionRequiredEmail,
  sendTrialEndingEmail,
  sendSubscriptionCancelledEmail,
  sendRefundNotificationEmail,
  sendDisputeAlertEmail,
} from '@/lib/email/resend'

export const runtime = 'nodejs'

// Type definitions for webhook event status updates
interface WebhookEventStatusUpdate {
  status: 'processing' | 'completed' | 'failed'
  updated_at: string
  processing_started_at?: string
  processing_completed_at?: string
  processing_error?: string
  retry_count?: number
}

// Type definitions for user subscription updates
interface UserSubscriptionUpdate {
  subscription_status: string
  updated_at: string
  subscription_period_end?: string
}

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

// In-memory rate limiting for webhooks
// Note: In serverless, this resets on cold starts, but provides basic protection
// For production distributed systems, consider using Redis or database-backed rate limiting
const webhookRateLimitMap = new Map<string, { count: number; resetTime: number }>()

/**
 * Check webhook rate limit for an IP
 * Cleans up expired entries on each check to prevent memory growth
 */
function checkWebhookRateLimit(ip: string): boolean {
  const now = Date.now()
  
  // Clean up expired entries (probabilistic to reduce overhead)
  if (Math.random() < 0.1) {
    const entries = Array.from(webhookRateLimitMap.entries())
    for (let i = 0; i < entries.length; i++) {
      const [key, data] = entries[i]
      if (now > data.resetTime) {
        webhookRateLimitMap.delete(key)
      }
    }
  }
  
  const record = webhookRateLimitMap.get(ip)
  
  if (!record || now > record.resetTime) {
    // New window - reset count
    webhookRateLimitMap.set(ip, {
      count: 1,
      resetTime: now + WEBHOOK_RATE_LIMIT_WINDOW
    })
    return true
  }
  
  if (record.count >= WEBHOOK_RATE_LIMIT_MAX_REQUESTS) {
    return false
  }
  
  record.count++
  return true
}

/**
 * Database-backed idempotency check
 * Returns true if event was already processed, false if new
 */
async function checkWebhookIdempotency(eventId: string, eventType: string, payload: unknown): Promise<boolean> {
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
    const updateData: WebhookEventStatusUpdate = {
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

// ---------------------------------------------------------------------------
// Email / formatting helpers
// ---------------------------------------------------------------------------

/**
 * Retrieve a Stripe customer's email address, or null if not found.
 * Used by handlers that receive only a customer ID.
 */
async function getUserEmailFromCustomer(customerId: string): Promise<string | null> {
  try {
    const customer = await stripe!.customers.retrieve(customerId)
    if (customer.deleted) return null
    return customer.email ?? null
  } catch (err) {
    console.error(`[Webhook] Failed to retrieve customer ${customerId} for email:`, err)
    return null
  }
}

/**
 * Format a Stripe amount (in cents) as a human-readable currency string.
 * e.g. formatStripeAmount(9900, 'eur') → '€99.00'
 */
function formatStripeAmount(amountCents: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amountCents / 100)
  } catch {
    // Fallback for exotic currencies not supported by Intl
    return `${(amountCents / 100).toFixed(2)} ${currency.toUpperCase()}`
  }
}

/** Format a Unix timestamp as a long-form date string, e.g. "April 20, 2026". */
function formatUnixDate(unix: number): string {
  return new Date(unix * 1000).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
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

    const updateData: UserSubscriptionUpdate = {
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

    // Send cancellation confirmation email (fire-and-forget)
    if (customer.email && subscriptionPeriodEnd) {
      const periodEndFormatted = new Date(subscriptionPeriodEnd).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
      sendSubscriptionCancelledEmail(customer.email, periodEndFormatted).catch((err) =>
        console.error('[Webhook] sendSubscriptionCancelledEmail failed:', err)
      )
    }
  } catch (error) {
    console.error(`Error in handleSubscriptionDeleted for subscription ${subscription.id}:`, error)
    throw error
  }
}

async function handleTrialWillEnd(subscription: Stripe.Subscription) {
  console.log(`Trial ending soon for subscription: ${subscription.id}`)

  const email = await getUserEmailFromCustomer(subscription.customer as string)
  if (!email) {
    console.warn(`[Webhook] handleTrialWillEnd: no email for customer ${subscription.customer}`)
    return
  }

  const trialEndDate = subscription.trial_end
    ? formatUnixDate(subscription.trial_end)
    : 'soon'
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://minbarai.com'
  const addPaymentUrl = `${siteUrl}/dashboard`

  // Fire-and-forget — email failure must not cause webhook retry
  sendTrialEndingEmail(email, trialEndDate, addPaymentUrl).catch((err) =>
    console.error('[Webhook] sendTrialEndingEmail failed:', err)
  )
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
    
    // Send payment-failed email (fire-and-forget)
    const toEmail = invoice.customer_email
    if (toEmail) {
      const amount = formatStripeAmount(invoice.amount_due, invoice.currency)
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://minbarai.com'
      const updatePaymentUrl = `${siteUrl}/dashboard`
      const nextRetryDate = invoice.next_payment_attempt
        ? formatUnixDate(invoice.next_payment_attempt)
        : undefined

      sendPaymentFailedEmail(toEmail, amount, updatePaymentUrl, nextRetryDate).catch((err) =>
        console.error('[Webhook] sendPaymentFailedEmail failed:', err)
      )
    } else {
      console.warn(`[Webhook] handleInvoicePaymentFailed: no email on invoice ${invoice.id}`)
    }
  } catch (error) {
    console.error(`Error in handleInvoicePaymentFailed for invoice ${invoice.id}:`, error)
    throw error
  }
}

async function handleInvoicePaymentActionRequired(invoice: Stripe.Invoice) {
  console.log(`Invoice requires payment action: ${invoice.id}`)

  const toEmail = invoice.customer_email
  if (!toEmail) {
    console.warn(`[Webhook] handleInvoicePaymentActionRequired: no email on invoice ${invoice.id}`)
    return
  }

  const amount = formatStripeAmount(invoice.amount_due, invoice.currency)
  const invoiceUrl = invoice.hosted_invoice_url || (process.env.NEXT_PUBLIC_SITE_URL || 'https://minbarai.com') + '/dashboard'

  // Fire-and-forget
  sendPaymentActionRequiredEmail(toEmail, amount, invoiceUrl).catch((err) =>
    console.error('[Webhook] sendPaymentActionRequiredEmail failed:', err)
  )
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
  console.log(
    `Payment intent failed: ${paymentIntent.id}, customer: ${paymentIntent.customer}, ` +
    `amount: ${paymentIntent.amount} ${paymentIntent.currency}, ` +
    `last_error: ${paymentIntent.last_payment_error?.message ?? 'none'}`
  )
  // Subscription payment failures surface as invoice.payment_failed (which we handle above).
  // Payment-intent-level failures typically cover one-off charges; log is sufficient for now.
}

async function handleDisputeCreated(dispute: Stripe.Dispute) {
  console.log(`Dispute created: ${dispute.id} for charge: ${dispute.charge}`)

  const amount = formatStripeAmount(dispute.amount, dispute.currency)
  const chargeId = typeof dispute.charge === 'string' ? dispute.charge : dispute.charge.id

  // Fire-and-forget — all ADMIN_EMAILS receive the alert
  sendDisputeAlertEmail({
    disputeId: dispute.id,
    chargeId,
    amount,
    reason: dispute.reason,
  }).catch((err) => console.error('[Webhook] sendDisputeAlertEmail failed:', err))
}

async function handleChargeRefunded(charge: Stripe.Charge) {
  console.log(`Charge refunded: ${charge.id}, amount_refunded: ${charge.amount_refunded} ${charge.currency}`)

  // Retrieve customer email — charge.billing_details.email is preferred; fall back to customer lookup
  let toEmail: string | null = charge.billing_details?.email ?? null
  if (!toEmail && charge.customer) {
    const customerId = typeof charge.customer === 'string' ? charge.customer : charge.customer.id
    toEmail = await getUserEmailFromCustomer(customerId)
  }

  if (!toEmail) {
    console.warn(`[Webhook] handleChargeRefunded: no email for charge ${charge.id}`)
    return
  }

  const amount = formatStripeAmount(charge.amount_refunded, charge.currency)

  // Fire-and-forget
  sendRefundNotificationEmail(toEmail, amount).catch((err) =>
    console.error('[Webhook] sendRefundNotificationEmail failed:', err)
  )
}
