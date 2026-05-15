/** @jest-environment node */

/**
 * Tests for lib/email/templates/admin-invoice-notification.ts
 *
 * Email template bugs are user-visible money bugs — wrong amount, broken
 * payment link, stale subject line. Lock in: amount formats match the shared
 * `formatAmount` helper, subject contains payable amount, payment URL is
 * embedded (not broken), and shared brand blocks are used.
 */

import { adminInvoiceNotificationEmail } from '@/lib/email/templates/admin-invoice-notification'

describe('adminInvoiceNotificationEmail', () => {
  const baseParams = {
    organizationName: 'Oxford Islamic Center',
    amount: 15000, // €150.00
    currency: 'eur',
    description: 'MinbarAI annual license',
    dueDate: '2026-05-01',
    invoiceUrl: 'https://invoice.stripe.com/pay/abc123',
    recipientEmail: 'billing@ox-ic.org',
  }

  it('returns subject with formatted amount + due date', () => {
    const { subject } = adminInvoiceNotificationEmail(baseParams)
    expect(subject).toContain('MinbarAI')
    expect(subject).toContain('€150.00')
    expect(subject).toContain('2026-05-01')
  })

  it('embeds the Stripe hosted payment URL in the HTML (the whole point of this email)', () => {
    const { html } = adminInvoiceNotificationEmail(baseParams)
    expect(html).toContain('https://invoice.stripe.com/pay/abc123')
  })

  it('REGRESSION: uses shared brand header (accent gradient) — not the old inline style', () => {
    const { html } = adminInvoiceNotificationEmail(baseParams)
    // Shared wrap includes the rounded-corner outer table from _common.ts
    expect(html).toContain('border-radius: 12px')
    // Shared header uses the gradient from _common.ts
    expect(html).toContain('linear-gradient(135deg, #0D1B20')
  })

  it('renders amount with euro symbol', () => {
    const { html } = adminInvoiceNotificationEmail({ ...baseParams, currency: 'eur', amount: 12000 })
    expect(html).toContain('€120.00')
  })

  it('renders amount with dollar symbol for USD', () => {
    const { html } = adminInvoiceNotificationEmail({ ...baseParams, currency: 'usd', amount: 5000 })
    expect(html).toContain('$50.00')
  })

  it('renders amount with pound symbol for GBP', () => {
    const { html } = adminInvoiceNotificationEmail({ ...baseParams, currency: 'gbp', amount: 9999 })
    expect(html).toContain('£99.99')
  })

  it('includes the description and currency in the details table', () => {
    const { html } = adminInvoiceNotificationEmail(baseParams)
    expect(html).toContain('MinbarAI annual license')
    expect(html).toContain('EUR')
  })

  it('escapes HTML in organization name (injection safety)', () => {
    const { html } = adminInvoiceNotificationEmail({
      ...baseParams,
      organizationName: '<script>alert(1)</script>Inc',
    })
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('escapes HTML in description', () => {
    const { html } = adminInvoiceNotificationEmail({
      ...baseParams,
      description: '<img src=x onerror=alert(1)>',
    })
    expect(html).not.toContain('<img src=x onerror=alert(1)>')
    expect(html).toContain('&lt;img')
  })

  it('falls back to "Valued Partner" when organization name is missing', () => {
    const { html } = adminInvoiceNotificationEmail({ ...baseParams, organizationName: undefined })
    expect(html).toMatch(/Valued Partner/i)
  })

  it('includes the support email for recipient questions', () => {
    const { html } = adminInvoiceNotificationEmail(baseParams)
    expect(html).toContain('support@minbarai.com')
  })

  it('includes the shared footer with copyright + MinbarAI link', () => {
    const { html } = adminInvoiceNotificationEmail(baseParams)
    expect(html).toContain('© 2026 MinbarAI')
    expect(html).toContain('https://minbarai.com')
  })

  it('renders the CTA button with the correct payment URL', () => {
    const { html } = adminInvoiceNotificationEmail(baseParams)
    expect(html).toMatch(/<a href="https:\/\/invoice\.stripe\.com\/pay\/abc123"[^>]*>[\s\S]*?View &amp; Pay Invoice[\s\S]*?<\/a>/)
  })
})
