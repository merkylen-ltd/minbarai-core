/** @jest-environment node */

/**
 * Tests for POST /api/admin/invoices/[id]/resend
 *
 * The whole point of this endpoint is reliable email delivery. A regression
 * that silently no-ops (the prior behavior when Stripe Dashboard email is off)
 * leaves admins clicking "Resend" with nothing happening. These tests lock
 * in: the route MUST call Resend, MUST refetch the URL if missing, and MUST
 * surface a clear error when neither path works.
 */

jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }))
jest.mock('@/lib/supabase/admin', () => ({ createAdminClient: jest.fn() }))
jest.mock('@/lib/auth/admin', () => ({ requireAdmin: jest.fn() }))
jest.mock('next/headers', () => ({ cookies: jest.fn().mockResolvedValue({}) }))

jest.mock('@/lib/admin/send-invoice-email', () => ({
  sendAdminInvoiceEmail: jest.fn(async () => ({ success: true })),
}))

jest.mock('stripe', () => {
  const mock = {
    invoices: {
      sendInvoice: jest.fn(),
      retrieve: jest.fn(),
    },
  }
  const Ctor = jest.fn(() => mock)
  ;(Ctor as unknown as { __mock: typeof mock }).__mock = mock
  return Ctor
})

// eslint-disable-next-line @typescript-eslint/no-require-imports
const StripeImported = require('stripe') as unknown as {
  __mock: { invoices: { sendInvoice: jest.Mock; retrieve: jest.Mock } }
}
const stripeMock = StripeImported.__mock

import { POST as resendInvoice } from '@/app/api/admin/invoices/[id]/resend/route'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/admin'
import { sendAdminInvoiceEmail } from '@/lib/admin/send-invoice-email'

// ---------------------------------------------------------------------------
// Supabase admin mock
// ---------------------------------------------------------------------------

type DbState = {
  invoice: Record<string, unknown> | null
  updateCalls: Array<Record<string, unknown>>
}

function makeAdminClient(state: DbState) {
  return {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(async () => ({
            data: state.invoice,
            error: state.invoice ? null : new Error('not found'),
          })),
        })),
      })),
      update: jest.fn((payload: Record<string, unknown>) => ({
        eq: jest.fn(async () => {
          state.updateCalls.push(payload)
          return { error: null }
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

const req = () =>
  new Request('http://localhost/api/admin/invoices/inv_abc/resend', { method: 'POST' }) as unknown as import('next/server').NextRequest

const params = { params: { id: 'inv_abc' } }

const openInvoice = {
  id: 'inv_abc',
  stripe_invoice_id: 'in_stripe_123',
  stripe_invoice_url: 'https://invoice.stripe.com/original',
  recipient_email: 'client@org.com',
  org_name: 'Client Org',
  amount_cents: 15000,
  final_amount_cents: 12000,
  currency: 'eur',
  description: 'License',
  due_date: '2026-05-01',
  status: 'open',
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/admin/invoices/[id]/resend', () => {
  let state: DbState

  beforeEach(() => {
    jest.clearAllMocks()
    state = { invoice: { ...openInvoice }, updateCalls: [] }
    ;(createAdminClient as jest.Mock).mockReturnValue(makeAdminClient(state))
    ;(createClient as jest.Mock).mockReturnValue(makeAuthClient())
    ;(requireAdmin as jest.Mock).mockImplementation(() => {})
    stripeMock.invoices.sendInvoice.mockResolvedValue({ id: 'in_stripe_123' })
    stripeMock.invoices.retrieve.mockResolvedValue({
      id: 'in_stripe_123',
      hosted_invoice_url: 'https://invoice.stripe.com/refreshed',
    })
  })

  it('calls BOTH Stripe sendInvoice AND Resend on happy path', async () => {
    const res = await resendInvoice(req(), params)

    expect(res.status).toBe(200)
    expect(stripeMock.invoices.sendInvoice).toHaveBeenCalledWith('in_stripe_123')
    expect(sendAdminInvoiceEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientEmail: 'client@org.com',
        invoiceUrl: 'https://invoice.stripe.com/original',
        amountCents: 12000, // final, not amount_cents
      }),
    )
  })

  it('REGRESSION: Resend still fires even when Stripe sendInvoice throws', async () => {
    // This is the bug that caused "invoice email is not sent". If Stripe's
    // email is disabled, sendInvoice may succeed silently or throw. Either way,
    // the Resend fallback must still deliver.
    stripeMock.invoices.sendInvoice.mockRejectedValueOnce(new Error('Stripe email disabled'))

    const res = await resendInvoice(req(), params)

    expect(res.status).toBe(200)
    expect(sendAdminInvoiceEmail).toHaveBeenCalledTimes(1)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.stripeSendError).toBeTruthy()
  })

  it('refetches hosted_invoice_url from Stripe if DB has null and persists it back', async () => {
    state.invoice = { ...openInvoice, stripe_invoice_url: null }

    const res = await resendInvoice(req(), params)

    expect(res.status).toBe(200)
    expect(stripeMock.invoices.retrieve).toHaveBeenCalledWith('in_stripe_123')
    expect(sendAdminInvoiceEmail).toHaveBeenCalledWith(
      expect.objectContaining({ invoiceUrl: 'https://invoice.stripe.com/refreshed' }),
    )
    // Refreshed URL written back to DB so future resends are fast
    expect(state.updateCalls.some(u => u.stripe_invoice_url === 'https://invoice.stripe.com/refreshed')).toBe(true)
  })

  it('returns 502 when no hosted URL can be obtained (not 200 silent success)', async () => {
    state.invoice = { ...openInvoice, stripe_invoice_url: null }
    stripeMock.invoices.retrieve.mockResolvedValueOnce({
      id: 'in_stripe_123',
      hosted_invoice_url: null,
    })

    const res = await resendInvoice(req(), params)

    expect(res.status).toBe(502)
    expect(sendAdminInvoiceEmail).not.toHaveBeenCalled()
  })

  it('returns 502 when Resend fails so admin knows to retry', async () => {
    ;(sendAdminInvoiceEmail as jest.Mock).mockResolvedValueOnce({
      success: false,
      error: 'Resend quota exceeded',
    })

    const res = await resendInvoice(req(), params)

    expect(res.status).toBe(502)
    const body = await res.json()
    expect(body.error).toMatch(/quota/i)
  })

  it('rejects resend for paid invoice (409-style protection — was 400)', async () => {
    state.invoice = { ...openInvoice, status: 'paid' }

    const res = await resendInvoice(req(), params)

    expect(res.status).toBe(400)
    expect(sendAdminInvoiceEmail).not.toHaveBeenCalled()
  })

  it('rejects resend for void invoice', async () => {
    state.invoice = { ...openInvoice, status: 'void' }

    const res = await resendInvoice(req(), params)

    expect(res.status).toBe(400)
    expect(sendAdminInvoiceEmail).not.toHaveBeenCalled()
  })

  it('returns 404 when invoice not found', async () => {
    state.invoice = null

    const res = await resendInvoice(req(), params)
    expect(res.status).toBe(404)
  })

  it('returns 400 when invoice has no stripe_invoice_id', async () => {
    state.invoice = { ...openInvoice, stripe_invoice_id: null }

    const res = await resendInvoice(req(), params)
    expect(res.status).toBe(400)
    expect(sendAdminInvoiceEmail).not.toHaveBeenCalled()
  })
})
