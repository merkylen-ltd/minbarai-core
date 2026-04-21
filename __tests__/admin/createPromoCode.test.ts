/** @jest-environment node */

/**
 * Real integration tests for POST /api/admin/promo-codes.
 *
 * This endpoint creates Stripe coupons + promotion codes that discount invoices.
 * Money impact: if it accepts bad data (e.g. percent_off=150), discounts overflow
 * and merchandise is given away. If Stripe fails mid-flow, the DB row must NOT
 * persist or admins think a coupon works when it does not.
 */

jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }))
jest.mock('@/lib/supabase/admin', () => ({ createAdminClient: jest.fn() }))
jest.mock('@/lib/auth/admin', () => ({ requireAdmin: jest.fn() }))
jest.mock('next/headers', () => ({ cookies: jest.fn().mockResolvedValue({}) }))

jest.mock('stripe', () => {
  const mock = {
    coupons: { create: jest.fn() },
    promotionCodes: { create: jest.fn() },
  }
  const Ctor = jest.fn(() => mock)
  ;(Ctor as unknown as { __mock: typeof mock }).__mock = mock
  return Ctor
})

// eslint-disable-next-line @typescript-eslint/no-require-imports
const StripeImported = require('stripe') as unknown as {
  __mock: {
    coupons: { create: jest.Mock }
    promotionCodes: { create: jest.Mock }
  }
}
const stripeMock = StripeImported.__mock

import { POST as createPromoCode } from '@/app/api/admin/promo-codes/route'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/admin'

type DbState = {
  existingLookup: { data: { id: string } | null; error: unknown }
  insertResult: { data: Record<string, unknown> | null; error: unknown }
  insertCalls: Array<{ table: string; row: Record<string, unknown> }>
}

function makeAdminClient(state: DbState) {
  return {
    from: jest.fn((table: string) => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(async () => state.existingLookup),
        })),
      })),
      insert: jest.fn((row: Record<string, unknown>) => {
        state.insertCalls.push({ table, row })
        return {
          select: jest.fn(() => ({
            single: jest.fn(async () => state.insertResult),
          })),
        }
      }),
    })),
  }
}

function makeAuthClient() {
  return {
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { email: 'admin@minbarai.com' } } }) },
  }
}

function makeRequest(body: Record<string, unknown>) {
  return new Request('http://localhost/api/admin/promo-codes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as unknown as import('next/server').NextRequest
}

describe('POST /api/admin/promo-codes', () => {
  let state: DbState

  beforeEach(() => {
    jest.clearAllMocks()
    state = {
      existingLookup: { data: null, error: null },
      insertResult: { data: { id: 'new_promo_id' }, error: null },
      insertCalls: [],
    }
    ;(createAdminClient as jest.Mock).mockReturnValue(makeAdminClient(state))
    ;(createClient as jest.Mock).mockReturnValue(makeAuthClient())
    ;(requireAdmin as jest.Mock).mockImplementation(() => {})

    stripeMock.coupons.create.mockResolvedValue({ id: 'coupon_stripe_abc' })
    stripeMock.promotionCodes.create.mockResolvedValue({ id: 'promo_stripe_abc' })
  })

  // =========================================================================
  // Required-field validation (the original bug from the user's report)
  // =========================================================================

  describe('required-field validation', () => {
    it('rejects missing code', async () => {
      const res = await createPromoCode(
        makeRequest({ discountType: 'percent_off', percent: 20 }),
      )
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toMatch(/required fields/i)
      expect(stripeMock.coupons.create).not.toHaveBeenCalled()
    })

    it('rejects missing discountType (contract-bug regression test)', async () => {
      // This was THE original bug: frontend sent amountOffCents/percentOff but
      // API required discountType. If the contract drifts again, this fails.
      const res = await createPromoCode(
        makeRequest({ code: 'RAMADAN50', percent: 50 }),
      )
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toMatch(/required fields/i)
    })

    it('accepts the frontend contract: { code, discountType, percent }', async () => {
      const res = await createPromoCode(
        makeRequest({ code: 'RAMADAN50', discountType: 'percent_off', percent: 50 }),
      )
      expect(res.status).toBe(200)
    })

    it('accepts the frontend contract: { code, discountType, amount, currency }', async () => {
      const res = await createPromoCode(
        makeRequest({
          code: 'SAVE20',
          discountType: 'amount_off',
          amount: 20,
          currency: 'eur',
        }),
      )
      expect(res.status).toBe(200)
    })
  })

  // =========================================================================
  // Amount/percent guardrails
  // =========================================================================

  describe('amount_off validation', () => {
    it('rejects amount_off without amount', async () => {
      const res = await createPromoCode(
        makeRequest({ code: 'BAD1', discountType: 'amount_off', currency: 'eur' }),
      )
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toMatch(/amount.*currency/i)
    })

    it('rejects amount_off without currency', async () => {
      const res = await createPromoCode(
        makeRequest({ code: 'BAD2', discountType: 'amount_off', amount: 20 }),
      )
      expect(res.status).toBe(400)
    })

    it('converts decimal amount to integer cents', async () => {
      await createPromoCode(
        makeRequest({
          code: 'DEC',
          discountType: 'amount_off',
          amount: 12.5,
          currency: 'eur',
        }),
      )
      // 12.5 * 100 = 1250 cents
      expect(stripeMock.coupons.create).toHaveBeenCalledWith(
        expect.objectContaining({ amount_off: 1250, currency: 'eur' }),
      )
      const inserted = state.insertCalls.find(c => c.table === 'promo_codes')!
      expect(inserted.row.amount_off_cents).toBe(1250)
    })

    it('lowercases currency code before storing', async () => {
      await createPromoCode(
        makeRequest({
          code: 'UPPER',
          discountType: 'amount_off',
          amount: 10,
          currency: 'EUR', // uppercase input
        }),
      )

      const inserted = state.insertCalls.find(c => c.table === 'promo_codes')!
      expect(inserted.row.currency).toBe('eur')
    })
  })

  describe('percent_off validation', () => {
    it('rejects percent <= 0', async () => {
      const res = await createPromoCode(
        makeRequest({ code: 'ZERO', discountType: 'percent_off', percent: 0 }),
      )
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toMatch(/between 0 and 100/i)
    })

    it('rejects percent > 100', async () => {
      const res = await createPromoCode(
        makeRequest({ code: 'OVER', discountType: 'percent_off', percent: 150 }),
      )
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toMatch(/between 0 and 100/i)
    })

    it('rejects negative percent', async () => {
      const res = await createPromoCode(
        makeRequest({ code: 'NEG', discountType: 'percent_off', percent: -10 }),
      )
      expect(res.status).toBe(400)
    })

    it('accepts boundary value 100 (full discount)', async () => {
      const res = await createPromoCode(
        makeRequest({ code: 'FREE', discountType: 'percent_off', percent: 100 }),
      )
      expect(res.status).toBe(200)
      expect(stripeMock.coupons.create).toHaveBeenCalledWith(
        expect.objectContaining({ percent_off: 100 }),
      )
    })

    it('accepts fractional percent (rounds to 2 decimals)', async () => {
      await createPromoCode(
        makeRequest({ code: 'FRAC', discountType: 'percent_off', percent: 33.333 }),
      )
      // toFixed(2) rounds to 33.33
      expect(stripeMock.coupons.create).toHaveBeenCalledWith(
        expect.objectContaining({ percent_off: 33.33 }),
      )
    })
  })

  // =========================================================================
  // Duplicate protection
  // =========================================================================

  describe('duplicate code protection', () => {
    it('returns 409 when code already exists in DB', async () => {
      state.existingLookup = { data: { id: 'existing_promo' }, error: null }

      const res = await createPromoCode(
        makeRequest({ code: 'RAMADAN50', discountType: 'percent_off', percent: 50 }),
      )

      expect(res.status).toBe(409)
      expect(stripeMock.coupons.create).not.toHaveBeenCalled()
    })

    it('uppercases code before checking for duplicates', async () => {
      state.existingLookup = { data: { id: 'cap_version' }, error: null }

      const res = await createPromoCode(
        makeRequest({ code: 'ramadan50', discountType: 'percent_off', percent: 50 }),
      )

      expect(res.status).toBe(409)
      // Duplicate check should have looked up the uppercased version
    })
  })

  // =========================================================================
  // Expiry timestamp conversion
  // =========================================================================

  describe('expires_at handling', () => {
    it('converts ISO date to Unix seconds for Stripe', async () => {
      await createPromoCode(
        makeRequest({
          code: 'EXP',
          discountType: 'percent_off',
          percent: 10,
          expiresAt: '2026-12-31',
        }),
      )

      const expectedUnix = Math.floor(new Date('2026-12-31').getTime() / 1000)
      expect(stripeMock.promotionCodes.create).toHaveBeenCalledWith(
        expect.objectContaining({ expires_at: expectedUnix }),
      )
    })

    it('omits expires_at when not provided (lifetime coupon)', async () => {
      await createPromoCode(
        makeRequest({ code: 'LIFE', discountType: 'percent_off', percent: 5 }),
      )

      const stripeArgs = stripeMock.promotionCodes.create.mock.calls[0][0]
      expect(stripeArgs.expires_at).toBeUndefined()
    })
  })

  // =========================================================================
  // Max redemptions
  // =========================================================================

  describe('max_redemptions', () => {
    it('passes max_redemptions to both coupon and promotion_code', async () => {
      await createPromoCode(
        makeRequest({
          code: 'LIMITED',
          discountType: 'percent_off',
          percent: 10,
          maxRedemptions: 5,
        }),
      )

      expect(stripeMock.coupons.create).toHaveBeenCalledWith(
        expect.objectContaining({ max_redemptions: 5 }),
      )
      expect(stripeMock.promotionCodes.create).toHaveBeenCalledWith(
        expect.objectContaining({ max_redemptions: 5 }),
      )
    })

    it('omits max_redemptions when falsy (unlimited)', async () => {
      await createPromoCode(
        makeRequest({ code: 'UNLIM', discountType: 'percent_off', percent: 10 }),
      )

      const couponArgs = stripeMock.coupons.create.mock.calls[0][0]
      expect(couponArgs.max_redemptions).toBeUndefined()
    })
  })
})
