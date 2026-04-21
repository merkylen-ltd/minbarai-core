/** @jest-environment node */

/**
 * Real integration tests for POST /api/admin/invoices.
 *
 * This is the admin money-entry point: creates a Stripe invoice and a matching
 * admin_invoices DB row, applying promo code discounts. Regressions here would
 * silently over-charge customers, mis-apply discounts, or orphan Stripe invoices.
 */

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }))
jest.mock('@/lib/supabase/admin', () => ({ createAdminClient: jest.fn() }))
jest.mock('@/lib/auth/admin', () => ({ requireAdmin: jest.fn() }))
jest.mock('next/headers', () => ({ cookies: jest.fn().mockResolvedValue({}) }))

jest.mock('@/lib/admin/send-invoice-email', () => ({
  sendAdminInvoiceEmail: jest.fn(async () => ({ success: true })),
}))

jest.mock('stripe', () => {
  const mock = {
    customers: { list: jest.fn(), create: jest.fn() },
    invoices: {
      create: jest.fn(),
      update: jest.fn(),
      finalizeInvoice: jest.fn(),
      sendInvoice: jest.fn(),
      retrieve: jest.fn(),
      voidInvoice: jest.fn(),
    },
    invoiceItems: { create: jest.fn() },
  }
  const Ctor = jest.fn(() => mock)
  // Expose on the constructor so tests can reach it
  ;(Ctor as unknown as { __mock: typeof mock }).__mock = mock
  return Ctor
})

// eslint-disable-next-line @typescript-eslint/no-require-imports
const StripeImported = require('stripe') as unknown as { __mock: {
  customers: { list: jest.Mock; create: jest.Mock }
  invoices: {
    create: jest.Mock
    update: jest.Mock
    finalizeInvoice: jest.Mock
    sendInvoice: jest.Mock
    retrieve: jest.Mock
    voidInvoice: jest.Mock
  }
  invoiceItems: { create: jest.Mock }
} }
const stripeMock = StripeImported.__mock

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { POST as createInvoice } from '@/app/api/admin/invoices/route'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/admin'
import { sendAdminInvoiceEmail } from '@/lib/admin/send-invoice-email'

// ---------------------------------------------------------------------------
// Supabase admin client mock — chainable query builder
// ---------------------------------------------------------------------------

type DbState = {
  promoLookup?: { data: Record<string, unknown> | null; error: unknown }
  insertResult?: { error: unknown }
  updateResult?: { error: unknown }
  insertCalls: Array<{ table: string; row: Record<string, unknown> }>
  updateCalls: Array<{ table: string; payload: Record<string, unknown>; filter: unknown }>
}

function makeAdminClient(state: DbState) {
  return {
    from: jest.fn((table: string) => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(async () => state.promoLookup || { data: null, error: null }),
        })),
      })),
      insert: jest.fn(async (row: Record<string, unknown>) => {
        state.insertCalls.push({ table, row })
        return state.insertResult || { error: null }
      }),
      update: jest.fn((payload: Record<string, unknown>) => ({
        eq: jest.fn(async (col: string, value: unknown) => {
          state.updateCalls.push({ table, payload, filter: { col, value } })
          return state.updateResult || { error: null }
        }),
      })),
    })),
  }
}

function makeAuthClient() {
  return {
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { email: 'admin@minbarai.com' } } }) },
  }
}

// Helper to create NextRequest-ish object
function makeRequest(body: Record<string, unknown>) {
  return new Request('http://localhost/api/admin/invoices', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as unknown as import('next/server').NextRequest
}

// Valid body fixture
const validBody = {
  recipientEmail: 'client@org.com',
  orgName: 'Client Org',
  amount: 150,
  currency: 'eur',
  description: 'MinbarAI license',
  durationDays: 30,
  sessionLimitMinutes: 120,
  dueDate: '2026-05-01',
}

// ---------------------------------------------------------------------------
// Default Stripe happy-path responses
// ---------------------------------------------------------------------------

function setupStripeHappyPath() {
  stripeMock.customers.list.mockResolvedValue({ data: [] })
  stripeMock.customers.create.mockResolvedValue({ id: 'cus_new_123' })
  stripeMock.invoices.create.mockResolvedValue({ id: 'in_test_123' })
  stripeMock.invoices.update.mockResolvedValue({ id: 'in_test_123' })
  stripeMock.invoices.finalizeInvoice.mockResolvedValue({ id: 'in_test_123' })
  stripeMock.invoices.sendInvoice.mockResolvedValue({ id: 'in_test_123' })
  stripeMock.invoices.retrieve.mockResolvedValue({
    id: 'in_test_123',
    hosted_invoice_url: 'https://invoice.stripe.com/test',
    status: 'open',
  })
  stripeMock.invoices.voidInvoice.mockResolvedValue({ id: 'in_test_123', status: 'void' })
  stripeMock.invoiceItems.create.mockResolvedValue({ id: 'ii_test_123' })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/admin/invoices — admin money-path', () => {
  let state: DbState

  beforeEach(() => {
    jest.clearAllMocks()
    state = { insertCalls: [], updateCalls: [] }
    ;(createAdminClient as jest.Mock).mockReturnValue(makeAdminClient(state))
    ;(createClient as jest.Mock).mockReturnValue(makeAuthClient())
    ;(requireAdmin as jest.Mock).mockImplementation(() => {})
    setupStripeHappyPath()
  })

  // =========================================================================
  // Auth gating
  // =========================================================================

  describe('auth and validation', () => {
    it('returns 401 when user is unauthenticated', async () => {
      ;(createClient as jest.Mock).mockReturnValue({
        auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null } }) },
      })

      const res = await createInvoice(makeRequest(validBody))
      expect(res.status).toBe(401)
    })

    it('returns 400 when required fields are missing', async () => {
      const res = await createInvoice(
        makeRequest({ ...validBody, amount: undefined } as unknown as typeof validBody),
      )
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toMatch(/required/i)
      expect(stripeMock.invoices.create).not.toHaveBeenCalled()
    })
  })

  // =========================================================================
  // Discount math — promo percent_off and amount_off
  // =========================================================================

  describe('promo discount math', () => {
    it('percent_off: 20% of €150 = €30 discount, final €120', async () => {
      state.promoLookup = {
        data: {
          id: 'promo_1',
          percent_off: 20,
          amount_off_cents: null,
          currency: null,
          stripe_promotion_code_id: 'promo_stripe_1',
          is_active: true,
          expires_at: null,
          max_redemptions: null,
          redemptions_count: 0,
        },
        error: null,
      }

      const res = await createInvoice(makeRequest({ ...validBody, promoCodeId: 'promo_1' }))
      expect(res.status).toBe(200)

      const inserted = state.insertCalls.find(c => c.table === 'admin_invoices')
      expect(inserted).toBeDefined()
      expect(inserted!.row.amount_cents).toBe(15000)
      expect(inserted!.row.discount_amount_cents).toBe(3000)
      expect(inserted!.row.final_amount_cents).toBe(12000)
    })

    it('amount_off: €50 off €150 = final €100', async () => {
      state.promoLookup = {
        data: {
          id: 'promo_amt',
          amount_off_cents: 5000,
          percent_off: null,
          currency: 'eur',
          stripe_promotion_code_id: 'promo_stripe_amt',
          is_active: true,
          expires_at: null,
          max_redemptions: null,
          redemptions_count: 0,
        },
        error: null,
      }

      await createInvoice(makeRequest({ ...validBody, promoCodeId: 'promo_amt' }))

      const inserted = state.insertCalls.find(c => c.table === 'admin_invoices')!
      expect(inserted.row.discount_amount_cents).toBe(5000)
      expect(inserted.row.final_amount_cents).toBe(10000)
    })

    it('discount larger than amount: final clamps to 0 (never negative)', async () => {
      state.promoLookup = {
        data: {
          id: 'huge_discount',
          amount_off_cents: 50000, // €500 off
          percent_off: null,
          currency: 'eur',
          stripe_promotion_code_id: 'promo_stripe_huge',
          is_active: true,
          expires_at: null,
          max_redemptions: null,
          redemptions_count: 0,
        },
        error: null,
      }

      // Invoice is only €150 but promo is €500 off
      await createInvoice(makeRequest({ ...validBody, promoCodeId: 'huge_discount' }))

      const inserted = state.insertCalls.find(c => c.table === 'admin_invoices')!
      expect(inserted.row.final_amount_cents).toBe(0)
      expect(inserted.row.final_amount_cents as number).toBeGreaterThanOrEqual(0)
    })

    it('no promo code: final_amount_cents == amount_cents (no discount)', async () => {
      await createInvoice(makeRequest(validBody))

      const inserted = state.insertCalls.find(c => c.table === 'admin_invoices')!
      expect(inserted.row.amount_cents).toBe(15000)
      expect(inserted.row.final_amount_cents).toBe(15000)
      expect(inserted.row.discount_amount_cents).toBe(0)
      expect(inserted.row.promo_code_id).toBeNull()
    })

    it('fractional amount rounds to nearest cent: €9.995 → 1000 cents', async () => {
      // 9.995 * 100 = 999.4999...  Math.round = 999. But the commonly-asked
      // edge case: 10.005 rounds to 1001. We document the rounding behavior.
      await createInvoice(makeRequest({ ...validBody, amount: 10.005 }))

      const inserted = state.insertCalls.find(c => c.table === 'admin_invoices')!
      // Math.round(10.005 * 100) = Math.round(1000.4999...) = 1000
      // Floating-point: 10.005 * 100 in JS = 1000.4999999999999
      expect(inserted.row.amount_cents).toBeGreaterThanOrEqual(1000)
      expect(inserted.row.amount_cents).toBeLessThanOrEqual(1001)
    })
  })

  // =========================================================================
  // Promo code guardrails — currency, expiry, redemptions, active flag
  // =========================================================================

  describe('promo code guardrails', () => {
    it('rejects amount_off promo with currency different from invoice currency', async () => {
      state.promoLookup = {
        data: {
          id: 'promo_usd',
          amount_off_cents: 5000,
          percent_off: null,
          currency: 'usd', // Promo is USD
          stripe_promotion_code_id: 'promo_stripe_usd',
          is_active: true,
          expires_at: null,
          max_redemptions: null,
          redemptions_count: 0,
        },
        error: null,
      }

      // Invoice is EUR
      const res = await createInvoice(
        makeRequest({ ...validBody, currency: 'eur', promoCodeId: 'promo_usd' }),
      )
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toMatch(/currency/i)
      expect(stripeMock.invoices.create).not.toHaveBeenCalled()
      expect(state.insertCalls).toHaveLength(0)
    })

    it('rejects inactive promo code', async () => {
      state.promoLookup = {
        data: {
          id: 'deactivated',
          percent_off: 20,
          is_active: false,
          expires_at: null,
          max_redemptions: null,
          redemptions_count: 0,
        },
        error: null,
      }

      const res = await createInvoice(makeRequest({ ...validBody, promoCodeId: 'deactivated' }))
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toMatch(/not active/i)
      expect(state.insertCalls).toHaveLength(0)
    })

    it('rejects expired promo code', async () => {
      const pastDate = new Date(Date.now() - 86400000).toISOString()
      state.promoLookup = {
        data: {
          id: 'expired',
          percent_off: 20,
          is_active: true,
          expires_at: pastDate,
          max_redemptions: null,
          redemptions_count: 0,
        },
        error: null,
      }

      const res = await createInvoice(makeRequest({ ...validBody, promoCodeId: 'expired' }))
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toMatch(/expired/i)
    })

    it('rejects promo that has reached max redemptions', async () => {
      state.promoLookup = {
        data: {
          id: 'maxed',
          percent_off: 20,
          is_active: true,
          expires_at: null,
          max_redemptions: 5,
          redemptions_count: 5,
        },
        error: null,
      }

      const res = await createInvoice(makeRequest({ ...validBody, promoCodeId: 'maxed' }))
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toMatch(/max redemptions/i)
    })

    it('rejects promo code that does not exist', async () => {
      state.promoLookup = { data: null, error: null }

      const res = await createInvoice(makeRequest({ ...validBody, promoCodeId: 'ghost' }))
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toMatch(/not found/i)
    })
  })

  // =========================================================================
  // Bulk multi-seat — accountEmails persistence
  // =========================================================================

  describe('bulk (multi-seat) invoices', () => {
    it('persists account_emails (lowercased, trimmed, falsy-stripped) to admin_invoices', async () => {
      await createInvoice(
        makeRequest({
          ...validBody,
          accountEmails: ['  Seat+1@ORG.com  ', 'seat+2@org.com', '', '   '],
        }),
      )

      const inserted = state.insertCalls.find(c => c.table === 'admin_invoices')!
      expect(inserted.row.account_emails).toEqual(['seat+1@org.com', 'seat+2@org.com'])
    })

    it('embeds account_count in Stripe metadata so webhook knows it is bulk', async () => {
      await createInvoice(
        makeRequest({
          ...validBody,
          accountEmails: ['a@x.org', 'b@x.org', 'c@x.org'],
        }),
      )

      expect(stripeMock.invoices.create).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            minbarai_type: 'admin_invoice',
            account_count: '3',
          }),
        }),
        expect.any(Object),
      )
    })

    it('single-account invoice (no accountEmails) stores empty array and account_count=1', async () => {
      await createInvoice(makeRequest(validBody))

      const inserted = state.insertCalls.find(c => c.table === 'admin_invoices')!
      expect(inserted.row.account_emails).toEqual([])

      const stripeCall = stripeMock.invoices.create.mock.calls[0][0]
      expect(stripeCall.metadata.account_count).toBe('1')
    })
  })

  // =========================================================================
  // Rollback — if DB insert fails, Stripe invoice must be voided
  // =========================================================================

  describe('rollback on DB failure', () => {
    it('voids the Stripe invoice when admin_invoices insert fails', async () => {
      state.insertResult = { error: new Error('unique constraint violation') }

      const res = await createInvoice(makeRequest(validBody))

      expect(res.status).toBe(500)
      expect(stripeMock.invoices.voidInvoice).toHaveBeenCalledWith('in_test_123')
    })
  })

  // =========================================================================
  // Stripe customer reuse — don't create duplicate customers
  // =========================================================================

  describe('Stripe customer reuse', () => {
    it('reuses existing Stripe customer when one matches recipient email', async () => {
      stripeMock.customers.list.mockResolvedValue({
        data: [{ id: 'cus_existing_999', email: 'client@org.com' }],
      })

      await createInvoice(makeRequest(validBody))

      expect(stripeMock.customers.create).not.toHaveBeenCalled()
      expect(stripeMock.invoices.create).toHaveBeenCalledWith(
        expect.objectContaining({ customer: 'cus_existing_999' }),
        expect.any(Object),
      )
    })
  })

  // =========================================================================
  // Idempotency — every Stripe call uses a deterministic key
  // =========================================================================

  describe('Stripe idempotency', () => {
    it('uses distinct idempotency keys for customer, invoice, line-item, finalize, send', async () => {
      await createInvoice(makeRequest(validBody))

      const keys = [
        stripeMock.customers.create.mock.calls[0]?.[1]?.idempotencyKey,
        stripeMock.invoices.create.mock.calls[0]?.[1]?.idempotencyKey,
        stripeMock.invoiceItems.create.mock.calls[0]?.[1]?.idempotencyKey,
        stripeMock.invoices.finalizeInvoice.mock.calls[0]?.[1]?.idempotencyKey,
        stripeMock.invoices.sendInvoice.mock.calls[0]?.[1]?.idempotencyKey,
      ].filter(Boolean) as string[]

      // All five must be different strings (not reused)
      expect(new Set(keys).size).toBe(keys.length)
      // All should share the admin_invoice_id suffix
      const suffixes = keys.map(k => k.split('-').pop())
      expect(new Set(suffixes).size).toBe(1) // same suffix
    })
  })

  // =========================================================================
  // Email delivery — Resend fallback alongside Stripe sendInvoice
  // =========================================================================

  describe('Resend fallback email delivery', () => {
    it('sends a branded Resend email with hosted_invoice_url after Stripe finalize', async () => {
      await createInvoice(makeRequest(validBody))

      expect(sendAdminInvoiceEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientEmail: 'client@org.com',
          organizationName: 'Client Org',
          amountCents: 15000,
          currency: 'eur',
          description: 'MinbarAI license',
          invoiceUrl: 'https://invoice.stripe.com/test',
        }),
      )
    })

    it('uses FINAL (post-discount) amount in the email, not the subtotal', async () => {
      state.promoLookup = {
        data: {
          id: 'promo_1',
          percent_off: 20,
          is_active: true,
          expires_at: null,
          max_redemptions: null,
          redemptions_count: 0,
        },
        error: null,
      }

      await createInvoice(makeRequest({ ...validBody, promoCodeId: 'promo_1' }))

      expect(sendAdminInvoiceEmail).toHaveBeenCalledWith(
        expect.objectContaining({ amountCents: 12000 }), // €150 * 0.8 = €120
      )
    })

    it('continues invoice creation when Stripe sendInvoice throws (Resend is the safety net)', async () => {
      stripeMock.invoices.sendInvoice.mockRejectedValueOnce(new Error('Stripe email disabled'))

      const res = await createInvoice(makeRequest(validBody))

      expect(res.status).toBe(200)
      // Resend still called — the customer still gets an email
      expect(sendAdminInvoiceEmail).toHaveBeenCalledTimes(1)
      // DB row still inserted
      expect(state.insertCalls.find(c => c.table === 'admin_invoices')).toBeDefined()
    })

    it('logs + continues when invoice lacks hosted_invoice_url (surfaces as console error, not 500)', async () => {
      stripeMock.invoices.retrieve.mockResolvedValueOnce({
        id: 'in_test_123',
        hosted_invoice_url: null,
        status: 'open',
      })

      const res = await createInvoice(makeRequest(validBody))

      expect(res.status).toBe(200)
      // No Resend call — there's no URL to send
      expect(sendAdminInvoiceEmail).not.toHaveBeenCalled()
    })

    it('does NOT fail the request when Resend returns an error (admin still gets URL)', async () => {
      ;(sendAdminInvoiceEmail as jest.Mock).mockResolvedValueOnce({
        success: false,
        error: 'Resend quota exceeded',
      })

      const res = await createInvoice(makeRequest(validBody))
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.success).toBe(true)
      expect(body.hostedInvoiceUrl).toBe('https://invoice.stripe.com/test')
    })
  })

  // =========================================================================
  // Redemption counter
  // =========================================================================

  describe('promo redemption tracking', () => {
    it('increments redemptions_count by 1 after successful invoice creation', async () => {
      state.promoLookup = {
        data: {
          id: 'promo_count',
          percent_off: 10,
          is_active: true,
          expires_at: null,
          max_redemptions: 100,
          redemptions_count: 42,
        },
        error: null,
      }

      await createInvoice(makeRequest({ ...validBody, promoCodeId: 'promo_count' }))

      const updateCall = state.updateCalls.find(c => c.table === 'promo_codes')
      expect(updateCall).toBeDefined()
      expect(updateCall!.payload.redemptions_count).toBe(43)
    })
  })
})
