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
import { activateAdminInvoiceAccounts, activateSingleUserForInvoice } from '@/lib/admin/activate-invoice'
import { logNotification } from '@/lib/admin/notifications'

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
const WEBHOOK_RATE_LIMIT_WINDOW = 60 // 1 minute in seconds
const WEBHOOK_RATE_LIMIT_MAX_REQUESTS = 100 // 100 requests per minute per IP

/**
 * Check webhook rate limit for an IP using database-backed rate limiting.
 * Uses RPC function check_and_record_webhook_attempt() for atomic operation
 * that persists across Cloud Run cold starts.
 */
async function checkWebhookRateLimit(ip: string): Promise<boolean> {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const { data, error } = await supabaseAdmin
      .rpc('check_and_record_webhook_attempt', {
        p_ip_address: ip,
        p_max_requests: WEBHOOK_RATE_LIMIT_MAX_REQUESTS,
        p_window_seconds: WEBHOOK_RATE_LIMIT_WINDOW
      })

    if (error) {
      console.error(`Rate limit check failed for IP ${ip}:`, error)
      // On error, allow the request to pass through (fail open, not closed)
      return true
    }

    if (!data || data.length === 0) {
      console.error(`No rate limit data returned for IP ${ip}`)
      return true
    }

    return data[0].is_allowed
  } catch (error) {
    console.error(`Error in checkWebhookRateLimit for IP ${ip}:`, error)
    // On error, allow the request to pass through
    return true
  }
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
  
  // Admin invoice events
  'invoice.paid',
  'invoice.voided',
  'invoice.marked_uncollectible',
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
  const isRateLimitAllowed = await checkWebhookRateLimit(clientIP)
  if (!isRateLimitAllowed) {
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
      
      case 'invoice.paid':
        const paidInvoice = event.data.object as Stripe.Invoice
        await handleInvoicePaid(paidInvoice)
        break
      
      case 'invoice.voided':
        const voidedInvoice = event.data.object as Stripe.Invoice
        await handleInvoiceStatusUpdate(voidedInvoice, 'void')
        break
      
      case 'invoice.marked_uncollectible':
        const uncollectibleInvoice = event.data.object as Stripe.Invoice
        await handleInvoiceStatusUpdate(uncollectibleInvoice, 'uncollectible')
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

    // Map Stripe statuses to the DB CHECK constraint set.
    // 'trialing' is valid in Stripe but not in our schema — treat as 'active'
    // so the DB update doesn't fail and Stripe doesn't retry the webhook forever.
    const dbStatus = subscription.status === 'trialing' ? 'active' : subscription.status

    const supabaseAdmin = getSupabaseAdmin()
    const { error } = await supabaseAdmin
      .from('users')
      .update({
        subscription_status: dbStatus,
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
    const dbStatus = subscription.status === 'trialing' ? 'active' : subscription.status

    const { error } = await supabaseAdmin
      .from('users')
      .update({
        subscription_id: subscription.id,
        subscription_status: dbStatus,
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
      console.log(`No supabase user id in metadata for customer ${customer.id}, falling back to email lookup`)
      
      // Try to find user by email as fallback
      if (customer.email) {
        const supabaseAdmin = getSupabaseAdmin()
        const { data: userData, error: userError } = await supabaseAdmin
          .from('users')
          .select('id')
          .eq('email', customer.email.toLowerCase())
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

    // Always write subscription_period_end — even if null — so the DB reflects
    // what Stripe says rather than whatever was there before. Using a falsy guard
    // could leave a future period_end in the DB, accidentally granting access
    // after an immediate cancellation.
    const subscriptionPeriodEnd: string | null =
      subscription.current_period_end != null
        ? new Date(subscription.current_period_end * 1000).toISOString()
        : null

    const updateData: UserSubscriptionUpdate = {
      subscription_status: 'canceled',
      subscription_period_end: subscriptionPeriodEnd,
      updated_at: new Date().toISOString(),
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

    // Admin invoices: route through the same activation path as invoice.paid.
    // Stripe fires BOTH invoice.paid AND invoice.payment_succeeded for the same
    // payment, but many accounts only have payment_succeeded enabled on their
    // webhook endpoint. Processing either one (idempotent via admin_invoices
    // .activated_at guard) makes the flow robust to that config drift.
    if (invoice.metadata?.minbarai_type === 'admin_invoice') {
      await handleAdminInvoicePaid(invoice)
      return
    }

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
        console.log(`Updated email for user ${supabaseUserId} from Stripe customer ${customer.id}`)
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

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  try {
    console.log(`Invoice paid: ${invoice.id}`)

    // Route based on invoice type
    if (invoice.subscription) {
      // Subscription renewal — handle via existing subscription flow
      const subscription = await stripe!.subscriptions.retrieve(
        invoice.subscription as string
      )
      await handleSubscriptionChange(subscription)
    } else if (invoice.metadata?.minbarai_type === 'admin_invoice') {
      // Admin invoice — activate user account
      await handleAdminInvoicePaid(invoice)
    } else {
      // Unknown one-off invoice — skip (no metadata)
      console.log(`Skipping one-off invoice ${invoice.id} with no metadata`)
    }
  } catch (error) {
    console.error(`Error in handleInvoicePaid for invoice ${invoice.id}:`, error)
    throw error
  }
}

async function handleAdminInvoicePaid(invoice: Stripe.Invoice) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const adminInvoiceId = invoice.metadata?.admin_invoice_id

    console.log(`Processing admin invoice paid: ${invoice.id} (admin_invoice_id: ${adminInvoiceId})`)

    if (!adminInvoiceId) {
      console.error(`Admin invoice paid event missing admin_invoice_id metadata: ${invoice.id}`)
      throw new Error('Missing admin_invoice_id in metadata')
    }

    // 1. Fetch admin_invoices row
    const { data: adminInvoice, error: fetchError } = await supabaseAdmin
      .from('admin_invoices')
      .select('*')
      .eq('stripe_invoice_id', invoice.id)
      .single()

    if (fetchError || !adminInvoice) {
      console.error(`Admin invoice not found in DB for stripe invoice ${invoice.id}`)
      throw new Error(`Admin invoice record not found`)
    }

    // 2. Check idempotency: if fully activated, skip.
    // For multi-account invoices the activation lib uses per-email idempotency via
    // activated_account_emails so a Stripe retry only re-activates emails that did
    // not succeed before.
    if (adminInvoice.activated_at) {
      console.log(`Admin invoice ${adminInvoiceId} already activated at ${adminInvoice.activated_at}, skipping`)
      return
    }

    // 3. Extract activation parameters — Stripe metadata is primary source,
    //    DB record is the fallback (metadata can be absent if invoice was created
    //    outside the normal flow or metadata was stripped by Stripe).
    const parsedDurationDays = parseInt(invoice.metadata?.duration_days || '', 10)
    const durationDays =
      Number.isFinite(parsedDurationDays) && parsedDurationDays > 0
        ? parsedDurationDays
        : adminInvoice.duration_days
    const parsedSessionLimit = parseInt(invoice.metadata?.session_limit_minutes || '', 10)
    const sessionLimitMinutes =
      Number.isFinite(parsedSessionLimit) && parsedSessionLimit > 0
        ? parsedSessionLimit
        : adminInvoice.session_limit_minutes

    if (isNaN(durationDays) || durationDays <= 0 || isNaN(sessionLimitMinutes) || sessionLimitMinutes <= 0) {
      throw new Error(`Missing duration_days or session_limit_minutes for admin invoice ${adminInvoiceId}`)
    }

    // 4. Activate target accounts (single recipient OR bulk child accounts).
    // activateAdminInvoiceAccounts handles per-email idempotency, child customer_id
    // isolation, and atomic activated_account_emails persistence before we throw.
    const result = await activateAdminInvoiceAccounts(
      adminInvoice,
      { durationDays, sessionLimitMinutes },
      supabaseAdmin,
      activateUserForAdminInvoice,
    )

    const primaryUserId = result.newlyActivated[0]?.userId || adminInvoice.supabase_user_id || null

    console.log(
      `Admin invoice ${adminInvoiceId} activated ${result.newlyActivated.length + result.previouslyActivated.length}/${result.targets.length} account(s)`,
    )

    // Log activity feed entry (idempotent-friendly — only on successful full activation)
    if (result.failures.length === 0 && result.newlyActivated.length > 0) {
      await logNotification({
        type: 'invoice_paid',
        title: result.isBulk
          ? `Paid bulk invoice · ${result.newlyActivated.length} seats activated`
          : `Paid invoice for ${adminInvoice.recipient_email}`,
        message: result.isBulk
          ? `Activated ${result.newlyActivated.length}/${result.targets.length} child account(s). Billing: ${adminInvoice.recipient_email}.`
          : `Subscription activated for ${adminInvoice.recipient_email}.`,
        actorEmail: 'stripe-webhook',
        targetEmail: adminInvoice.recipient_email,
        metadata: {
          invoice_id: adminInvoiceId,
          stripe_invoice_id: invoice.id,
          amount_cents: invoice.amount_paid,
          currency: invoice.currency,
          is_bulk: result.isBulk,
          activated: result.newlyActivated.map(n => n.email),
        },
        client: supabaseAdmin,
      })
    }

    // If any activation failed, throw so Stripe retries the webhook. Already-activated
    // emails are skipped via activated_account_emails, so retries are safe.
    if (result.failures.length > 0) {
      for (const f of result.failures) {
        console.error(`Failed to activate ${f.email} for admin invoice ${adminInvoiceId}:`, f.error)
      }
      throw new Error(
        `Partial activation for admin invoice ${adminInvoiceId}: ${result.failures.length} of ${result.targets.length} failed — Stripe will retry`,
      )
    }

    // Note: welcome emails are sent at account-creation time (setup UI sends them with
    // the temporary password shown to the admin). New users invited here via
    // inviteUserByEmail receive the standard Supabase invite email automatically.
  } catch (error) {
    console.error(`Error in handleAdminInvoicePaid:`, error)
    throw error
  }
}

async function activateUserForAdminInvoice(
  recipientEmail: string,
  durationDays: number,
  sessionLimitMinutes: number,
  stripeCustomerId: string | null
): Promise<string> {
  // Webhook path — invite the user if they don't exist (first-payment flow).
  return activateSingleUserForInvoice(
    getSupabaseAdmin(),
    recipientEmail,
    durationDays,
    sessionLimitMinutes,
    stripeCustomerId,
    { inviteIfMissing: true },
  )
}

async function handleInvoiceStatusUpdate(
  invoice: Stripe.Invoice,
  status: 'void' | 'uncollectible'
) {
  try {
    console.log(`Invoice status update: ${invoice.id} → ${status}`)

    const supabaseAdmin = getSupabaseAdmin()

    // Only handle admin invoices
    if (invoice.metadata?.minbarai_type !== 'admin_invoice') {
      console.log(`Skipping non-admin invoice status update: ${invoice.id}`)
      return
    }

    // Update admin_invoices table
    const { error: updateError } = await supabaseAdmin
      .from('admin_invoices')
      .update({
        status: status,
      })
      .eq('stripe_invoice_id', invoice.id)

    if (updateError) {
      console.error(`Failed to update admin invoice status: ${invoice.id}`, updateError)
      throw updateError
    }

    console.log(`Admin invoice ${invoice.id} status updated to ${status}`)
  } catch (error) {
    console.error(`Error in handleInvoiceStatusUpdate:`, error)
    throw error
  }
}
