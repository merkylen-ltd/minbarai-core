/**
 * Resend-backed delivery of the "invoice is ready" email.
 *
 * Stripe's own invoice email (triggered by stripe.invoices.sendInvoice) depends
 * on a Dashboard setting — "Email finalized invoices to customers" — which is
 * easy to have disabled. This module gives us a second, always-on delivery path
 * via Resend that carries the Stripe hosted payment URL, so the customer
 * always receives an email regardless of Stripe Dashboard configuration.
 */

import { sendAdminEmail } from '@/lib/email/resend'
import { adminInvoiceNotificationEmail } from '@/lib/email/templates/admin-invoice-notification'

export interface SendInvoiceEmailParams {
  recipientEmail: string
  organizationName?: string | null
  /** Amount in cents, post-discount. */
  amountCents: number
  currency: string
  description: string
  /** ISO date string or human-formatted due date. */
  dueDate: string
  /** Stripe hosted_invoice_url (the payment link). Required — without it the email cannot lead to payment. */
  invoiceUrl: string
}

export interface SendInvoiceEmailResult {
  success: boolean
  error?: string
}

export async function sendAdminInvoiceEmail(
  params: SendInvoiceEmailParams,
): Promise<SendInvoiceEmailResult> {
  if (!params.invoiceUrl) {
    return { success: false, error: 'Missing invoice URL — cannot send payment email' }
  }
  if (!params.recipientEmail) {
    return { success: false, error: 'Missing recipient email' }
  }

  const { subject, html } = adminInvoiceNotificationEmail({
    organizationName: params.organizationName || undefined,
    amount: params.amountCents,
    currency: params.currency,
    description: params.description,
    dueDate: params.dueDate,
    invoiceUrl: params.invoiceUrl,
    recipientEmail: params.recipientEmail,
  })

  try {
    const result = await sendAdminEmail(params.recipientEmail, subject, html)
    if (!result.success) {
      console.error('[InvoiceEmail] Resend send failed:', result.error)
    }
    return result
  } catch (err) {
    console.error('[InvoiceEmail] Unexpected error sending invoice email:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unexpected email failure',
    }
  }
}
