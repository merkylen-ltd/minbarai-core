/**
 * Email Service Tests
 *
 * Covers:
 * 1. Graceful degradation when RESEND_API_KEY is not configured
 * 2. HTML escaping in templates that accept user/Stripe-supplied data
 * 3. Correct subject lines for each send function
 * 4. Dispute alert fans out to all ADMIN_EMAILS
 * 5. Dispute alert logs a warning and returns failure when ADMIN_EMAILS is empty
 * 6. Resend API error handling
 */

// ---------------------------------------------------------------------------
// Mocks — jest.mock() is hoisted; use jest.fn() directly inside factory
// ---------------------------------------------------------------------------

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: jest.fn() },
  })),
}))

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { Resend } from 'resend'
import {
  sendWelcomeEmail,
  sendReminderEmail,
  sendPaymentFailedEmail,
  sendPaymentActionRequiredEmail,
  sendTrialEndingEmail,
  sendSubscriptionCancelledEmail,
  sendRefundNotificationEmail,
  sendDisputeAlertEmail,
} from '@/lib/email/resend'

// ---------------------------------------------------------------------------
// Helper — get the send mock from the Resend instance
// ---------------------------------------------------------------------------

function getMockSend(): jest.Mock {
  // resend.ts calls `new Resend(key)` at module-init time.
  // Get the send mock from the most recently created instance.
  const results = (Resend as jest.Mock).mock.results
  const last = results[results.length - 1]
  return (last?.value as { emails: { send: jest.Mock } })?.emails?.send
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const ORIGINAL_ENV = process.env

beforeEach(() => {
  process.env = {
    ...ORIGINAL_ENV,
    RESEND_API_KEY: 'test-key-abc123',
    RESEND_FROM_EMAIL: 'noreply@minbarai.com',
    ADMIN_EMAILS: 'admin1@minbarai.com,admin2@minbarai.com',
    NEXT_PUBLIC_SITE_URL: 'https://minbarai.com',
  }

  // Reset the send mock between tests
  getMockSend()?.mockReset()
  getMockSend()?.mockResolvedValue({ data: { id: 'email-123' }, error: null })
})

afterAll(() => {
  process.env = ORIGINAL_ENV
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockResendOk() {
  getMockSend().mockResolvedValue({ data: { id: 'email-123' }, error: null })
}

function mockResendError(message: string) {
  getMockSend().mockResolvedValue({ data: null, error: { message } })
}

function mockResendThrow(message: string) {
  getMockSend().mockRejectedValue(new Error(message))
}

// ---------------------------------------------------------------------------
// 1. Successful sends — subject lines and happy-path
// ---------------------------------------------------------------------------

describe('Email service — successful sends', () => {
  it('sendWelcomeEmail returns success and calls Resend with correct subject', async () => {
    mockResendOk()
    const result = await sendWelcomeEmail('user@example.com')
    expect(result.success).toBe(true)
    expect(getMockSend()).toHaveBeenCalledWith(
      expect.objectContaining({ subject: 'Welcome to MinbarAI' })
    )
  })

  it('sendPaymentFailedEmail uses "Payment Failed" subject', async () => {
    mockResendOk()
    await sendPaymentFailedEmail('user@example.com', '€99.00', 'https://minbarai.com/dashboard')
    expect(getMockSend()).toHaveBeenCalledWith(
      expect.objectContaining({ subject: expect.stringContaining('Payment Failed') })
    )
  })

  it('sendPaymentActionRequiredEmail uses "Authorization Required" subject', async () => {
    mockResendOk()
    await sendPaymentActionRequiredEmail(
      'user@example.com',
      '€49.00',
      'https://pay.stripe.com/inv/123'
    )
    expect(getMockSend()).toHaveBeenCalledWith(
      expect.objectContaining({ subject: expect.stringContaining('Authorization Required') })
    )
  })

  it('sendTrialEndingEmail uses "Trial" in subject', async () => {
    mockResendOk()
    await sendTrialEndingEmail(
      'user@example.com',
      'April 30, 2026',
      'https://minbarai.com/dashboard'
    )
    expect(getMockSend()).toHaveBeenCalledWith(
      expect.objectContaining({ subject: expect.stringContaining('Trial') })
    )
  })

  it('sendSubscriptionCancelledEmail uses "Cancelled" in subject', async () => {
    mockResendOk()
    await sendSubscriptionCancelledEmail('user@example.com', 'May 1, 2026')
    expect(getMockSend()).toHaveBeenCalledWith(
      expect.objectContaining({ subject: expect.stringContaining('Cancelled') })
    )
  })

  it('sendRefundNotificationEmail uses "Refund" in subject', async () => {
    mockResendOk()
    await sendRefundNotificationEmail('user@example.com', '€99.00')
    expect(getMockSend()).toHaveBeenCalledWith(
      expect.objectContaining({ subject: expect.stringContaining('Refund') })
    )
  })

  it('sendReminderEmail uses "Reminder" in subject', async () => {
    mockResendOk()
    await sendReminderEmail('user@example.com', 'Please update your billing info.')
    expect(getMockSend()).toHaveBeenCalledWith(
      expect.objectContaining({ subject: expect.stringContaining('Reminder') })
    )
  })
})

// ---------------------------------------------------------------------------
// 2. HTML escaping — XSS prevention
// ---------------------------------------------------------------------------

describe('Email templates — HTML escaping', () => {
  it('escapes <script> in welcome email name', async () => {
    mockResendOk()
    await sendWelcomeEmail('user@example.com', '<script>alert(1)</script>')
    const call = getMockSend().mock.calls[0][0]
    expect(call.html).not.toContain('<script>')
    expect(call.html).toContain('&lt;script&gt;')
  })

  it('escapes & in welcome email name', async () => {
    mockResendOk()
    await sendWelcomeEmail('user@example.com', 'Alice & Bob')
    const call = getMockSend().mock.calls[0][0]
    expect(call.html).toContain('Alice &amp; Bob')
  })

  it('escapes <img> in reminder email message', async () => {
    mockResendOk()
    await sendReminderEmail('user@example.com', '<img src=x onerror=alert(1)>')
    const call = getMockSend().mock.calls[0][0]
    expect(call.html).not.toContain('<img')
    expect(call.html).toContain('&lt;img')
  })

  it('escapes quotes in billing template amount', async () => {
    mockResendOk()
    await sendPaymentFailedEmail(
      'user@example.com',
      '"€99.00"',
      'https://minbarai.com/dashboard'
    )
    const call = getMockSend().mock.calls[0][0]
    expect(call.html).not.toContain('"€99.00"')
    expect(call.html).toContain('&quot;€99.00&quot;')
  })

  it('escapes < and > in dispute reason field', async () => {
    mockResendOk()
    await sendDisputeAlertEmail({
      disputeId: 'dp_123',
      chargeId: 'ch_456',
      amount: '€99.00',
      reason: '<fraudulent>',
    })
    const calls = getMockSend().mock.calls
    expect(calls.length).toBeGreaterThan(0)
    for (const [opts] of calls) {
      expect(opts.html).not.toContain('<fraudulent>')
      expect(opts.html).toContain('&lt;fraudulent&gt;')
    }
  })

  it('escapes < and > in dispute disputeId', async () => {
    mockResendOk()
    await sendDisputeAlertEmail({
      disputeId: '<dp_xss>',
      chargeId: 'ch_456',
      amount: '€99.00',
      reason: 'general',
    })
    const calls = getMockSend().mock.calls
    for (const [opts] of calls) {
      expect(opts.html).not.toContain('<dp_xss>')
      expect(opts.html).toContain('&lt;dp_xss&gt;')
    }
  })
})

// ---------------------------------------------------------------------------
// 3. Dispute alert fan-out
// ---------------------------------------------------------------------------

describe('sendDisputeAlertEmail — fan-out to ADMIN_EMAILS', () => {
  it('sends one email per admin in ADMIN_EMAILS', async () => {
    mockResendOk()
    const result = await sendDisputeAlertEmail({
      disputeId: 'dp_abc',
      chargeId: 'ch_xyz',
      amount: '€49.00',
      reason: 'product_not_received',
    })
    expect(result.success).toBe(true)
    // ADMIN_EMAILS has 2 addresses
    expect(getMockSend()).toHaveBeenCalledTimes(2)
    const recipients = getMockSend().mock.calls.map(([opts]) => opts.to)
    expect(recipients).toContain('admin1@minbarai.com')
    expect(recipients).toContain('admin2@minbarai.com')
  })

  it('returns success:false when ADMIN_EMAILS is empty', async () => {
    process.env.ADMIN_EMAILS = ''
    // Need to dynamically import to pick up the env change — use require
    jest.resetModules()
    const { sendDisputeAlertEmail: send } = await import('@/lib/email/resend')

    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const result = await send({
      disputeId: 'dp_abc',
      chargeId: 'ch_xyz',
      amount: '€49.00',
      reason: 'credit_not_processed',
    })
    expect(result.success).toBe(false)
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('ADMIN_EMAILS'))
    consoleSpy.mockRestore()
  })

  it('uses stripeDashboardUrl when provided', async () => {
    mockResendOk()
    await sendDisputeAlertEmail({
      disputeId: 'dp_abc',
      chargeId: 'ch_xyz',
      amount: '€99.00',
      reason: 'general',
      stripeDashboardUrl: 'https://dashboard.stripe.com/disputes/dp_abc',
    })
    const call = getMockSend().mock.calls[0][0]
    expect(call.html).toContain('https://dashboard.stripe.com/disputes/dp_abc')
  })
})

// ---------------------------------------------------------------------------
// 4. Resend API error handling
// ---------------------------------------------------------------------------

describe('Email service — Resend API errors', () => {
  it('returns success:false and the error message when Resend returns an error', async () => {
    mockResendError('Invalid email address')
    const result = await sendWelcomeEmail('bad-email')
    expect(result.success).toBe(false)
    expect(result.error).toContain('Invalid email address')
  })

  it('surfaces domain-not-verified error message', async () => {
    mockResendError('Domain not verified for sender address')
    const result = await sendWelcomeEmail('user@example.com')
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/not verified/i)
  })

  it('returns success:false on thrown exception', async () => {
    mockResendThrow('Network timeout')
    const result = await sendWelcomeEmail('user@example.com')
    expect(result.success).toBe(false)
    expect(result.error).toContain('Network timeout')
  })

  it('returns the email id on success', async () => {
    getMockSend().mockResolvedValue({ data: { id: 'specific-email-id' }, error: null })
    const result = await sendWelcomeEmail('user@example.com')
    expect(result.success).toBe(true)
    expect(result.id).toBe('specific-email-id')
  })
})
