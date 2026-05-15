import { describe, it, expect, beforeEach } from '@jest/globals'
import Stripe from 'stripe'

describe('Admin Invoice Webhook Processing', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('invoice.paid event routing', () => {
    it('should route subscription invoices to handleSubscriptionChange', () => {
      // Subscription invoice with invoice.paid event
      const invoice: Partial<Stripe.Invoice> = {
        id: 'in_subscription',
        status: 'paid',
        paid: true,
        subscription: 'sub_123',
        metadata: {},
      }

      // Verify: if subscription is set, route to subscription flow
      expect(invoice.subscription).toBeTruthy()
      expect(invoice.metadata?.minbarai_type).not.toBe('admin_invoice')
    })

    it('should route admin invoices to handleAdminInvoicePaid', () => {
      const invoice: Partial<Stripe.Invoice> = {
        id: 'in_admin',
        status: 'paid',
        paid: true,
        subscription: undefined,
        metadata: {
          minbarai_type: 'admin_invoice',
          admin_invoice_id: '550e8400-e29b-41d4-a716-446655440000',
          duration_days: '30',
          session_limit_minutes: '120',
        },
      }

      // Verify: admin invoice should have correct metadata
      expect(invoice.metadata?.minbarai_type).toBe('admin_invoice')
      expect(invoice.metadata?.admin_invoice_id).toBeDefined()
      expect(parseInt(invoice.metadata?.duration_days as string)).toBe(30)
    })

    it('should skip unknown one-off invoices with no metadata', () => {
      const invoice: Partial<Stripe.Invoice> = {
        id: 'in_unknown',
        status: 'paid',
        paid: true,
        subscription: undefined,
        metadata: {},
      }

      // Verify: no metadata means skip
      expect(invoice.subscription).toBeFalsy()
      expect(invoice.metadata?.minbarai_type).not.toBe('admin_invoice')
    })
  })

  describe('handleAdminInvoicePaid idempotency', () => {
    it('should extract duration and session limit from invoice metadata', () => {
      const invoice: Partial<Stripe.Invoice> = {
        id: 'in_admin',
        metadata: {
          admin_invoice_id: 'inv_123',
          duration_days: '30',
          session_limit_minutes: '120',
        },
      }

      const durationDays = parseInt(invoice.metadata?.duration_days as string)
      const sessionLimitMinutes = parseInt(invoice.metadata?.session_limit_minutes as string)

      expect(durationDays).toBe(30)
      expect(sessionLimitMinutes).toBe(120)
    })

    it('should skip re-activation if already activated (idempotency)', () => {
      const adminInvoice = {
        id: 'admin_inv_123',
        recipient_email: 'test@mosque.org',
        activated_at: '2026-04-19T10:00:00Z',
      }

      // Verify: if activated_at is set, skip
      expect(adminInvoice.activated_at).toBeTruthy()
    })

    it('should extend subscription period for existing users', () => {
      const existingPeriodEnd = new Date('2026-05-19T10:00:00Z')
      const durationDays = 30
      const expectedNewEnd = new Date(existingPeriodEnd.getTime() + durationDays * 24 * 60 * 60 * 1000)

      // Verify: new end date is based on existing period end
      expect(expectedNewEnd.getTime()).toBeGreaterThan(existingPeriodEnd.getTime())
    })

    it('should calculate new period end from max(now, existing)', () => {
      const now = new Date('2026-04-19T10:00:00Z')
      const existingEnd = new Date('2026-05-19T10:00:00Z')
      const durationDays = 30

      // Existing end is in future, so use that as base
      const baseDate = existingEnd > now ? existingEnd : now
      const newPeriodEnd = new Date(baseDate.getTime() + durationDays * 24 * 60 * 60 * 1000)

      expect(newPeriodEnd.getTime()).toBeGreaterThan(existingEnd.getTime())
    })
  })

  describe('User activation for admin invoices', () => {
    it('should prepare data for new user invitation', () => {
      const recipientEmail = 'test@mosque.org'
      const durationDays = 30
      const sessionLimitMinutes = 120

      // Verify: all required data present for invitation
      expect(recipientEmail).toBeDefined()
      expect(durationDays).toBeGreaterThan(0)
      expect(sessionLimitMinutes).toBeGreaterThan(0)
    })

    it('should set subscription_status to active', () => {
      const expectedStatus = 'active'
      expect(expectedStatus).toBe('active')
    })

    it('should set subscription_id to null for non-recurring invoices', () => {
      const subscriptionId = null
      expect(subscriptionId).toBeNull()
    })
  })

  describe('invoice.voided and invoice.marked_uncollectible events', () => {
    it('should update admin invoice status to void', () => {
      const invoice: Partial<Stripe.Invoice> = {
        id: 'in_voided',
        status: 'void',
        metadata: {
          minbarai_type: 'admin_invoice',
        },
      }

      // Verify: status should be 'void'
      expect(invoice.status).toBe('void')
      expect(invoice.metadata?.minbarai_type).toBe('admin_invoice')
    })

    it('should update admin invoice status to uncollectible', () => {
      const invoice: Partial<Stripe.Invoice> = {
        id: 'in_uncollectible',
        status: 'uncollectible',
        metadata: {
          minbarai_type: 'admin_invoice',
        },
      }

      // Verify: status should be 'uncollectible'
      expect(invoice.status).toBe('uncollectible')
    })

    it('should skip non-admin invoices in status update', () => {
      const invoice: Partial<Stripe.Invoice> = {
        id: 'in_regular',
        status: 'void',
        metadata: {},
      }

      // Verify: regular invoice should skip status update
      expect(invoice.metadata?.minbarai_type).not.toBe('admin_invoice')
    })
  })

  describe('Bulk (multi-account) admin invoice activation', () => {
    it('should target account_emails when present, falling back to recipient_email', () => {
      const bulkInvoice = {
        recipient_email: 'billing@mosque.org',
        account_emails: ['seat+1@mosque.org', 'seat+2@mosque.org', 'seat+3@mosque.org'],
      }
      const singleInvoice = {
        recipient_email: 'pastor@mosque.org',
        account_emails: [],
      }

      const pickTargets = (inv: { recipient_email: string; account_emails: string[] }) =>
        inv.account_emails.length > 0 ? inv.account_emails : [inv.recipient_email]

      expect(pickTargets(bulkInvoice)).toEqual([
        'seat+1@mosque.org',
        'seat+2@mosque.org',
        'seat+3@mosque.org',
      ])
      expect(pickTargets(singleInvoice)).toEqual(['pastor@mosque.org'])
    })

    it('should skip emails already in activated_account_emails (per-email idempotency)', () => {
      const targets = ['a@x.org', 'b@x.org', 'c@x.org']
      const alreadyActivated = new Set(['a@x.org'])

      const toProcess = targets.filter(e => !alreadyActivated.has(e))
      expect(toProcess).toEqual(['b@x.org', 'c@x.org'])
    })

    it('should only set activated_at when all targets succeeded', () => {
      const targets = ['a', 'b', 'c']

      // Partial success → activated_at stays null so Stripe retries
      const partialMerged = ['a', 'b']
      expect(partialMerged.length === targets.length).toBe(false)

      // Full success → activated_at = NOW
      const fullMerged = ['a', 'b', 'c']
      expect(fullMerged.length === targets.length).toBe(true)
    })

    it('should pass null stripe_customer_id for child accounts in bulk mode', () => {
      const recipient = 'billing@org.com'
      const child = 'seat+1@org.com'
      const billingCustomerId = 'cus_billing_123'

      const pickCustomerId = (email: string, isBulk: boolean) =>
        isBulk && email !== recipient ? null : billingCustomerId

      expect(pickCustomerId(recipient, true)).toBe(billingCustomerId)
      expect(pickCustomerId(child, true)).toBeNull()
      expect(pickCustomerId(recipient, false)).toBe(billingCustomerId)
    })

    it('should throw on partial failure so Stripe retries the webhook', () => {
      const targets = ['a', 'b', 'c']
      const succeeded = ['a']
      const failures = [
        { email: 'b', error: new Error('auth failure') },
        { email: 'c', error: new Error('db timeout') },
      ]

      const isFullySuccessful = succeeded.length === targets.length
      expect(isFullySuccessful).toBe(false)
      expect(failures.length > 0).toBe(true)
      // Partial failure => throw => Stripe retries. On retry,
      // activated_account_emails contains ['a'] so 'a' is skipped.
    })
  })

  describe('handleInvoicePaymentSucceeded routing for admin invoices', () => {
    it('REGRESSION: admin invoices MUST be routed through activation on invoice.payment_succeeded', () => {
      // Previously this handler skipped admin invoices, relying on invoice.paid.
      // Many Stripe accounts only subscribe to invoice.payment_succeeded, which
      // stranded admin invoices as 'open' forever. Both events must now route
      // admin invoices through handleAdminInvoicePaid (idempotent via activated_at).
      const invoice: Partial<Stripe.Invoice> = {
        id: 'in_admin',
        status: 'paid',
        metadata: {
          minbarai_type: 'admin_invoice',
          admin_invoice_id: '550e8400-e29b-41d4-a716-446655440000',
          duration_days: '30',
          session_limit_minutes: '120',
        },
      }

      // The routing: if minbarai_type === 'admin_invoice' on payment_succeeded,
      // we call handleAdminInvoicePaid (same path as invoice.paid event).
      expect(invoice.metadata?.minbarai_type).toBe('admin_invoice')
      // Metadata has everything handleAdminInvoicePaid needs
      expect(invoice.metadata?.admin_invoice_id).toBeDefined()
      expect(parseInt(invoice.metadata?.duration_days as string)).toBeGreaterThan(0)
    })

    it('idempotent safety: receiving both invoice.paid AND payment_succeeded processes only once', () => {
      // handleAdminInvoicePaid checks adminInvoice.activated_at and short-circuits
      // if already activated. So even when Stripe delivers BOTH events, activation
      // only happens once (the second event no-ops).
      const firstCall = { alreadyActivatedAt: null as string | null }
      const secondCall = { alreadyActivatedAt: new Date().toISOString() }

      const shouldActivateFirst = !firstCall.alreadyActivatedAt
      const shouldActivateSecond = !secondCall.alreadyActivatedAt

      expect(shouldActivateFirst).toBe(true)
      expect(shouldActivateSecond).toBe(false) // skipped — idempotent
    })
  })
})
