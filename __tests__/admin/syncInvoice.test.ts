/** @jest-environment node */

/**
 * Tests for POST /api/admin/invoices/[id]/sync
 *
 * Sync reconciles open→paid when the Stripe webhook missed. Rules that MUST
 * hold:
 *  - Only open→paid transitions; never paid→anything (refund handled separately)
 *  - Uses idempotent activation lib — retries never double-extend subscriptions
 *  - 409 when Stripe says something unexpected (e.g. void) so admin reviews manually
 *  - Activity feed entry on every successful reconcile
 */

jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }))
jest.mock('@/lib/supabase/admin', () => ({ createAdminClient: jest.fn() }))
jest.mock('@/lib/auth/admin', () => ({ requireAdmin: jest.fn() }))
jest.mock('next/headers', () => ({ cookies: jest.fn().mockResolvedValue({}) }))
jest.mock('@/lib/admin/notifications', () => ({
  logNotification: jest.fn(async () => undefined),
}))
jest.mock('@/lib/admin/activate-invoice', () => ({
  activateAdminInvoiceAccounts: jest.fn(async () => ({
    targets: ['client@org.com'],
    newlyActivated: [{ email: 'client@org.com', userId: 'uid_1' }],
    failures: [],
    previouslyActivated: [],
    fullyActivated: true,
    isBulk: false,
  })),
  activateSingleUserForInvoice: jest.fn(),
}))

jest.mock('stripe', () => {
  const mock = { invoices: { retrieve: jest.fn() } }
  const Ctor = jest.fn(() => mock)
  ;(Ctor as unknown as { __mock: typeof mock }).__mock = mock
  return Ctor
})

// eslint-disable-next-line @typescript-eslint/no-require-imports
const StripeImported = require('stripe') as unknown as {
  __mock: { invoices: { retrieve: jest.Mock } }
}
const stripeMock = StripeImported.__mock

import { POST as syncInvoice } from '@/app/api/admin/invoices/[id]/sync/route'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/admin'
import { activateAdminInvoiceAccounts } from '@/lib/admin/activate-invoice'
import { logNotification } from '@/lib/admin/notifications'

type DbState = { invoice: Record<string, unknown> | null }

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
      update: jest.fn(() => ({
        eq: jest.fn(async () => ({ error: null })),
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
  new Request('http://localhost/api/admin/invoices/inv_abc/sync', { method: 'POST' }) as unknown as import('next/server').NextRequest
const params = { params: { id: 'inv_abc' } }

const openInvoice = {
  id: 'inv_abc',
  stripe_invoice_id: 'in_stripe_123',
  recipient_email: 'client@org.com',
  status: 'open',
  duration_days: 30,
  session_limit_minutes: 120,
  account_emails: [] as string[],
}

describe('POST /api/admin/invoices/[id]/sync', () => {
  let state: DbState

  beforeEach(() => {
    jest.clearAllMocks()
    state = { invoice: { ...openInvoice } }
    ;(createAdminClient as jest.Mock).mockReturnValue(makeAdminClient(state))
    ;(createClient as jest.Mock).mockReturnValue(makeAuthClient())
    ;(requireAdmin as jest.Mock).mockImplementation(() => {})
  })

  describe('happy path: open → paid', () => {
    it('reconciles and activates via the idempotent lib', async () => {
      stripeMock.invoices.retrieve.mockResolvedValue({
        id: 'in_stripe_123',
        status: 'paid',
        metadata: { duration_days: '30', session_limit_minutes: '120' },
      })

      const res = await syncInvoice(req(), params)
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.reconciled).toBe(true)
      expect(body.success).toBe(true)
      expect(body.newlyActivated).toEqual(['client@org.com'])
      expect(activateAdminInvoiceAccounts).toHaveBeenCalledTimes(1)
    })

    it('logs an invoice_sync activity entry', async () => {
      stripeMock.invoices.retrieve.mockResolvedValue({
        id: 'in_stripe_123',
        status: 'paid',
        metadata: { duration_days: '30', session_limit_minutes: '120' },
      })

      await syncInvoice(req(), params)

      expect(logNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'invoice_sync',
          targetEmail: 'client@org.com',
          actorEmail: 'admin@minbarai.com',
        }),
      )
    })
  })

  describe('no-op when already in sync', () => {
    it('returns alreadyInSync=true when both sides agree (open)', async () => {
      stripeMock.invoices.retrieve.mockResolvedValue({
        id: 'in_stripe_123',
        status: 'open',
      })

      const res = await syncInvoice(req(), params)
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.alreadyInSync).toBe(true)
      expect(activateAdminInvoiceAccounts).not.toHaveBeenCalled()
    })

    it('returns alreadyInSync=true when both sides agree (paid)', async () => {
      state.invoice = { ...openInvoice, status: 'paid' }
      stripeMock.invoices.retrieve.mockResolvedValue({
        id: 'in_stripe_123',
        status: 'paid',
      })

      const res = await syncInvoice(req(), params)
      const body = await res.json()

      expect(body.alreadyInSync).toBe(true)
      expect(activateAdminInvoiceAccounts).not.toHaveBeenCalled()
    })
  })

  describe('refuses non-open→paid transitions (manual review required)', () => {
    it('returns 409 when Stripe says void but DB says open', async () => {
      stripeMock.invoices.retrieve.mockResolvedValue({
        id: 'in_stripe_123',
        status: 'void',
      })

      const res = await syncInvoice(req(), params)
      const body = await res.json()

      expect(res.status).toBe(409)
      expect(body.dbStatus).toBe('open')
      expect(body.stripeStatus).toBe('void')
      expect(activateAdminInvoiceAccounts).not.toHaveBeenCalled()
    })

    it('returns 409 when DB says paid but Stripe says uncollectible (refund-like)', async () => {
      state.invoice = { ...openInvoice, status: 'paid' }
      stripeMock.invoices.retrieve.mockResolvedValue({
        id: 'in_stripe_123',
        status: 'uncollectible',
      })

      const res = await syncInvoice(req(), params)
      expect(res.status).toBe(409)
      expect(activateAdminInvoiceAccounts).not.toHaveBeenCalled()
    })

    it('REGRESSION: NEVER flips paid→anything via sync (only open→paid)', async () => {
      state.invoice = { ...openInvoice, status: 'paid' }
      stripeMock.invoices.retrieve.mockResolvedValue({
        id: 'in_stripe_123',
        status: 'open', // weird — should not be possible but test anyway
      })

      const res = await syncInvoice(req(), params)
      expect(res.status).toBe(409)
      expect(activateAdminInvoiceAccounts).not.toHaveBeenCalled()
    })
  })

  describe('error handling', () => {
    it('returns 502 when Stripe retrieve fails', async () => {
      stripeMock.invoices.retrieve.mockRejectedValue(new Error('Stripe timeout'))

      const res = await syncInvoice(req(), params)
      expect(res.status).toBe(502)
    })

    it('returns 400 when invoice has no stripe_invoice_id', async () => {
      state.invoice = { ...openInvoice, stripe_invoice_id: null }

      const res = await syncInvoice(req(), params)
      expect(res.status).toBe(400)
    })

    it('returns 422 when activation metadata is missing', async () => {
      state.invoice = {
        ...openInvoice,
        duration_days: null,
        session_limit_minutes: null,
      }
      stripeMock.invoices.retrieve.mockResolvedValue({
        id: 'in_stripe_123',
        status: 'paid',
        metadata: {},
      })

      const res = await syncInvoice(req(), params)
      expect(res.status).toBe(422)
      expect(activateAdminInvoiceAccounts).not.toHaveBeenCalled()
    })
  })

  describe('partial activation failure', () => {
    it('returns success=false but still logs the partial result', async () => {
      stripeMock.invoices.retrieve.mockResolvedValue({
        id: 'in_stripe_123',
        status: 'paid',
        metadata: { duration_days: '30', session_limit_minutes: '120' },
      })
      ;(activateAdminInvoiceAccounts as jest.Mock).mockResolvedValueOnce({
        targets: ['a@x.org', 'b@x.org'],
        newlyActivated: [{ email: 'a@x.org', userId: 'uid_a' }],
        failures: [{ email: 'b@x.org', error: new Error('auth flaky') }],
        previouslyActivated: [],
        fullyActivated: false,
        isBulk: true,
      })

      const res = await syncInvoice(req(), params)
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.success).toBe(false)
      expect(body.newlyActivated).toEqual(['a@x.org'])
      expect(body.failed).toEqual([{ email: 'b@x.org', error: 'auth flaky' }])
    })
  })
})
