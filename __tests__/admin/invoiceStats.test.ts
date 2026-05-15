/** @jest-environment node */

/**
 * Tests for lib/admin/invoice-stats.ts
 *
 * Revenue aggregation is displayed in the admin dashboard. A regression here
 * (e.g. summing open invoices, or using pre-discount amount_cents) inflates
 * the displayed revenue and can drive bad business decisions.
 */

import {
  aggregateRevenueByCurrency,
  countInvoicesByStatus,
  type InvoiceForStats,
} from '@/lib/admin/invoice-stats'

// Fixture helper
const inv = (overrides: Partial<InvoiceForStats> = {}): InvoiceForStats => ({
  status: 'paid',
  currency: 'eur',
  amount_cents: 15000,
  final_amount_cents: 15000,
  ...overrides,
})

describe('aggregateRevenueByCurrency', () => {
  it('returns empty object for empty input', () => {
    expect(aggregateRevenueByCurrency([])).toEqual({})
  })

  it('sums paid invoices for a single currency', () => {
    const result = aggregateRevenueByCurrency([
      inv({ final_amount_cents: 10000 }),
      inv({ final_amount_cents: 5000 }),
      inv({ final_amount_cents: 2500 }),
    ])

    expect(result).toEqual({ EUR: 17500 })
  })

  it('REGRESSION: does NOT include open invoices (primary bug from user report)', () => {
    // User report: "why admin see revenue 150 where the invoice is open and not paid!"
    const result = aggregateRevenueByCurrency([
      inv({ status: 'open', final_amount_cents: 15000 }),
    ])

    expect(result).toEqual({})
  })

  it('REGRESSION: does NOT include void or uncollectible invoices', () => {
    const result = aggregateRevenueByCurrency([
      inv({ status: 'void', final_amount_cents: 20000 }),
      inv({ status: 'uncollectible', final_amount_cents: 30000 }),
      inv({ status: 'paid', final_amount_cents: 5000 }),
    ])

    expect(result).toEqual({ EUR: 5000 })
  })

  it('REGRESSION: uses final_amount_cents (post-discount), NOT amount_cents', () => {
    // User report: "what if the user had promo and applied!!"
    // If we used amount_cents, discounted invoices would be over-reported.
    const result = aggregateRevenueByCurrency([
      inv({
        status: 'paid',
        amount_cents: 15000,       // original
        final_amount_cents: 12000, // after 20% promo
      }),
    ])

    expect(result).toEqual({ EUR: 12000 })
    // Double-check we didn't accidentally pick the bigger number
    expect(result.EUR).not.toBe(15000)
  })

  it('buckets different currencies separately', () => {
    const result = aggregateRevenueByCurrency([
      inv({ currency: 'eur', final_amount_cents: 10000 }),
      inv({ currency: 'usd', final_amount_cents: 20000 }),
      inv({ currency: 'gbp', final_amount_cents: 15000 }),
    ])

    expect(result).toEqual({ EUR: 10000, USD: 20000, GBP: 15000 })
  })

  it('aggregates case-insensitively: eur and EUR combine', () => {
    const result = aggregateRevenueByCurrency([
      inv({ currency: 'eur', final_amount_cents: 5000 }),
      inv({ currency: 'EUR', final_amount_cents: 3000 }),
      inv({ currency: 'Eur', final_amount_cents: 2000 }),
    ])

    expect(result).toEqual({ EUR: 10000 })
  })

  it('handles missing currency by defaulting to EUR (never silently drops money)', () => {
    const result = aggregateRevenueByCurrency([
      inv({ currency: '', final_amount_cents: 5000 }),
    ])

    // Should NOT be {} — that would hide revenue from the admin
    expect(result.EUR).toBe(5000)
  })

  it('multi-currency with mixed statuses', () => {
    const result = aggregateRevenueByCurrency([
      inv({ currency: 'eur', status: 'paid', final_amount_cents: 10000 }),
      inv({ currency: 'eur', status: 'open', final_amount_cents: 99999 }), // excluded
      inv({ currency: 'usd', status: 'paid', final_amount_cents: 20000 }),
      inv({ currency: 'usd', status: 'void', final_amount_cents: 50000 }), // excluded
      inv({ currency: 'gbp', status: 'paid', final_amount_cents: 15000 }),
    ])

    expect(result).toEqual({ EUR: 10000, USD: 20000, GBP: 15000 })
  })

  it('handles fully-discounted (free) invoice: 0 is still aggregated', () => {
    // A €150 invoice with a 100% promo applied ends up final_amount_cents=0
    // but it is still a real "paid" invoice — should be counted as a sale.
    const result = aggregateRevenueByCurrency([
      inv({ status: 'paid', amount_cents: 15000, final_amount_cents: 0 }),
      inv({ status: 'paid', final_amount_cents: 1000 }),
    ])

    expect(result).toEqual({ EUR: 1000 })
  })
})

describe('countInvoicesByStatus', () => {
  it('counts invoices across all statuses', () => {
    const result = countInvoicesByStatus([
      inv({ status: 'paid' }),
      inv({ status: 'paid' }),
      inv({ status: 'open' }),
      inv({ status: 'void' }),
      inv({ status: 'uncollectible' }),
    ])

    expect(result).toEqual({
      total: 5,
      paid: 2,
      open: 1,
      void: 1,
      uncollectible: 1,
    })
  })

  it('handles empty list', () => {
    expect(countInvoicesByStatus([])).toEqual({
      total: 0,
      paid: 0,
      open: 0,
      void: 0,
      uncollectible: 0,
    })
  })

  it('unknown status does not increment any bucket but adds to total', () => {
    const result = countInvoicesByStatus([
      inv({ status: 'draft' }),
      inv({ status: 'paid' }),
    ])

    expect(result.total).toBe(2)
    expect(result.paid).toBe(1)
    expect(result.open).toBe(0)
  })
})
