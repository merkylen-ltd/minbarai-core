/**
 * @jest-environment node
 *
 * middleware.ts — unit tests
 *
 * Tests the routing decision logic for every protection tier:
 *   - /admin  — requires auth + admin email
 *   - /dashboard — requires auth + valid subscription
 *   - /subscribe — subscribed users are redirected to /dashboard
 *   - /auth/*  — authenticated users are redirected away
 *
 * Strategy: mock createMiddlewareClient and isAdminUser; construct real
 * NextRequest objects so the URL/pathname parsing is exercised for real.
 */

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetUser   = jest.fn()
const mockFrom      = jest.fn()
const mockSelect    = jest.fn()
const mockEq        = jest.fn()
const mockSingle    = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  createMiddlewareClient: () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  }),
}))

jest.mock('@/lib/auth/security-headers', () => ({
  securityHeadersMiddleware: (_req: unknown, res: unknown) => res,
}))

jest.mock('@/lib/auth/admin', () => ({
  isAdminUser: (email?: string | null) => email === 'admin@minbarai.com',
}))

// Wire from().select().eq().single()
mockFrom.mockReturnValue({ select: mockSelect })
mockSelect.mockReturnValue({ eq: mockEq })
mockEq.mockReturnValue({ single: mockSingle })

import { NextRequest, NextResponse } from 'next/server'
import { middleware } from '@/middleware'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(path: string): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`)
}

function unauthenticated() {
  mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
}

function authenticatedAs(email: string, userData: object | null = null) {
  mockGetUser.mockResolvedValue({ data: { user: { id: 'uid-1', email } }, error: null })
  if (userData !== null) {
    mockSingle.mockResolvedValue({ data: userData, error: null })
  } else {
    mockSingle.mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
  }
}

function getRedirectTarget(response: NextResponse): string | null {
  return response.headers.get('location')
}

// ---------------------------------------------------------------------------
// /admin routes
// ---------------------------------------------------------------------------

describe('middleware — /admin', () => {
  afterEach(() => jest.clearAllMocks())

  it('passes /admin/api/health/status with no auth check', async () => {
    unauthenticated()
    const res = await middleware(makeRequest('/admin/api/health/status'))
    // Should not redirect — health check is public
    expect(getRedirectTarget(res)).toBeNull()
  })

  it('redirects unauthenticated user to signin', async () => {
    unauthenticated()
    const res = await middleware(makeRequest('/admin'))
    expect(getRedirectTarget(res)).toMatch('/auth/signin')
  })

  it('redirects non-admin authenticated user to dashboard', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1', email: 'user@example.com' } }, error: null })
    const res = await middleware(makeRequest('/admin'))
    expect(getRedirectTarget(res)).toMatch('/dashboard')
  })

  it('allows admin user through', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1', email: 'admin@minbarai.com' } }, error: null })
    const res = await middleware(makeRequest('/admin'))
    expect(getRedirectTarget(res)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// /dashboard routes
// ---------------------------------------------------------------------------

describe('middleware — /dashboard', () => {
  afterEach(() => jest.clearAllMocks())

  it('redirects unauthenticated user to signin', async () => {
    unauthenticated()
    const res = await middleware(makeRequest('/dashboard'))
    expect(getRedirectTarget(res)).toMatch('/auth/signin')
  })

  it('redirects authenticated user with no DB row to subscribe', async () => {
    authenticatedAs('user@example.com', null)
    const res = await middleware(makeRequest('/dashboard'))
    expect(getRedirectTarget(res)).toMatch('/subscribe')
  })

  it('redirects suspended user to /auth/suspended', async () => {
    authenticatedAs('user@example.com', {
      subscription_status: 'active',
      subscription_period_end: null,
      is_suspended: true,
    })
    const res = await middleware(makeRequest('/dashboard'))
    expect(getRedirectTarget(res)).toMatch('/auth/suspended')
  })

  it('redirects user with canceled+expired subscription to subscribe', async () => {
    const pastDate = new Date(Date.now() - 7 * 86_400_000).toISOString()
    authenticatedAs('user@example.com', {
      subscription_status: 'canceled',
      subscription_period_end: pastDate,
      is_suspended: false,
    })
    const res = await middleware(makeRequest('/dashboard'))
    expect(getRedirectTarget(res)).toMatch('/subscribe')
  })

  it('redirects user with null subscription status to subscribe', async () => {
    authenticatedAs('user@example.com', {
      subscription_status: null,
      subscription_period_end: null,
      is_suspended: false,
    })
    const res = await middleware(makeRequest('/dashboard'))
    expect(getRedirectTarget(res)).toMatch('/subscribe')
  })

  it('allows user with active subscription through', async () => {
    authenticatedAs('user@example.com', {
      subscription_status: 'active',
      subscription_period_end: null,
      is_suspended: false,
    })
    const res = await middleware(makeRequest('/dashboard'))
    expect(getRedirectTarget(res)).toBeNull()
  })

  it('allows user with incomplete subscription through (payment processing)', async () => {
    authenticatedAs('user@example.com', {
      subscription_status: 'incomplete',
      subscription_period_end: null,
      is_suspended: false,
    })
    const res = await middleware(makeRequest('/dashboard'))
    expect(getRedirectTarget(res)).toBeNull()
  })

  it('allows user with canceled+still-active subscription through', async () => {
    const futureDate = new Date(Date.now() + 7 * 86_400_000).toISOString()
    authenticatedAs('user@example.com', {
      subscription_status: 'canceled',
      subscription_period_end: futureDate,
      is_suspended: false,
    })
    const res = await middleware(makeRequest('/dashboard'))
    expect(getRedirectTarget(res)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// /subscribe routes
// ---------------------------------------------------------------------------

describe('middleware — /subscribe', () => {
  afterEach(() => jest.clearAllMocks())

  it('does not redirect unauthenticated visitor — show pricing page', async () => {
    unauthenticated()
    const res = await middleware(makeRequest('/subscribe'))
    expect(getRedirectTarget(res)).toBeNull()
  })

  it('redirects authenticated user with active subscription to /dashboard', async () => {
    authenticatedAs('user@example.com', {
      subscription_status: 'active',
      subscription_period_end: null,
      is_suspended: false,
    })
    const res = await middleware(makeRequest('/subscribe'))
    expect(getRedirectTarget(res)).toMatch('/dashboard')
  })

  it('does NOT redirect authenticated user with expired canceled subscription (would loop)', async () => {
    const pastDate = new Date(Date.now() - 7 * 86_400_000).toISOString()
    authenticatedAs('user@example.com', {
      subscription_status: 'canceled',
      subscription_period_end: pastDate,
      is_suspended: false,
    })
    const res = await middleware(makeRequest('/subscribe'))
    // Must NOT redirect to /dashboard — that would create a loop with dashboard→subscribe
    // Correct behaviour: pass through (null location = no redirect)
    expect(getRedirectTarget(res)).toBeNull()
  })

  it('does NOT redirect authenticated user with no subscription row', async () => {
    authenticatedAs('user@example.com', null)
    const res = await middleware(makeRequest('/subscribe'))
    expect(getRedirectTarget(res)).toBeNull()
  })

  it('redirects suspended user to /auth/suspended', async () => {
    authenticatedAs('user@example.com', {
      subscription_status: 'active',
      subscription_period_end: null,
      is_suspended: true,
    })
    const res = await middleware(makeRequest('/subscribe'))
    expect(getRedirectTarget(res)).toMatch('/auth/suspended')
  })
})

// ---------------------------------------------------------------------------
// /auth/* routes (authenticated users redirected away)
// ---------------------------------------------------------------------------

describe('middleware — /auth/*', () => {
  afterEach(() => jest.clearAllMocks())

  it('allows unauthenticated user to view sign-in page', async () => {
    unauthenticated()
    const res = await middleware(makeRequest('/auth/signin'))
    expect(getRedirectTarget(res)).toBeNull()
  })

  it('redirects authenticated user with active subscription to /dashboard', async () => {
    authenticatedAs('user@example.com', {
      subscription_status: 'active',
      subscription_period_end: null,
      is_suspended: false,
    })
    const res = await middleware(makeRequest('/auth/signin'))
    expect(getRedirectTarget(res)).toMatch('/dashboard')
  })

  it('redirects authenticated user with no subscription to /subscribe', async () => {
    authenticatedAs('user@example.com', null)
    const res = await middleware(makeRequest('/auth/signin'))
    expect(getRedirectTarget(res)).toMatch('/subscribe')
  })

  it('allows auth callback with ?message param through', async () => {
    authenticatedAs('user@example.com', {
      subscription_status: 'active',
      subscription_period_end: null,
      is_suspended: false,
    })
    const res = await middleware(makeRequest('/auth/callback?message=hello'))
    // message param present → don't redirect
    expect(getRedirectTarget(res)).toBeNull()
  })
})
