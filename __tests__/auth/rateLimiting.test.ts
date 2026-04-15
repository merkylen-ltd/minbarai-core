/**
 * lib/auth/rate-limiting.ts + lib/auth/account-lockout.ts — unit tests
 *
 * Both modules call createAdminClient() which is mocked here.
 * Key behaviours verified:
 *   - allowed / blocked based on RPC response
 *   - fail-open when DB errors occur (never blocks users)
 *   - lockout detected and reported correctly
 *   - clearFailedAttempts swallows errors silently
 */

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockRpc   = jest.fn()
const mockFrom  = jest.fn()
const mockSelect = jest.fn()
const mockEq    = jest.fn()
const mockMaybeSingle = jest.fn()
const mockDelete = jest.fn()
const mockDeleteEq = jest.fn()

jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    rpc: mockRpc,
    from: mockFrom,
  }),
}))

// Wire the .from(...).select(...).eq(...).maybeSingle() chain
mockFrom.mockReturnValue({ select: mockSelect, delete: mockDelete })
mockSelect.mockReturnValue({ eq: mockEq })
mockEq.mockReturnValue({ maybeSingle: mockMaybeSingle })
mockDelete.mockReturnValue({ eq: mockDeleteEq })
mockDeleteEq.mockResolvedValue({ error: null })

import {
  checkRateLimit,
  RATE_LIMIT_CONFIGS,
} from '@/lib/auth/rate-limiting'

import {
  checkAccountLockout,
  recordFailedAttempt,
  clearFailedAttempts,
  ACCOUNT_LOCKOUT_CONFIGS,
} from '@/lib/auth/account-lockout'

// Helper: build a fake NextRequest-like Request
function fakeRequest(ip = '1.2.3.4'): Request {
  return {
    headers: {
      get: (key: string) => {
        if (key === 'x-forwarded-for') return ip
        return null
      },
    },
  } as unknown as Request
}

// ---------------------------------------------------------------------------
// checkRateLimit
// ---------------------------------------------------------------------------

describe('checkRateLimit', () => {
  afterEach(() => jest.clearAllMocks())

  it('allows request when RPC says not locked and under limit', async () => {
    mockRpc.mockResolvedValueOnce({
      data: [{ cur_attempts: 2, is_locked: false, locked_until: null, reset_at: new Date(Date.now() + 900_000).toISOString() }],
      error: null,
    })

    const result = await checkRateLimit(fakeRequest(), RATE_LIMIT_CONFIGS.AUTH)

    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(3) // maxAttempts(5) - cur_attempts(2)
  })

  it('blocks request when RPC says locked', async () => {
    const lockedUntil = new Date(Date.now() + 300_000).toISOString() // 5 min from now
    mockRpc.mockResolvedValueOnce({
      data: [{ cur_attempts: 5, is_locked: true, locked_until: lockedUntil, reset_at: lockedUntil }],
      error: null,
    })

    const result = await checkRateLimit(fakeRequest(), RATE_LIMIT_CONFIGS.AUTH)

    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
    expect(result.retryAfter).toBeGreaterThan(0)
  })

  it('fails open when RPC returns an error', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'DB down' } })

    const result = await checkRateLimit(fakeRequest(), RATE_LIMIT_CONFIGS.AUTH)

    expect(result.allowed).toBe(true)
  })

  it('fails open when RPC throws', async () => {
    mockRpc.mockRejectedValueOnce(new Error('network timeout'))

    const result = await checkRateLimit(fakeRequest(), RATE_LIMIT_CONFIGS.AUTH)

    expect(result.allowed).toBe(true)
  })

  it('fails open when RPC returns empty data array', async () => {
    mockRpc.mockResolvedValueOnce({ data: [], error: null })

    const result = await checkRateLimit(fakeRequest(), RATE_LIMIT_CONFIGS.AUTH)

    expect(result.allowed).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// checkAccountLockout
// ---------------------------------------------------------------------------

describe('checkAccountLockout', () => {
  afterEach(() => jest.clearAllMocks())

  it('returns not-locked when no record exists', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null })

    const result = await checkAccountLockout('user@example.com', ACCOUNT_LOCKOUT_CONFIGS.STANDARD)

    expect(result.isLocked).toBe(false)
    expect(result.remainingAttempts).toBe(ACCOUNT_LOCKOUT_CONFIGS.STANDARD.maxAttempts)
  })

  it('returns locked when locked_until is in the future', async () => {
    const lockedUntil = new Date(Date.now() + 300_000).toISOString()
    mockMaybeSingle.mockResolvedValueOnce({
      data: {
        attempts: 5,
        locked_until: lockedUntil,
        window_start: new Date(Date.now() - 1_000).toISOString(),
      },
      error: null,
    })

    const result = await checkAccountLockout('user@example.com', ACCOUNT_LOCKOUT_CONFIGS.STANDARD)

    expect(result.isLocked).toBe(true)
    expect(result.remainingAttempts).toBe(0)
    expect(result.retryAfter).toBeGreaterThan(0)
  })

  it('returns not-locked when lock and window have both expired', async () => {
    const pastDate = new Date(Date.now() - 3_600_000).toISOString() // 1 hour ago
    mockMaybeSingle.mockResolvedValueOnce({
      data: {
        attempts: 5,
        locked_until: pastDate,
        window_start: pastDate,
      },
      error: null,
    })

    const result = await checkAccountLockout('user@example.com', ACCOUNT_LOCKOUT_CONFIGS.STANDARD)

    expect(result.isLocked).toBe(false)
  })

  it('fails open when DB throws', async () => {
    mockMaybeSingle.mockRejectedValueOnce(new Error('timeout'))

    const result = await checkAccountLockout('user@example.com', ACCOUNT_LOCKOUT_CONFIGS.STANDARD)

    expect(result.isLocked).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// recordFailedAttempt
// ---------------------------------------------------------------------------

describe('recordFailedAttempt', () => {
  afterEach(() => jest.clearAllMocks())

  it('returns locked result when RPC says locked', async () => {
    const lockedUntil = new Date(Date.now() + 600_000).toISOString()
    mockRpc.mockResolvedValueOnce({
      data: [{ cur_attempts: 5, is_locked: true, locked_until: lockedUntil, reset_at: lockedUntil }],
      error: null,
    })

    const result = await recordFailedAttempt('user@example.com', ACCOUNT_LOCKOUT_CONFIGS.STANDARD)

    expect(result.isLocked).toBe(true)
    expect(result.remainingAttempts).toBe(0)
  })

  it('returns remaining attempts when not yet locked', async () => {
    mockRpc.mockResolvedValueOnce({
      data: [{ cur_attempts: 3, is_locked: false, locked_until: null, reset_at: new Date(Date.now() + 900_000).toISOString() }],
      error: null,
    })

    const result = await recordFailedAttempt('user@example.com', ACCOUNT_LOCKOUT_CONFIGS.STANDARD)

    expect(result.isLocked).toBe(false)
    expect(result.remainingAttempts).toBe(2) // 5 - 3
  })

  it('fails open when RPC errors', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'DB error' } })

    const result = await recordFailedAttempt('user@example.com', ACCOUNT_LOCKOUT_CONFIGS.STANDARD)

    expect(result.isLocked).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// clearFailedAttempts
// ---------------------------------------------------------------------------

describe('clearFailedAttempts', () => {
  afterEach(() => jest.clearAllMocks())

  it('calls delete with the correct key and does not throw', async () => {
    mockDeleteEq.mockResolvedValueOnce({ error: null })

    await expect(clearFailedAttempts('user@example.com')).resolves.toBeUndefined()
    expect(mockFrom).toHaveBeenCalledWith('auth_rate_limits')
  })

  it('swallows errors silently — never throws', async () => {
    mockDeleteEq.mockRejectedValueOnce(new Error('DB unavailable'))

    await expect(clearFailedAttempts('user@example.com')).resolves.toBeUndefined()
  })
})
