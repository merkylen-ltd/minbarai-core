/**
 * Pure aggregation helpers for admin invoice dashboards.
 *
 * Money-path logic lives here (not inline in React) so regressions are caught
 * by unit tests. A bug that, say, sums unpaid invoices or uses pre-discount
 * amount inflates the displayed revenue and can drive wrong business decisions.
 */

export interface InvoiceForStats {
  status: string
  currency: string
  amount_cents: number
  final_amount_cents: number
}

/**
 * Sum revenue across invoices, bucketed by currency.
 *
 * Rules:
 *  - Only invoices with status === 'paid' count. Open/void/uncollectible excluded.
 *  - Uses final_amount_cents (post-promo-discount) — never amount_cents.
 *  - Currency is normalized to uppercase so 'eur' and 'EUR' aggregate together.
 *  - Missing/empty currency is coerced to 'EUR' rather than silently dropped.
 */
export function aggregateRevenueByCurrency(
  invoices: readonly InvoiceForStats[],
): Record<string, number> {
  const result: Record<string, number> = {}
  for (const inv of invoices) {
    if (inv.status !== 'paid') continue
    const currency = (inv.currency || 'eur').toUpperCase()
    result[currency] = (result[currency] || 0) + inv.final_amount_cents
  }
  return result
}

export interface InvoiceCounts {
  total: number
  paid: number
  open: number
  void: number
  uncollectible: number
}

export function countInvoicesByStatus(invoices: readonly InvoiceForStats[]): InvoiceCounts {
  const counts: InvoiceCounts = { total: invoices.length, paid: 0, open: 0, void: 0, uncollectible: 0 }
  for (const inv of invoices) {
    if (inv.status === 'paid') counts.paid++
    else if (inv.status === 'open') counts.open++
    else if (inv.status === 'void') counts.void++
    else if (inv.status === 'uncollectible') counts.uncollectible++
  }
  return counts
}
