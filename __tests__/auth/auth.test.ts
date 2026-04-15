/** @jest-environment node */

/**
 * Auth API & Utility Tests
 *
 * Covers:
 * 1. POST /api/auth/signup — success (201), duplicate verified email (409),
 *    weak password (400), rate-limited (429)
 * 2. POST /api/auth/signin — success (200), wrong password (401),
 *    account locked out (423)
 * 3. validatePassword utility — strong pass, various failure modes
 * 4. generateSecurePassword — length, complexity, uses crypto not Math.random
 */

// ---------------------------------------------------------------------------
// Mocks (must precede imports)
// ---------------------------------------------------------------------------

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}))

jest.mock('@/lib/auth/rate-limiting', () => ({
  checkRateLimit: jest.fn(),
  getUserRateLimitKey: jest.fn().mockReturnValue('key'),
  RATE_LIMIT_CONFIGS: {
    AUTH: { maxAttempts: 10, windowMs: 900000 },
  },
}))

jest.mock('@/lib/auth/email-validation', () => ({
  sanitizeEmail: jest.fn((e: string) => e.trim().toLowerCase()),
  validateEmailStrict: jest.fn().mockReturnValue({ isValid: true, errors: [] }),
}))

jest.mock('@/lib/auth/account-lockout', () => ({
  checkAccountLockout: jest.fn(),
  recordFailedAttempt: jest.fn(),
  clearFailedAttempts: jest.fn(),
  ACCOUNT_LOCKOUT_CONFIGS: {
    STANDARD: { maxAttempts: 5, lockoutDurationMs: 900000 },
  },
}))

jest.mock('@/lib/auth/secure-logger', () => ({
  authLogger: {
    authSuccess: jest.fn(),
    authFailure: jest.fn(),
    rateLimitExceeded: jest.fn(),
    accountLocked: jest.fn(),
    securityEvent: jest.fn(),
    error: jest.fn(),
  },
}))

jest.mock('next/headers', () => ({
  cookies: jest.fn().mockResolvedValue({}),
}))

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { POST as signupPOST } from '@/app/api/auth/signup/route'
import { POST as signinPOST } from '@/app/api/auth/signin/route'
import { validatePassword, generateSecurePassword } from '@/lib/auth/password-strength'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/auth/rate-limiting'
import { checkAccountLockout, recordFailedAttempt } from '@/lib/auth/account-lockout'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockSupabase = createClient as jest.Mock
const mockCheckRateLimit = checkRateLimit as jest.Mock
const mockCheckLockout = checkAccountLockout as jest.Mock
const mockRecordFailed = recordFailedAttempt as jest.Mock

const ALLOWED_RATE = {
  allowed: true,
  remaining: 9,
  resetTime: Date.now() + 900000,
  retryAfter: undefined,
}

const NOT_LOCKED = {
  isLocked: false,
  remainingAttempts: 5,
  lockoutUntil: undefined,
  retryAfter: undefined,
}

function makeRequest(body: object): Request {
  return new Request('http://localhost/api/auth/test', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

/** Build a Supabase client mock for signup */
function setupSignupMock({
  existingUser = null as object | null,
  signUpResult = {
    data: {
      user: {
        id: 'uuid-1',
        email: 'new@example.com',
        email_confirmed_at: null as string | null,
      },
    },
    error: null as Error | null,
  },
} = {}) {
  const clientInstance = {
    from: jest.fn().mockImplementation(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: existingUser,
        error: existingUser ? null : { code: 'PGRST116', message: 'No rows' },
      }),
    })),
    auth: {
      signUp: jest.fn().mockResolvedValue(signUpResult),
    },
  }
  mockSupabase.mockReturnValue(clientInstance)
  return clientInstance
}

/** Build a Supabase client mock for signin */
function setupSigninMock({
  signInResult = null as any,
  dbUser = { id: 'uuid-1', email: 'user@example.com', subscription_status: 'active' } as any,
} = {}) {
  const clientInstance = {
    from: jest.fn().mockImplementation(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: dbUser, error: null }),
    })),
    auth: {
      signInWithPassword: jest.fn().mockResolvedValue(
        signInResult ?? {
          data: { user: { id: 'uuid-1', email: 'user@example.com' }, session: {} },
          error: null,
        }
      ),
    },
  }
  mockSupabase.mockReturnValue(clientInstance)
  return clientInstance
}

beforeEach(() => {
  jest.clearAllMocks()
  mockCheckRateLimit.mockResolvedValue(ALLOWED_RATE)
  mockCheckLockout.mockResolvedValue(NOT_LOCKED)
  mockRecordFailed.mockResolvedValue(NOT_LOCKED)
})

// ---------------------------------------------------------------------------
// 1. POST /api/auth/signup
// ---------------------------------------------------------------------------

describe('POST /api/auth/signup', () => {
  it('returns 201 for valid new user signup', async () => {
    setupSignupMock()

    const req = makeRequest({
      email: 'new@example.com',
      password: 'SecurePass1!',
      confirmPassword: 'SecurePass1!',
    })
    const res = await signupPOST(req as any)
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.success).toBe(true)
    expect(body.requiresEmailConfirmation).toBe(true)
  })

  it('returns 409 for duplicate verified email', async () => {
    setupSignupMock({
      existingUser: {
        id: 'uuid-existing',
        email: 'existing@example.com',
        email_confirmed_at: '2026-01-01T00:00:00Z',
      },
    })

    const req = makeRequest({
      email: 'existing@example.com',
      password: 'SecurePass1!',
      confirmPassword: 'SecurePass1!',
    })
    const res = await signupPOST(req as any)
    const body = await res.json()

    expect(res.status).toBe(409)
    expect(body.error).toMatch(/already exists/i)
  })

  it('returns 400 for password that fails complexity requirements', async () => {
    // No Supabase mock needed — validation is checked before DB call
    setupSignupMock()

    const req = makeRequest({
      email: 'new@example.com',
      password: 'weakpass',        // no uppercase, no special char
      confirmPassword: 'weakpass',
    })
    const res = await signupPOST(req as any)
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toMatch(/password does not meet requirements/i)
  })

  it('returns 400 when passwords do not match', async () => {
    setupSignupMock()

    const req = makeRequest({
      email: 'new@example.com',
      password: 'SecurePass1!',
      confirmPassword: 'Different1!',
    })
    const res = await signupPOST(req as any)
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toMatch(/do not match/i)
  })

  it('returns 429 when rate-limited', async () => {
    mockCheckRateLimit.mockResolvedValue({
      allowed: false,
      remaining: 0,
      resetTime: Date.now() + 900000,
      retryAfter: 900,
    })

    const req = makeRequest({
      email: 'new@example.com',
      password: 'SecurePass1!',
      confirmPassword: 'SecurePass1!',
    })
    const res = await signupPOST(req as any)

    expect(res.status).toBe(429)
  })

  it('returns 400 for missing fields', async () => {
    setupSignupMock()

    const req = makeRequest({ email: 'x@example.com' })
    const res = await signupPOST(req as any)

    expect(res.status).toBe(400)
  })
})

// ---------------------------------------------------------------------------
// 2. POST /api/auth/signin
// ---------------------------------------------------------------------------

describe('POST /api/auth/signin', () => {
  it('returns 200 with redirectTo /dashboard on success', async () => {
    setupSigninMock()

    const req = makeRequest({ email: 'user@example.com', password: 'SecurePass1!' })
    const res = await signinPOST(req as any)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.redirectTo).toBe('/dashboard')
  })

  it('returns 401 for invalid credentials', async () => {
    setupSigninMock({
      signInResult: {
        data: { user: null, session: null },
        error: { message: 'Invalid login credentials' },
      },
    })

    const req = makeRequest({ email: 'user@example.com', password: 'WrongPass1!' })
    const res = await signinPOST(req as any)
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body.error).toMatch(/invalid email or password/i)
  })

  it('returns 423 when account is already locked before the attempt', async () => {
    mockCheckLockout.mockResolvedValue({
      isLocked: true,
      remainingAttempts: 0,
      lockoutUntil: Date.now() + 900000,
      retryAfter: 900,
    })

    const req = makeRequest({ email: 'locked@example.com', password: 'SecurePass1!' })
    const res = await signinPOST(req as any)
    const body = await res.json()

    expect(res.status).toBe(423)
    expect(body.error).toMatch(/locked/i)
  })

  it('returns 423 when account becomes locked after the 5th bad attempt', async () => {
    setupSigninMock({
      signInResult: {
        data: { user: null, session: null },
        error: { message: 'Invalid login credentials' },
      },
    })
    // recordFailedAttempt returns locked state
    mockRecordFailed.mockResolvedValue({
      isLocked: true,
      remainingAttempts: 0,
      lockoutUntil: Date.now() + 900000,
      retryAfter: 900,
    })

    const req = makeRequest({ email: 'user@example.com', password: 'WrongPass1!' })
    const res = await signinPOST(req as any)
    const body = await res.json()

    expect(res.status).toBe(423)
    expect(body.error).toMatch(/locked/i)
  })

  it('returns 429 when IP rate-limited', async () => {
    mockCheckRateLimit.mockResolvedValue({
      allowed: false,
      remaining: 0,
      resetTime: Date.now() + 900000,
      retryAfter: 900,
    })

    const req = makeRequest({ email: 'user@example.com', password: 'SecurePass1!' })
    const res = await signinPOST(req as any)

    expect(res.status).toBe(429)
  })

  it('returns 400 for missing email', async () => {
    const req = makeRequest({ password: 'SecurePass1!' })
    const res = await signinPOST(req as any)

    expect(res.status).toBe(400)
  })
})

// ---------------------------------------------------------------------------
// 3. validatePassword utility
// ---------------------------------------------------------------------------

describe('validatePassword', () => {
  it('passes a strong password', () => {
    const { isValid, errors } = validatePassword('SecurePass1!')
    expect(isValid).toBe(true)
    expect(errors).toHaveLength(0)
  })

  it('rejects password shorter than 8 chars', () => {
    const { isValid, errors } = validatePassword('Ab1!')
    expect(isValid).toBe(false)
    expect(errors.some(e => /8 characters/i.test(e))).toBe(true)
  })

  it('rejects password with no uppercase letter', () => {
    const { isValid } = validatePassword('securepass1!')
    expect(isValid).toBe(false)
  })

  it('rejects password with no lowercase letter', () => {
    const { isValid } = validatePassword('SECUREPASS1!')
    expect(isValid).toBe(false)
  })

  it('rejects password with no number', () => {
    const { isValid } = validatePassword('SecurePassA!')
    expect(isValid).toBe(false)
  })

  it('rejects password with no special character', () => {
    const { isValid } = validatePassword('SecurePass12')
    expect(isValid).toBe(false)
  })

  it('rejects empty password', () => {
    const { isValid, errors } = validatePassword('')
    expect(isValid).toBe(false)
    expect(errors.some(e => /required/i.test(e))).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 4. generateSecurePassword — must use crypto, not Math.random
// ---------------------------------------------------------------------------

describe('generateSecurePassword', () => {
  it('returns a string of the requested length', () => {
    expect(generateSecurePassword(12)).toHaveLength(12)
    expect(generateSecurePassword(16)).toHaveLength(16)
  })

  it('generated password passes validatePassword', () => {
    for (let i = 0; i < 5; i++) {
      const pwd = generateSecurePassword(12)
      const { isValid } = validatePassword(pwd)
      expect(isValid).toBe(true)
    }
  })

  it('does NOT call Math.random', () => {
    const mathRandomSpy = jest.spyOn(Math, 'random')
    generateSecurePassword(12)
    expect(mathRandomSpy).not.toHaveBeenCalled()
    mathRandomSpy.mockRestore()
  })

  it('calls crypto.getRandomValues', () => {
    const cryptoSpy = jest.spyOn(crypto, 'getRandomValues')
    generateSecurePassword(12)
    expect(cryptoSpy).toHaveBeenCalled()
    cryptoSpy.mockRestore()
  })
})
