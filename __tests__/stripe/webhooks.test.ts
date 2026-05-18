/**
 * @jest-environment node
 *
 * Stripe Webhook Handler Tests
 *
 * Covers:
 * 1. Signature verification — rejects unsigned / tampered requests
 * 2. Idempotency — duplicate events (23505) return 200 without re-processing
 * 3. Irrelevant event types are skipped
 * 4. checkout.session.completed → updates users table
 * 5. customer.subscription.updated → updates subscription status
 * 6. customer.subscription.deleted → sets status=canceled, sends cancellation email
 * 7. customer.subscription.trial_will_end → sends trial-ending email (fire-and-forget)
 * 8. invoice.payment_failed → sends payment-failed email (fire-and-forget)
 * 9. invoice.payment_action_required → sends 3DS action email
 * 10. charge.dispute.created → sends admin dispute alert
 * 11. charge.refunded → sends refund notification to customer
 * 12. Email failures never cause webhook to return 500
 */

// ---------------------------------------------------------------------------
// Mocks — all jest.mock() calls must appear before imports
// ---------------------------------------------------------------------------

// Stripe SDK
jest.mock('@/lib/stripe/config', () => ({
  stripe: {
    webhooks: { constructEvent: jest.fn() },
    subscriptions: { retrieve: jest.fn() },
    customers: { retrieve: jest.fn() },
  },
}))

// Supabase admin client
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      insert: jest.fn().mockReturnValue({
        select: jest.fn().mockResolvedValue({ data: [{}], error: null }),
      }),
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      }),
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    })),
    rpc: jest.fn().mockResolvedValue({ data: [{ is_allowed: true }], error: null }),
  })),
}))

// Email service
jest.mock('@/lib/email/resend', () => ({
  sendPaymentFailedEmail: jest.fn().mockResolvedValue({ success: true }),
  sendPaymentActionRequiredEmail: jest.fn().mockResolvedValue({ success: true }),
  sendTrialEndingEmail: jest.fn().mockResolvedValue({ success: true }),
  sendSubscriptionCancelledEmail: jest.fn().mockResolvedValue({ success: true }),
  sendRefundNotificationEmail: jest.fn().mockResolvedValue({ success: true }),
  sendDisputeAlertEmail: jest.fn().mockResolvedValue({ success: true }),
}))

// ---------------------------------------------------------------------------
// Imports (after all mocks)
// ---------------------------------------------------------------------------

import { POST } from '@/app/api/stripe/webhooks/route'
import { stripe } from '@/lib/stripe/config'
import { createClient } from '@supabase/supabase-js'
import * as EmailService from '@/lib/email/resend'

// ---------------------------------------------------------------------------
// Typed references to mocked functions
// ---------------------------------------------------------------------------

const mockConstructEvent = stripe!.webhooks.constructEvent as jest.Mock
const mockSubscriptionsRetrieve = stripe!.subscriptions.retrieve as jest.Mock
const mockCustomersRetrieve = stripe!.customers.retrieve as jest.Mock

const mockSendPaymentFailed = EmailService.sendPaymentFailedEmail as jest.Mock
const mockSendPaymentActionRequired = EmailService.sendPaymentActionRequiredEmail as jest.Mock
const mockSendTrialEnding = EmailService.sendTrialEndingEmail as jest.Mock
const mockSendSubscriptionCancelled = EmailService.sendSubscriptionCancelledEmail as jest.Mock
const mockSendRefundNotification = EmailService.sendRefundNotificationEmail as jest.Mock
const mockSendDisputeAlert = EmailService.sendDisputeAlertEmail as jest.Mock

// ---------------------------------------------------------------------------
// Supabase mock helpers
// ---------------------------------------------------------------------------

function getSupabaseMock() {
  return (createClient as jest.Mock).mock.results[0]?.value as {
    from: jest.Mock
  }
}

/** Get the `from` mock's current chain implementation. */
function setupSupabaseMocks({
  insertError,
  updateError,
}: {
  insertError?: { code: string } | null
  updateError?: { message: string } | null
} = {}) {
  const eqMock = jest.fn().mockResolvedValue({ error: updateError ?? null })
  const updateMock = jest.fn().mockReturnValue({ eq: eqMock })

  const insertSelectMock = jest.fn().mockResolvedValue({
    data: insertError ? null : [{}],
    error: insertError ?? null,
  })
  const insertMock = jest.fn().mockReturnValue({ select: insertSelectMock })

  // Return a minimal user row so the "user exists" lookup in checkout handler passes
  const singleMock = jest.fn().mockResolvedValue({ data: { id: 'user-uuid-abc' }, error: null })
  const selectEqMock = jest.fn().mockReturnValue({ single: singleMock })
  const selectMock = jest.fn().mockReturnValue({ eq: selectEqMock })

  const fromMock = jest.fn().mockReturnValue({
    insert: insertMock,
    update: updateMock,
    select: selectMock,
  })

  // Rate-limit RPC: return is_allowed=true so the webhook passes rate limiting
  const rpcMock = jest.fn().mockResolvedValue({
    data: [{ is_allowed: true }],
    error: null,
  })

  ;(createClient as jest.Mock).mockReturnValue({ from: fromMock, rpc: rpcMock })

  return { fromMock, insertMock, updateMock, eqMock, rpcMock }
}

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function makeRequest(body: object, sig = 'valid-sig'): Request {
  return new Request('http://localhost/api/stripe/webhooks', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'stripe-signature': sig,
    },
    body: JSON.stringify(body),
  })
}

function makeEvent(
  type: string,
  data: object,
  id = `evt_${type.replace(/\./g, '_')}_${Date.now()}`
): object {
  return { id, type, data: { object: data } }
}

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

beforeAll(() => {
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_secret'
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'
  process.env.NEXT_PUBLIC_SITE_URL = 'https://minbarai.com'
  process.env.ADMIN_EMAILS = 'admin@minbarai.com'
})

beforeEach(() => {
  jest.clearAllMocks()

  // Default: constructEvent returns the parsed body (no signature error)
  mockConstructEvent.mockImplementation((rawBody: string) => JSON.parse(rawBody))

  // Default: Supabase insert succeeds (new event, not duplicate)
  setupSupabaseMocks()

  // Default: email mocks resolve successfully
  mockSendPaymentFailed.mockResolvedValue({ success: true })
  mockSendPaymentActionRequired.mockResolvedValue({ success: true })
  mockSendTrialEnding.mockResolvedValue({ success: true })
  mockSendSubscriptionCancelled.mockResolvedValue({ success: true })
  mockSendRefundNotification.mockResolvedValue({ success: true })
  mockSendDisputeAlert.mockResolvedValue({ success: true })
})

// ---------------------------------------------------------------------------
// 1. Signature verification
// ---------------------------------------------------------------------------

describe('Webhook — signature verification', () => {
  it('returns 400 when stripe-signature is missing', async () => {
    const req = new Request('http://localhost/api/stripe/webhooks', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    })
    mockConstructEvent.mockImplementation(() => {
      throw new Error('Missing signature')
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when signature is invalid', async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error('No signatures found matching the expected signature for payload')
    })

    const res = await POST(makeRequest({}, 'bad-sig'))
    expect(res.status).toBe(400)
  })
})

// ---------------------------------------------------------------------------
// 2. Idempotency
// ---------------------------------------------------------------------------

describe('Webhook — idempotency', () => {
  it('returns 200 with idempotent:true when event was already seen (23505)', async () => {
    setupSupabaseMocks({ insertError: { code: '23505' } })

    const event = makeEvent('invoice.payment_failed', { id: 'inv_dup' })
    const res = await POST(makeRequest(event))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.idempotent).toBe(true)
    expect(mockSendPaymentFailed).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// 3. Irrelevant event types
// ---------------------------------------------------------------------------

describe('Webhook — irrelevant event types', () => {
  it('returns 200 for unsupported event types', async () => {
    const event = makeEvent('radar.early_fraud_warning.created', { id: 'efw_123' })
    const res = await POST(makeRequest(event))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.received).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 4. checkout.session.completed
// ---------------------------------------------------------------------------

describe('Webhook — checkout.session.completed', () => {
  it('updates users table with subscription data', async () => {
    const { updateMock, eqMock } = setupSupabaseMocks()
    mockSubscriptionsRetrieve.mockResolvedValue({
      id: 'sub_123',
      status: 'active',
      current_period_end: 1800000000,
    })

    const session = {
      id: 'cs_test_123',
      metadata: { user_id: 'user-uuid-abc' },
      subscription: 'sub_123',
      customer: 'cus_abc',
    }

    const res = await POST(makeRequest(makeEvent('checkout.session.completed', session)))
    expect(res.status).toBe(200)
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        subscription_status: 'active',
        subscription_id: 'sub_123',
      })
    )
  })

  it('returns 200 without crashing when no user_id in metadata', async () => {
    const session = {
      id: 'cs_no_user',
      metadata: {},
      client_reference_id: null,
      subscription: null,
      customer: null,
    }
    const res = await POST(makeRequest(makeEvent('checkout.session.completed', session)))
    expect(res.status).toBe(200)
  })
})

// ---------------------------------------------------------------------------
// 5. customer.subscription.updated
// ---------------------------------------------------------------------------

describe('Webhook — customer.subscription.updated', () => {
  it('updates subscription_status for the Supabase user', async () => {
    const { updateMock } = setupSupabaseMocks()
    mockCustomersRetrieve.mockResolvedValue({
      id: 'cus_abc',
      deleted: false,
      email: 'user@example.com',
      metadata: { supabase_user_id: 'user-uuid-abc' },
    })

    const subscription = {
      id: 'sub_abc',
      status: 'past_due',
      customer: 'cus_abc',
      current_period_end: 1800000000,
    }

    const res = await POST(makeRequest(makeEvent('customer.subscription.updated', subscription)))
    expect(res.status).toBe(200)
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ subscription_status: 'past_due' })
    )
  })
})

// ---------------------------------------------------------------------------
// 6. customer.subscription.deleted
// ---------------------------------------------------------------------------

describe('Webhook — customer.subscription.deleted', () => {
  it('sets status=canceled and sends cancellation email', async () => {
    const { updateMock } = setupSupabaseMocks()
    mockCustomersRetrieve.mockResolvedValue({
      id: 'cus_abc',
      deleted: false,
      email: 'user@example.com',
      metadata: { supabase_user_id: 'user-uuid-abc' },
    })

    const subscription = {
      id: 'sub_abc',
      status: 'canceled',
      customer: 'cus_abc',
      current_period_end: 1800000000,
    }

    const res = await POST(makeRequest(makeEvent('customer.subscription.deleted', subscription)))
    expect(res.status).toBe(200)
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ subscription_status: 'canceled' })
    )

    // fire-and-forget — give microtask queue a tick
    await new Promise((r) => setTimeout(r, 0))
    expect(mockSendSubscriptionCancelled).toHaveBeenCalledWith(
      'user@example.com',
      expect.any(String)
    )
  })
})

// ---------------------------------------------------------------------------
// 7. customer.subscription.trial_will_end
// ---------------------------------------------------------------------------

describe('Webhook — customer.subscription.trial_will_end', () => {
  it('sends trial-ending email to customer', async () => {
    mockCustomersRetrieve.mockResolvedValue({
      id: 'cus_trial',
      deleted: false,
      email: 'trial@example.com',
      metadata: {},
    })

    const subscription = {
      id: 'sub_trial',
      customer: 'cus_trial',
      trial_end: Math.floor(Date.now() / 1000) + 3 * 24 * 3600,
    }

    const res = await POST(makeRequest(makeEvent('customer.subscription.trial_will_end', subscription)))
    expect(res.status).toBe(200)

    await new Promise((r) => setTimeout(r, 0))
    expect(mockSendTrialEnding).toHaveBeenCalledWith(
      'trial@example.com',
      expect.any(String),
      expect.stringContaining('minbarai.com')
    )
  })

  it('does not send email when customer has no email', async () => {
    mockCustomersRetrieve.mockResolvedValue({
      id: 'cus_noemail',
      deleted: false,
      email: null,
      metadata: {},
    })

    const subscription = {
      id: 'sub_trial2',
      customer: 'cus_noemail',
      trial_end: Math.floor(Date.now() / 1000) + 86400,
    }

    const res = await POST(makeRequest(makeEvent('customer.subscription.trial_will_end', subscription)))
    expect(res.status).toBe(200)
    await new Promise((r) => setTimeout(r, 0))
    expect(mockSendTrialEnding).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// 8. invoice.payment_failed
// ---------------------------------------------------------------------------

describe('Webhook — invoice.payment_failed', () => {
  it('sends payment-failed email when invoice has customer_email', async () => {
    mockSubscriptionsRetrieve.mockResolvedValue({
      id: 'sub_abc',
      status: 'past_due',
      customer: 'cus_abc',
      current_period_end: 1800000000,
    })
    mockCustomersRetrieve.mockResolvedValue({
      id: 'cus_abc',
      deleted: false,
      email: 'user@example.com',
      metadata: { supabase_user_id: 'user-uuid-abc' },
    })

    const invoice = {
      id: 'inv_fail',
      customer_email: 'user@example.com',
      amount_due: 9900,
      currency: 'eur',
      subscription: 'sub_abc',
      next_payment_attempt: Math.floor(Date.now() / 1000) + 86400,
    }

    const res = await POST(makeRequest(makeEvent('invoice.payment_failed', invoice)))
    expect(res.status).toBe(200)

    await new Promise((r) => setTimeout(r, 0))
    expect(mockSendPaymentFailed).toHaveBeenCalledWith(
      'user@example.com',
      '€99.00',
      expect.stringContaining('dashboard'),
      expect.any(String)
    )
  })

  it('does not send email when customer_email is null', async () => {
    mockSubscriptionsRetrieve.mockResolvedValue({
      id: 'sub_abc',
      status: 'past_due',
      customer: 'cus_abc',
      current_period_end: 1800000000,
    })
    mockCustomersRetrieve.mockResolvedValue({
      id: 'cus_abc',
      deleted: false,
      email: 'user@example.com',
      metadata: { supabase_user_id: 'user-uuid-abc' },
    })

    const invoice = {
      id: 'inv_fail2',
      customer_email: null,
      amount_due: 4900,
      currency: 'gbp',
      subscription: 'sub_abc',
      next_payment_attempt: null,
    }

    const res = await POST(makeRequest(makeEvent('invoice.payment_failed', invoice)))
    expect(res.status).toBe(200)
    await new Promise((r) => setTimeout(r, 0))
    expect(mockSendPaymentFailed).not.toHaveBeenCalled()
  })

  it('returns 200 even when email send throws', async () => {
    mockSendPaymentFailed.mockRejectedValue(new Error('Resend is down'))
    mockSubscriptionsRetrieve.mockResolvedValue({
      id: 'sub_abc',
      status: 'past_due',
      customer: 'cus_abc',
      current_period_end: 1800000000,
    })
    mockCustomersRetrieve.mockResolvedValue({
      id: 'cus_abc',
      deleted: false,
      email: 'u@e.com',
      metadata: { supabase_user_id: 'uid' },
    })

    const invoice = {
      id: 'inv_fail3',
      customer_email: 'u@e.com',
      amount_due: 4900,
      currency: 'gbp',
      subscription: 'sub_abc',
      next_payment_attempt: null,
    }

    const res = await POST(makeRequest(makeEvent('invoice.payment_failed', invoice)))
    expect(res.status).toBe(200)
  })
})

// ---------------------------------------------------------------------------
// 9. invoice.payment_action_required
// ---------------------------------------------------------------------------

describe('Webhook — invoice.payment_action_required', () => {
  it('sends action-required email with hosted_invoice_url', async () => {
    const invoice = {
      id: 'inv_3ds',
      customer_email: 'user@example.com',
      amount_due: 9900,
      currency: 'eur',
      hosted_invoice_url: 'https://pay.stripe.com/inv/test123',
    }

    const res = await POST(makeRequest(makeEvent('invoice.payment_action_required', invoice)))
    expect(res.status).toBe(200)

    await new Promise((r) => setTimeout(r, 0))
    expect(mockSendPaymentActionRequired).toHaveBeenCalledWith(
      'user@example.com',
      '€99.00',
      'https://pay.stripe.com/inv/test123'
    )
  })

  it('falls back to site URL when hosted_invoice_url is null', async () => {
    const invoice = {
      id: 'inv_3ds_nurl',
      customer_email: 'user@example.com',
      amount_due: 4900,
      currency: 'gbp',
      hosted_invoice_url: null,
    }

    await POST(makeRequest(makeEvent('invoice.payment_action_required', invoice)))
    await new Promise((r) => setTimeout(r, 0))
    expect(mockSendPaymentActionRequired).toHaveBeenCalledWith(
      'user@example.com',
      '£49.00',
      expect.stringContaining('minbarai.com')
    )
  })
})

// ---------------------------------------------------------------------------
// 10. charge.dispute.created
// ---------------------------------------------------------------------------

describe('Webhook — charge.dispute.created', () => {
  it('sends dispute alert email to admins', async () => {
    const dispute = {
      id: 'dp_abc123',
      charge: 'ch_xyz456',
      amount: 9900,
      currency: 'eur',
      reason: 'product_not_received',
    }

    const res = await POST(makeRequest(makeEvent('charge.dispute.created', dispute)))
    expect(res.status).toBe(200)

    await new Promise((r) => setTimeout(r, 0))
    expect(mockSendDisputeAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        disputeId: 'dp_abc123',
        chargeId: 'ch_xyz456',
        amount: '€99.00',
        reason: 'product_not_received',
      })
    )
  })

  it('handles charge as an expanded object', async () => {
    const dispute = {
      id: 'dp_expanded',
      charge: { id: 'ch_expanded_123', object: 'charge' },
      amount: 4900,
      currency: 'usd',
      reason: 'fraudulent',
    }

    await POST(makeRequest(makeEvent('charge.dispute.created', dispute)))
    await new Promise((r) => setTimeout(r, 0))
    expect(mockSendDisputeAlert).toHaveBeenCalledWith(
      expect.objectContaining({ chargeId: 'ch_expanded_123' })
    )
  })
})

// ---------------------------------------------------------------------------
// 11. charge.refunded
// ---------------------------------------------------------------------------

describe('Webhook — charge.refunded', () => {
  it('sends refund notification using billing_details.email', async () => {
    const charge = {
      id: 'ch_refund1',
      customer: null,
      billing_details: { email: 'customer@example.com' },
      amount_refunded: 9900,
      currency: 'eur',
    }

    const res = await POST(makeRequest(makeEvent('charge.refunded', charge)))
    expect(res.status).toBe(200)

    await new Promise((r) => setTimeout(r, 0))
    expect(mockSendRefundNotification).toHaveBeenCalledWith('customer@example.com', '€99.00')
  })

  it('falls back to customer lookup when billing_details.email is null', async () => {
    mockCustomersRetrieve.mockResolvedValue({
      id: 'cus_refund',
      deleted: false,
      email: 'viacustomer@example.com',
    })

    const charge = {
      id: 'ch_refund2',
      customer: 'cus_refund',
      billing_details: { email: null },
      amount_refunded: 4900,
      currency: 'gbp',
    }

    const res = await POST(makeRequest(makeEvent('charge.refunded', charge)))
    expect(res.status).toBe(200)

    await new Promise((r) => setTimeout(r, 0))
    expect(mockSendRefundNotification).toHaveBeenCalledWith('viacustomer@example.com', '£49.00')
  })

  it('does not send email when no email is available', async () => {
    const charge = {
      id: 'ch_refund3',
      customer: null,
      billing_details: { email: null },
      amount_refunded: 4900,
      currency: 'gbp',
    }

    const res = await POST(makeRequest(makeEvent('charge.refunded', charge)))
    expect(res.status).toBe(200)

    await new Promise((r) => setTimeout(r, 0))
    expect(mockSendRefundNotification).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// 12. Email failures are fire-and-forget (never cause 500)
// ---------------------------------------------------------------------------

describe('Webhook — email failures are fire-and-forget', () => {
  it('returns 200 even when sendDisputeAlertEmail rejects', async () => {
    mockSendDisputeAlert.mockRejectedValue(new Error('Email provider down'))

    const dispute = {
      id: 'dp_emailfail',
      charge: 'ch_emailfail',
      amount: 9900,
      currency: 'eur',
      reason: 'general',
    }

    const res = await POST(makeRequest(makeEvent('charge.dispute.created', dispute)))
    expect(res.status).toBe(200)
  })

  it('returns 200 even when sendTrialEndingEmail rejects', async () => {
    mockSendTrialEnding.mockRejectedValue(new Error('SMTP failure'))
    mockCustomersRetrieve.mockResolvedValue({
      id: 'cus_trial2',
      deleted: false,
      email: 'trial@example.com',
      metadata: {},
    })

    const subscription = {
      id: 'sub_trial3',
      customer: 'cus_trial2',
      trial_end: Math.floor(Date.now() / 1000) + 86400,
    }

    const res = await POST(makeRequest(makeEvent('customer.subscription.trial_will_end', subscription)))
    expect(res.status).toBe(200)
  })

  it('returns 200 even when sendRefundNotificationEmail rejects', async () => {
    mockSendRefundNotification.mockRejectedValue(new Error('Resend is down'))

    const charge = {
      id: 'ch_refundfail',
      customer: null,
      billing_details: { email: 'customer@example.com' },
      amount_refunded: 9900,
      currency: 'eur',
    }

    const res = await POST(makeRequest(makeEvent('charge.refunded', charge)))
    expect(res.status).toBe(200)
  })
})
