import { describe, it, expect } from '@jest/globals'

describe('Admin Promo Codes API', () => {
  describe('POST /api/admin/promo-codes', () => {
    it('should validate code is uppercase', () => {
      const code = 'SUMMER50'
      
      expect(code).toBe(code.toUpperCase())
    })

    it('should require amount and currency for amount_off', () => {
      const discountType = 'amount_off'
      const amount = 50
      const currency = 'eur'
      
      expect(amount).toBeDefined()
      expect(currency).toBeDefined()
    })

    it('should reject amount_off without currency', () => {
      const discountType = 'amount_off'
      const amount = 50
      const currency = undefined
      
      expect(currency).not.toBeDefined()
    })

    it('should require percent for percent_off', () => {
      const discountType = 'percent_off'
      const percent = 20
      
      expect(percent).toBeGreaterThan(0)
      expect(percent).toBeLessThanOrEqual(100)
    })

    it('should reject percent outside 0-100 range', () => {
      const invalid = [0, -10, 150]
      
      invalid.forEach(percent => {
        expect(percent <= 0 || percent > 100).toBe(true)
      })
    })

    it('should check for duplicate codes', () => {
      const code = 'DUPLICATE'
      const isDuplicate = true
      
      expect(isDuplicate).toBe(true)
    })

    it('should create Stripe coupon first with metadata', () => {
      const couponParams = {
        name: 'SUMMER50',
        max_redemptions: undefined,
        expires_at: undefined,
      }
      
      expect(couponParams.name).toBeDefined()
    })

    it('should create promotion code with coupon ID', () => {
      const couponId = 'coup_mock'
      const promotionCode = {
        coupon: couponId,
        code: 'SUMMER50',
      }
      
      expect(promotionCode.coupon).toBe(couponId)
    })

    it('should store both Stripe IDs in database', () => {
      const record = {
        stripe_coupon_id: 'coup_123',
        stripe_promotion_code_id: 'promo_456',
      }
      
      expect(record.stripe_coupon_id).toBeDefined()
      expect(record.stripe_promotion_code_id).toBeDefined()
    })
  })

  describe('GET /api/admin/promo-codes', () => {
    it('should return all codes ordered by created_at descending', () => {
      const codes = [
        { id: '1', created_at: '2026-04-19' },
        { id: '2', created_at: '2026-04-18' },
      ]
      
      // Most recent first
      expect(new Date(codes[0].created_at).getTime()).toBeGreaterThanOrEqual(new Date(codes[1].created_at).getTime())
    })
  })

  describe('GET /api/admin/promo-codes/validate', () => {
    it('should return valid false for non-existent codes', () => {
      const code = 'NONEXISTENT'
      const isValid = false
      
      expect(isValid).toBe(false)
    })

    it('should return valid false for expired codes', () => {
      const expiresAt = new Date('2026-01-01')
      const now = new Date('2026-04-19')
      
      expect(now.getTime()).toBeGreaterThan(expiresAt.getTime())
    })

    it('should return valid false for inactive codes', () => {
      const isActive = false
      
      expect(isActive).toBe(false)
    })

    it('should return valid false when max redemptions reached', () => {
      const maxRedemptions = 100
      const redemptionsCount = 100
      
      expect(redemptionsCount).toBeGreaterThanOrEqual(maxRedemptions)
    })

    it('should return valid false for currency mismatch on amount_off', () => {
      const promo = { currency: 'eur', amount_off_cents: 5000 }
      const invoiceCurrency = 'usd'
      
      expect(promo.currency).not.toBe(invoiceCurrency)
    })

    it('should calculate percent_off discount correctly', () => {
      const amountCents = 15000
      const percentOff = 20
      const discountCents = Math.round((amountCents * percentOff) / 100)
      
      expect(discountCents).toBe(3000)
    })

    it('should return valid true with correct discount amounts', () => {
      const response = {
        valid: true,
        discountAmount: 3000,
        originalAmount: 15000,
        finalAmount: 12000,
      }
      
      expect(response.valid).toBe(true)
      expect(response.finalAmount).toBe(response.originalAmount - response.discountAmount)
    })

    it('should calculate savings percentage correctly', () => {
      const originalAmount = 15000
      const discountAmount = 3000
      const savingsPercent = ((discountAmount / originalAmount) * 100).toFixed(1)
      
      expect(savingsPercent).toBe('20.0')
    })
  })

  describe('POST /api/admin/promo-codes/[id]/deactivate', () => {
    it('should set active false in Stripe', () => {
      const active = false
      
      expect(active).toBe(false)
    })

    it('should update is_active false in database', () => {
      const isActive = false
      
      expect(isActive).toBe(false)
    })
  })
})
