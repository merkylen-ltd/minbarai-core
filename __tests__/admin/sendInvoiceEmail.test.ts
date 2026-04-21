/** @jest-environment node */

/**
 * Tests for lib/admin/send-invoice-email.ts
 *
 * Thin layer, but it's the money-delivery path. We lock in: (1) templates get
 * the right amount/currency/url, (2) missing URL is rejected hard (no silent
 * success), (3) Resend failures bubble up so the caller can decide.
 */

jest.mock('@/lib/email/resend', () => ({
  sendAdminEmail: jest.fn(async () => ({ success: true })),
}))

import { sendAdminInvoiceEmail } from '@/lib/admin/send-invoice-email'
import { sendAdminEmail } from '@/lib/email/resend'

describe('sendAdminInvoiceEmail', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(sendAdminEmail as jest.Mock).mockResolvedValue({ success: true, id: 'msg_123' })
  })

  const validParams = {
    recipientEmail: 'client@org.com',
    organizationName: 'Client Org',
    amountCents: 12000,
    currency: 'eur',
    description: 'MinbarAI license',
    dueDate: '2026-05-01',
    invoiceUrl: 'https://invoice.stripe.com/test',
  }

  it('renders the invoice template and calls sendAdminEmail', async () => {
    const res = await sendAdminInvoiceEmail(validParams)

    expect(res.success).toBe(true)
    expect(sendAdminEmail).toHaveBeenCalledTimes(1)
    const [to, subject, html] = (sendAdminEmail as jest.Mock).mock.calls[0]
    expect(to).toBe('client@org.com')
    expect(subject).toMatch(/invoice/i)
    // Html must embed the payment URL or the email is useless
    expect(html).toContain('https://invoice.stripe.com/test')
    // And the (post-discount) amount
    expect(html).toContain('120.00')
  })

  it('returns error WITHOUT calling Resend when invoiceUrl is missing', async () => {
    const res = await sendAdminInvoiceEmail({ ...validParams, invoiceUrl: '' })

    expect(res.success).toBe(false)
    expect(res.error).toMatch(/invoice url/i)
    expect(sendAdminEmail).not.toHaveBeenCalled()
  })

  it('returns error WITHOUT calling Resend when recipientEmail is missing', async () => {
    const res = await sendAdminInvoiceEmail({ ...validParams, recipientEmail: '' })

    expect(res.success).toBe(false)
    expect(sendAdminEmail).not.toHaveBeenCalled()
  })

  it('propagates Resend error to caller (not silently swallowed)', async () => {
    ;(sendAdminEmail as jest.Mock).mockResolvedValueOnce({
      success: false,
      error: 'Domain not verified',
    })

    const res = await sendAdminInvoiceEmail(validParams)

    expect(res.success).toBe(false)
    expect(res.error).toMatch(/domain not verified/i)
  })

  it('catches thrown exceptions from Resend and returns structured error', async () => {
    ;(sendAdminEmail as jest.Mock).mockRejectedValueOnce(new Error('network down'))

    const res = await sendAdminInvoiceEmail(validParams)

    expect(res.success).toBe(false)
    expect(res.error).toMatch(/network down/i)
  })

  it('renders the correct currency symbol per currency code', async () => {
    await sendAdminInvoiceEmail({ ...validParams, currency: 'usd', amountCents: 10000 })
    const html1 = (sendAdminEmail as jest.Mock).mock.calls[0][2]
    expect(html1).toContain('$100.00')

    jest.clearAllMocks()
    ;(sendAdminEmail as jest.Mock).mockResolvedValue({ success: true })
    await sendAdminInvoiceEmail({ ...validParams, currency: 'gbp', amountCents: 5000 })
    const html2 = (sendAdminEmail as jest.Mock).mock.calls[0][2]
    expect(html2).toContain('£50.00')
  })

  it('handles null organizationName (falls back to generic greeting)', async () => {
    const res = await sendAdminInvoiceEmail({ ...validParams, organizationName: null })

    expect(res.success).toBe(true)
    const html = (sendAdminEmail as jest.Mock).mock.calls[0][2]
    expect(html).toMatch(/valued partner/i) // template fallback
  })
})
