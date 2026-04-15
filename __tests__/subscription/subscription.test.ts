/**
 * lib/subscription.ts — unit tests
 *
 * All functions are pure; no mocking needed.
 * Tests cover every status branch used by middleware and the dashboard page.
 */

import {
  isValidSubscriptionStatus,
  isValidForTranslation,
  getSubscriptionStatusMessage,
  requiresSubscriptionAttention,
  isCancelledSubscriptionActive,
  getCancelledSubscriptionTimeRemaining,
  getCancelledSubscriptionEndDate,
  getSessionLimit,
} from '@/lib/subscription'

// ---------------------------------------------------------------------------
// isValidSubscriptionStatus
// ---------------------------------------------------------------------------

describe('isValidSubscriptionStatus', () => {
  it('returns true for active', () => {
    expect(isValidSubscriptionStatus('active')).toBe(true)
  })

  it('returns true for incomplete', () => {
    expect(isValidSubscriptionStatus('incomplete')).toBe(true)
  })

  it('returns true for canceled', () => {
    // canceled is in the valid set — period-end check is separate
    expect(isValidSubscriptionStatus('canceled')).toBe(true)
  })

  it('returns false for past_due', () => {
    expect(isValidSubscriptionStatus('past_due')).toBe(false)
  })

  it('returns false for unpaid', () => {
    expect(isValidSubscriptionStatus('unpaid')).toBe(false)
  })

  it('returns false for incomplete_expired', () => {
    expect(isValidSubscriptionStatus('incomplete_expired')).toBe(false)
  })

  it('returns false for null', () => {
    expect(isValidSubscriptionStatus(null)).toBe(false)
  })

  it('returns false for empty string', () => {
    expect(isValidSubscriptionStatus('')).toBe(false)
  })

  it('returns false for unknown status', () => {
    expect(isValidSubscriptionStatus('trialing')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// isValidForTranslation
// ---------------------------------------------------------------------------

describe('isValidForTranslation', () => {
  it('returns true for active', () => {
    expect(isValidForTranslation('active')).toBe(true)
  })

  it('returns true for null (new user without subscription)', () => {
    expect(isValidForTranslation(null)).toBe(true)
  })

  it('returns false for past_due', () => {
    expect(isValidForTranslation('past_due')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// requiresSubscriptionAttention
// ---------------------------------------------------------------------------

describe('requiresSubscriptionAttention', () => {
  it('flags past_due', () => {
    expect(requiresSubscriptionAttention('past_due')).toBe(true)
  })

  it('flags incomplete', () => {
    expect(requiresSubscriptionAttention('incomplete')).toBe(true)
  })

  it('flags unpaid', () => {
    expect(requiresSubscriptionAttention('unpaid')).toBe(true)
  })

  it('does not flag active', () => {
    expect(requiresSubscriptionAttention('active')).toBe(false)
  })

  it('does not flag null', () => {
    expect(requiresSubscriptionAttention(null)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// isCancelledSubscriptionActive
// ---------------------------------------------------------------------------

describe('isCancelledSubscriptionActive', () => {
  const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // +7 days
  const pastDate   = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() // -7 days

  it('returns true when status is canceled and period_end is in the future', () => {
    expect(isCancelledSubscriptionActive('canceled', futureDate)).toBe(true)
  })

  it('returns false when status is canceled and period_end is in the past', () => {
    expect(isCancelledSubscriptionActive('canceled', pastDate)).toBe(false)
  })

  it('returns false when status is canceled and period_end is null', () => {
    expect(isCancelledSubscriptionActive('canceled', null)).toBe(false)
  })

  it('returns false when status is canceled and period_end is undefined', () => {
    expect(isCancelledSubscriptionActive('canceled', undefined)).toBe(false)
  })

  it('returns false when status is active (wrong status)', () => {
    expect(isCancelledSubscriptionActive('active', futureDate)).toBe(false)
  })

  it('returns false when status is null', () => {
    expect(isCancelledSubscriptionActive(null, futureDate)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// getSubscriptionStatusMessage
// ---------------------------------------------------------------------------

describe('getSubscriptionStatusMessage', () => {
  it('returns active message', () => {
    expect(getSubscriptionStatusMessage('active')).toMatch(/active/i)
  })

  it('returns canceled message mentioning access', () => {
    expect(getSubscriptionStatusMessage('canceled')).toMatch(/access/i)
  })

  it('returns message for null (no subscription)', () => {
    expect(getSubscriptionStatusMessage(null)).toMatch(/no active subscription/i)
  })

  it('returns a string for unknown status', () => {
    expect(typeof getSubscriptionStatusMessage('future_status')).toBe('string')
  })
})

// ---------------------------------------------------------------------------
// getSessionLimit
// ---------------------------------------------------------------------------

describe('getSessionLimit', () => {
  it('returns configured limit for active status', () => {
    expect(getSessionLimit('active', 120)).toBe(120)
  })

  it('defaults to 180 minutes for active with no configured limit', () => {
    expect(getSessionLimit('active', undefined)).toBe(180)
  })

  it('returns 30 minutes for incomplete (payment processing)', () => {
    expect(getSessionLimit('incomplete', 120)).toBe(30)
  })

  it('returns configured limit for canceled (still within period)', () => {
    expect(getSessionLimit('canceled', 120)).toBe(120)
  })

  it('defaults to 180 for null status (new user)', () => {
    expect(getSessionLimit(null, undefined)).toBe(180)
  })

  it('returns 0 for expired/invalid status', () => {
    expect(getSessionLimit('past_due', 120)).toBe(0)
    expect(getSessionLimit('unpaid', 120)).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// getCancelledSubscriptionTimeRemaining — smoke tests (time-dependent)
// ---------------------------------------------------------------------------

describe('getCancelledSubscriptionTimeRemaining', () => {
  it('returns "expired" message for past date', () => {
    const pastDate = new Date(Date.now() - 60 * 1000).toISOString()
    expect(getCancelledSubscriptionTimeRemaining(pastDate)).toMatch(/expired/i)
  })

  it('returns "remaining" for future date', () => {
    const futureDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString()
    expect(getCancelledSubscriptionTimeRemaining(futureDate)).toMatch(/remaining/i)
  })

  it('returns fallback for null', () => {
    expect(typeof getCancelledSubscriptionTimeRemaining(null)).toBe('string')
  })
})
