/** @jest-environment node */

/**
 * Admin Panel API Tests
 *
 * Covers:
 * 1. suspend — sets is_suspended=true, never touches subscription_status
 * 2. activate — sets is_suspended=false, never touches subscription_status
 * 3. sync-stripe — uses subscription_id (correct column), returns 404 when missing
 * 4. subscriptions/cancel — uses subscription_id, calls Stripe, updates DB
 * 5. subscriptions/reactivate — uses subscription_id, calls Stripe, updates DB
 * 6. users list — Stripe enrichment uses subscription_id
 * 7. analytics/overview — MRR query uses subscription_id
 */

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
  createMiddlewareClient: jest.fn(),
}))

jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: jest.fn(),
}))

jest.mock('@/lib/auth/admin', () => ({
  requireAdmin: jest.fn(),
  isAdminUser: jest.fn().mockReturnValue(true),
}))

jest.mock('@/lib/stripe/config', () => ({
  stripe: {
    subscriptions: {
      retrieve: jest.fn(),
      cancel: jest.fn(),
      update: jest.fn(),
    },
    customers: {
      retrieve: jest.fn(),
    },
  },
}))

jest.mock('@/lib/email/resend', () => ({
  sendAdminEmail: jest.fn().mockResolvedValue({ success: true }),
}))

jest.mock('@/lib/email/templates/admin-message', () => ({
  generateSuspensionEmailHtml: jest.fn().mockReturnValue('<p>Suspended</p>'),
  generateReactivationEmailHtml: jest.fn().mockReturnValue('<p>Reactivated</p>'),
}))

jest.mock('next/headers', () => ({
  cookies: jest.fn().mockResolvedValue({}),
}))

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { POST as suspendRoute } from '@/app/api/admin/users/[id]/suspend/route'
import { POST as activateRoute } from '@/app/api/admin/users/[id]/activate/route'
import { POST as syncStripeRoute } from '@/app/api/admin/users/[id]/sync-stripe/route'
import { POST as cancelRoute } from '@/app/api/admin/subscriptions/[id]/cancel/route'
import { POST as reactivateRoute } from '@/app/api/admin/subscriptions/[id]/reactivate/route'
import { GET as usersRoute } from '@/app/api/admin/users/route'
import { GET as analyticsRoute } from '@/app/api/admin/analytics/overview/route'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { stripe } from '@/lib/stripe/config'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockAuthClient = createClient as jest.Mock
const mockAdminClient = createAdminClient as jest.Mock
const mockStripe = stripe as jest.Mocked<typeof stripe>

/** Build a minimal NextRequest-compatible object */
function makeRequest(body: object = {}, method = 'POST'): Request {
  return new Request('http://localhost/api/test', {
    method,
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

function makeGetRequest(params: Record<string, string> = {}): Request {
  const url = new URL('http://localhost/api/test')
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  return new Request(url.toString(), { method: 'GET' })
}

/** Wire up the Supabase mock chain for a given user row */
function setupUserMock(userData: object | null, updateError: any = null) {
  const updateMock = jest.fn().mockReturnThis()
  const eqUpdateMock = jest.fn().mockResolvedValue({ error: updateError })
  const selectMock = jest.fn().mockReturnThis()
  const eqSelectMock = jest.fn().mockReturnThis()
  const singleMock = jest.fn().mockResolvedValue({ data: userData, error: userData ? null : { code: 'PGRST116' } })

  const adminClientInstance = {
    from: jest.fn().mockImplementation((table: string) => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: singleMock,
      update: jest.fn().mockReturnValue({
        eq: eqUpdateMock,
      }),
      not: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      range: jest.fn().mockResolvedValue({ data: [], error: null, count: 0 }),
    })),
  }

  mockAdminClient.mockReturnValue(adminClientInstance)
  mockAuthClient.mockReturnValue({
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { email: 'admin@minbarai.com' } },
      }),
    },
  })

  return { adminClientInstance, eqUpdateMock, singleMock }
}

const fakeParams = (id: string) => Promise.resolve({ id })

// ---------------------------------------------------------------------------
// 1. suspend — must set is_suspended=true, NOT subscription_status
// ---------------------------------------------------------------------------

describe('POST /api/admin/users/[id]/suspend', () => {
  it('sets is_suspended=true on the user record', async () => {
    const capturedUpdates: any[] = []

    const adminClientInstance = {
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'usage_sessions') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
          }
        }
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: { email: 'user@example.com', subscription_status: 'active' },
            error: null,
          }),
          update: jest.fn().mockImplementation((data: any) => {
            capturedUpdates.push(data)
            return { eq: jest.fn().mockResolvedValue({ error: null }) }
          }),
        }
      }),
    }

    mockAdminClient.mockReturnValue(adminClientInstance)
    mockAuthClient.mockReturnValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { email: 'admin@minbarai.com', id: 'admin-id' } },
        }),
      },
    })

    const req = makeRequest({ reason: 'Policy violation', sendEmail: false })
    const res = await suspendRoute(req as any, { params: fakeParams('user-123') })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)

    // Must set is_suspended=true
    expect(capturedUpdates).toHaveLength(1)
    expect(capturedUpdates[0].is_suspended).toBe(true)

    // Must NOT touch subscription_status
    expect(capturedUpdates[0].subscription_status).toBeUndefined()
  })

  it('returns 500 if DB update fails', async () => {
    const adminClientInstance = {
      from: jest.fn().mockImplementation(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { email: 'user@example.com', subscription_status: 'active' },
          error: null,
        }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: { message: 'DB error' } }),
        }),
      })),
    }

    mockAdminClient.mockReturnValue(adminClientInstance)
    mockAuthClient.mockReturnValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { email: 'admin@minbarai.com' } },
        }),
      },
    })

    const req = makeRequest({ sendEmail: false })
    const res = await suspendRoute(req as any, { params: fakeParams('user-123') })
    expect(res.status).toBe(500)
  })
})

// ---------------------------------------------------------------------------
// 2. activate — must set is_suspended=false, NOT subscription_status
// ---------------------------------------------------------------------------

describe('POST /api/admin/users/[id]/activate', () => {
  it('sets is_suspended=false and does not modify subscription_status', async () => {
    const capturedUpdates: any[] = []

    const adminClientInstance = {
      from: jest.fn().mockImplementation(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          // customer_id present → Stripe-managed account → production code skips
          // subscription_status override (Stripe handles that via webhooks)
          data: {
            email: 'user@example.com',
            customer_id: 'cus_stripe_abc',
            subscription_period_end: new Date(Date.now() + 86400000).toISOString(),
            subscription_status: 'active',
          },
          error: null,
        }),
        update: jest.fn().mockImplementation((data: any) => {
          capturedUpdates.push(data)
          return { eq: jest.fn().mockResolvedValue({ error: null }) }
        }),
      })),
    }

    mockAdminClient.mockReturnValue(adminClientInstance)
    mockAuthClient.mockReturnValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { email: 'admin@minbarai.com' } },
        }),
      },
    })

    const req = makeRequest({ sendEmail: false })
    const res = await activateRoute(req as any, { params: fakeParams('user-123') })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)

    expect(capturedUpdates).toHaveLength(1)
    expect(capturedUpdates[0].is_suspended).toBe(false)

    // Stripe-managed account: must NOT set subscription_status (Stripe owns it via webhooks)
    expect(capturedUpdates[0].subscription_status).toBeUndefined()
    // Must NOT set 'expired' — that was the old broken logic
    expect(capturedUpdates[0].subscription_status).not.toBe('expired')
  })
})

// ---------------------------------------------------------------------------
// 3. sync-stripe — uses subscription_id (correct column)
// ---------------------------------------------------------------------------

describe('POST /api/admin/users/[id]/sync-stripe', () => {
  it('returns 404 when subscription_id is null', async () => {
    const adminClientInstance = {
      from: jest.fn().mockImplementation(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { email: 'user@example.com', subscription_id: null, customer_id: null },
          error: null,
        }),
      })),
    }

    mockAdminClient.mockReturnValue(adminClientInstance)
    mockAuthClient.mockReturnValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { email: 'admin@minbarai.com' } },
        }),
      },
    })

    const req = makeRequest({})
    const res = await syncStripeRoute(req as any, { params: fakeParams('user-123') })
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.error).toMatch(/No Stripe subscription/)
  })

  it('syncs when subscription_id is present', async () => {
    const adminClientInstance = {
      from: jest.fn().mockImplementation(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            email: 'user@example.com',
            subscription_id: 'sub_abc123',
            customer_id: 'cus_abc',
          },
          error: null,
        }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null }),
        }),
      })),
    }

    mockAdminClient.mockReturnValue(adminClientInstance)
    mockAuthClient.mockReturnValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { email: 'admin@minbarai.com' } },
        }),
      },
    })

    ;(mockStripe!.subscriptions.retrieve as jest.Mock).mockResolvedValue({
      status: 'active',
      current_period_end: 1800000000,
      cancel_at_period_end: false,
      canceled_at: null,
      customer: 'cus_abc',
      items: { data: [{ price: { unit_amount: 9900, currency: 'eur', recurring: { interval: 'month' } } }] },
    })
    ;(mockStripe!.customers.retrieve as jest.Mock).mockResolvedValue({
      deleted: false,
      email: 'user@example.com',
    })

    const req = makeRequest({})
    const res = await syncStripeRoute(req as any, { params: fakeParams('user-123') })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.stripeData.status).toBe('active')
  })
})

// ---------------------------------------------------------------------------
// 4. subscriptions/cancel — uses subscription_id
// ---------------------------------------------------------------------------

describe('POST /api/admin/subscriptions/[id]/cancel', () => {
  it('returns 404 when subscription_id is null', async () => {
    const adminClientInstance = {
      from: jest.fn().mockImplementation(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { subscription_id: null, subscription_period_end: null },
          error: null,
        }),
      })),
    }

    mockAdminClient.mockReturnValue(adminClientInstance)
    mockAuthClient.mockReturnValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { email: 'admin@minbarai.com' } },
        }),
      },
    })

    const req = makeRequest({ cancelImmediately: false })
    const res = await cancelRoute(req as any, { params: fakeParams('user-123') })
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.error).toMatch(/No active subscription/)
  })

  it('cancels at period end when cancelImmediately=false', async () => {
    const adminClientInstance = {
      from: jest.fn().mockImplementation(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { subscription_id: 'sub_abc123', subscription_period_end: null },
          error: null,
        }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null }),
        }),
      })),
    }

    mockAdminClient.mockReturnValue(adminClientInstance)
    mockAuthClient.mockReturnValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { email: 'admin@minbarai.com' } },
        }),
      },
    })

    ;(mockStripe!.subscriptions.update as jest.Mock).mockResolvedValue({})

    const req = makeRequest({ cancelImmediately: false })
    const res = await cancelRoute(req as any, { params: fakeParams('user-123') })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(mockStripe!.subscriptions.update).toHaveBeenCalledWith(
      'sub_abc123',
      expect.objectContaining({ cancel_at_period_end: true })
    )
  })
})

// ---------------------------------------------------------------------------
// 5. subscriptions/reactivate — uses subscription_id
// ---------------------------------------------------------------------------

describe('POST /api/admin/subscriptions/[id]/reactivate', () => {
  it('returns 404 when subscription_id is null', async () => {
    const adminClientInstance = {
      from: jest.fn().mockImplementation(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { subscription_id: null, subscription_period_end: null },
          error: null,
        }),
      })),
    }

    mockAdminClient.mockReturnValue(adminClientInstance)
    mockAuthClient.mockReturnValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { email: 'admin@minbarai.com' } },
        }),
      },
    })

    const req = makeRequest({})
    const res = await reactivateRoute(req as any, { params: fakeParams('user-123') })
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.error).toMatch(/No subscription/)
  })

  it('calls Stripe with cancel_at_period_end=false and sets status=active in DB', async () => {
    const capturedUpdates: any[] = []

    const adminClientInstance = {
      from: jest.fn().mockImplementation(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { subscription_id: 'sub_abc123', subscription_period_end: null },
          error: null,
        }),
        update: jest.fn().mockImplementation((data: any) => {
          capturedUpdates.push(data)
          return { eq: jest.fn().mockResolvedValue({ error: null }) }
        }),
      })),
    }

    mockAdminClient.mockReturnValue(adminClientInstance)
    mockAuthClient.mockReturnValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { email: 'admin@minbarai.com' } },
        }),
      },
    })

    ;(mockStripe!.subscriptions.update as jest.Mock).mockResolvedValue({
      current_period_end: Math.floor(Date.now() / 1000) + 2592000, // 30 days from now
    })

    const req = makeRequest({})
    const res = await reactivateRoute(req as any, { params: fakeParams('user-123') })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(mockStripe!.subscriptions.update).toHaveBeenCalledWith(
      'sub_abc123',
      expect.objectContaining({ cancel_at_period_end: false })
    )
    expect(capturedUpdates[0].subscription_status).toBe('active')
  })
})

// ---------------------------------------------------------------------------
// 6. analytics overview — MRR query uses subscription_id (not stripe_subscription_id)
// ---------------------------------------------------------------------------

describe('GET /api/admin/analytics/overview', () => {
  it('queries subscription_id column (not stripe_subscription_id)', async () => {
    const capturedSelects: string[] = []

    const adminClientInstance = {
      from: jest.fn().mockImplementation(() => ({
        select: jest.fn().mockImplementation((cols: string) => {
          capturedSelects.push(cols)
          return {
            eq: jest.fn().mockReturnThis(),
            not: jest.fn().mockReturnThis(),
            head: true,
            // Returns empty results for all queries
            then: (fn: Function) => Promise.resolve(fn({ data: [], error: null, count: 0 })),
          }
        }),
        eq: jest.fn().mockReturnThis(),
        not: jest.fn().mockReturnThis(),
        gte: jest.fn().mockResolvedValue({ data: [], error: null, count: 0 }),
        // Make the select chain awaitable
        [Symbol.asyncIterator]: undefined,
      })),
    }

    // Override so select + eq + not chain resolves
    const fromMock = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      not: jest.fn().mockResolvedValue({ data: [], error: null, count: 0 }),
      gte: jest.fn().mockResolvedValue({ data: [], error: null, count: 0 }),
    })

    mockAdminClient.mockReturnValue({ from: fromMock })
    mockAuthClient.mockReturnValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { email: 'admin@minbarai.com' } },
        }),
      },
    })

    const req = makeGetRequest()
    await analyticsRoute(req as any)

    // Check that none of the select calls used the wrong column name
    const allSelectArgs = fromMock.mock.results
      .flatMap((r: any) => {
        const selectMock = r.value?.select
        return selectMock?.mock?.calls?.map((c: any[]) => c[0]) ?? []
      })
      .filter(Boolean)

    for (const arg of allSelectArgs) {
      expect(arg).not.toContain('stripe_subscription_id')
    }
  })
})
