/** @jest-environment node */

/**
 * Tests for POST /api/admin/invoices/[id]/void
 *
 * Critical money-path rules locked in here:
 *  - Void only applies to 'open' (Stripe's API forbids voiding paid)
 *  - BULK void cascades: child accounts suspended (not deleted — suspension is reversible)
 *  - SINGLE void does NOT touch the recipient user (may have unrelated history)
 *  - Every void logs an activity-feed entry for audit
 */

jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }))
jest.mock('@/lib/supabase/admin', () => ({ createAdminClient: jest.fn() }))
jest.mock('@/lib/auth/admin', () => ({ requireAdmin: jest.fn() }))
jest.mock('next/headers', () => ({ cookies: jest.fn().mockResolvedValue({}) }))
jest.mock('@/lib/admin/notifications', () => ({
  logNotification: jest.fn(async () => undefined),
}))

jest.mock('stripe', () => {
  const mock = { invoices: { voidInvoice: jest.fn() } }
  const Ctor = jest.fn(() => mock)
  ;(Ctor as unknown as { __mock: typeof mock }).__mock = mock
  return Ctor
})

// eslint-disable-next-line @typescript-eslint/no-require-imports
const StripeImported = require('stripe') as unknown as {
  __mock: { invoices: { voidInvoice: jest.Mock } }
}
const stripeMock = StripeImported.__mock

import { POST as voidInvoice } from '@/app/api/admin/invoices/[id]/void/route'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/admin'
import { logNotification } from '@/lib/admin/notifications'

type DbState = {
  invoice: Record<string, unknown> | null
  invoiceUpdateResult: { error: unknown }
  userUpdateResults: Record<string, { error: unknown }> // keyed by email
  invoiceUpdateCalls: Array<Record<string, unknown>>
  userUpdateCalls: Array<{ email: string; payload: Record<string, unknown> }>
}

function makeAdminClient(state: DbState) {
  return {
    from: jest.fn((table: string) => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(async () => ({
            data: state.invoice,
            error: state.invoice ? null : new Error('not found'),
          })),
        })),
      })),
      update: jest.fn((payload: Record<string, unknown>) => ({
        eq: jest.fn(async (col: string, value: unknown) => {
          if (table === 'admin_invoices') {
            state.invoiceUpdateCalls.push(payload)
            return state.invoiceUpdateResult
          }
          if (table === 'users') {
            const email = String(value)
            state.userUpdateCalls.push({ email, payload })
            return state.userUpdateResults[email] || { error: null }
          }
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
  new Request('http://localhost/api/admin/invoices/inv_abc/void', { method: 'POST' }) as unknown as import('next/server').NextRequest
const params = { params: { id: 'inv_abc' } }

const singleInvoice = {
  id: 'inv_abc',
  stripe_invoice_id: 'in_stripe_123',
  recipient_email: 'client@org.com',
  status: 'open',
  account_emails: [] as string[],
  final_amount_cents: 15000,
  currency: 'eur',
}

const bulkInvoice = {
  ...singleInvoice,
  id: 'inv_bulk',
  recipient_email: 'billing@org.com',
  account_emails: ['seat+1@org.com', 'seat+2@org.com', 'seat+3@org.com'],
}

describe('POST /api/admin/invoices/[id]/void', () => {
  let state: DbState

  beforeEach(() => {
    jest.clearAllMocks()
    state = {
      invoice: null,
      invoiceUpdateResult: { error: null },
      userUpdateResults: {},
      invoiceUpdateCalls: [],
      userUpdateCalls: [],
    }
    ;(createAdminClient as jest.Mock).mockReturnValue(makeAdminClient(state))
    ;(createClient as jest.Mock).mockReturnValue(makeAuthClient())
    ;(requireAdmin as jest.Mock).mockImplementation(() => {})
    stripeMock.invoices.voidInvoice.mockResolvedValue({ id: 'in_stripe_123', status: 'void' })
  })

  // =========================================================================
  // Status guards — only open can be voided
  // =========================================================================

  describe('status guards', () => {
    it('rejects voiding a PAID invoice (Stripe forbids this; refund flow instead)', async () => {
      state.invoice = { ...singleInvoice, status: 'paid' }

      const res = await voidInvoice(req(), params)

      expect(res.status).toBe(400)
      expect(stripeMock.invoices.voidInvoice).not.toHaveBeenCalled()
      expect(state.userUpdateCalls).toHaveLength(0)
      const body = await res.json()
      expect(body.error).toMatch(/refund/i)
    })

    it('rejects voiding an already-void invoice', async () => {
      state.invoice = { ...singleInvoice, status: 'void' }

      const res = await voidInvoice(req(), params)

      expect(res.status).toBe(400)
      expect(stripeMock.invoices.voidInvoice).not.toHaveBeenCalled()
    })

    it('returns 404 when invoice not found', async () => {
      state.invoice = null

      const res = await voidInvoice(req(), params)
      expect(res.status).toBe(404)
    })
  })

  // =========================================================================
  // Single-account void — MUST NOT touch the recipient user
  // =========================================================================

  describe('single-account void (recipient user has unrelated history)', () => {
    it('marks invoice void in Stripe + DB, does NOT touch the recipient user', async () => {
      state.invoice = { ...singleInvoice }

      const res = await voidInvoice(req(), params)

      expect(res.status).toBe(200)
      expect(stripeMock.invoices.voidInvoice).toHaveBeenCalledWith('in_stripe_123')
      expect(state.invoiceUpdateCalls).toEqual([{ status: 'void' }])

      // CRITICAL: no user updates. Single-mode account may predate this invoice
      // with a separate paid subscription — deleting/suspending would wipe that.
      expect(state.userUpdateCalls).toHaveLength(0)

      const body = await res.json()
      expect(body.isBulk).toBe(false)
      expect(body.suspendedCount).toBe(0)
    })

    it('logs a void activity entry mentioning the recipient is left untouched', async () => {
      state.invoice = { ...singleInvoice }

      await voidInvoice(req(), params)

      expect(logNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'invoice_voided',
          targetEmail: 'client@org.com',
          metadata: expect.objectContaining({ is_bulk: false, suspended_emails: [] }),
        }),
      )
    })
  })

  // =========================================================================
  // Bulk void — MUST suspend all child accounts
  // =========================================================================

  describe('bulk void (child accounts are orphan seats)', () => {
    it('suspends every child account in account_emails', async () => {
      state.invoice = { ...bulkInvoice }

      const res = await voidInvoice(req(), params)

      expect(res.status).toBe(200)
      expect(state.userUpdateCalls).toHaveLength(3)
      const emails = state.userUpdateCalls.map(c => c.email).sort()
      expect(emails).toEqual(['seat+1@org.com', 'seat+2@org.com', 'seat+3@org.com'])

      // Every suspension sets all three critical fields
      for (const call of state.userUpdateCalls) {
        expect(call.payload.is_suspended).toBe(true)
        expect(call.payload.subscription_status).toBe('cancelled')
        expect(call.payload.subscription_period_end).toBeDefined()
      }

      const body = await res.json()
      expect(body.isBulk).toBe(true)
      expect(body.suspendedCount).toBe(3)
    })

    it('does NOT touch the billing (recipient) account even in bulk mode', async () => {
      state.invoice = { ...bulkInvoice }

      await voidInvoice(req(), params)

      const updatedEmails = state.userUpdateCalls.map(c => c.email)
      expect(updatedEmails).not.toContain('billing@org.com')
    })

    it('continues suspending remaining seats when one suspension fails', async () => {
      state.invoice = { ...bulkInvoice }
      state.userUpdateResults = {
        'seat+2@org.com': { error: { message: 'db timeout' } },
      }

      const res = await voidInvoice(req(), params)
      const body = await res.json()

      expect(res.status).toBe(200)
      // All three were attempted
      expect(state.userUpdateCalls).toHaveLength(3)
      // But only 2 succeeded
      expect(body.suspendedCount).toBe(2)
      expect(body.suspensionErrors).toHaveLength(1)
      expect(body.suspensionErrors[0].email).toBe('seat+2@org.com')
    })

    it('uses case-insensitive email matching when suspending (emails stored lowercased)', async () => {
      state.invoice = {
        ...bulkInvoice,
        account_emails: ['Seat+1@Org.com', 'SEAT+2@ORG.com'],
      }

      await voidInvoice(req(), params)

      const emails = state.userUpdateCalls.map(c => c.email).sort()
      expect(emails).toEqual(['seat+1@org.com', 'seat+2@org.com'])
    })

    it('logs activity with exact count of suspended vs attempted', async () => {
      state.invoice = { ...bulkInvoice }
      state.userUpdateResults = {
        'seat+3@org.com': { error: { message: 'network error' } },
      }

      await voidInvoice(req(), params)

      expect(logNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'invoice_voided',
          metadata: expect.objectContaining({
            is_bulk: true,
            suspended_emails: ['seat+1@org.com', 'seat+2@org.com'],
          }),
        }),
      )
    })
  })

  // =========================================================================
  // DB failures
  // =========================================================================

  describe('failure modes', () => {
    it('returns 500 if admin_invoices status update fails (after Stripe void)', async () => {
      state.invoice = { ...singleInvoice }
      state.invoiceUpdateResult = { error: new Error('DB down') }

      const res = await voidInvoice(req(), params)

      expect(res.status).toBe(500)
      // Stripe void already happened — that's a known consequence of the order
      expect(stripeMock.invoices.voidInvoice).toHaveBeenCalled()
    })
  })
})
