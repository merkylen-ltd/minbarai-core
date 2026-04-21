/**
 * Admin Invoice Notification Email.
 *
 * Sent via Resend alongside Stripe's own invoice email so customers always
 * receive a payment link regardless of Stripe Dashboard settings. Uses the
 * shared brand building blocks from _common.ts — consistent with welcome,
 * subscription confirmation, and all other MinbarAI transactional emails.
 */

import {
  escapeHtml,
  headerStandard,
  footer,
  ctaButton,
  wrap,
  formatAmount,
  COLOR_PRIMARY_900,
  COLOR_ACCENT,
  COLOR_NEUTRAL_600,
  COLOR_NEUTRAL_400,
  COLOR_NEUTRAL_50,
  COLOR_NEUTRAL_200,
} from './_common'

export interface AdminInvoiceNotificationParams {
  organizationName?: string
  /** Amount in cents (post-discount — the final amount due). */
  amount: number
  currency: string
  description: string
  dueDate: string
  invoiceUrl: string
  recipientEmail: string
}

export function adminInvoiceNotificationEmail(params: AdminInvoiceNotificationParams) {
  const org = params.organizationName || 'Valued Partner'
  const amount = formatAmount(params.amount, params.currency)

  const innerHtml = `
    ${headerStandard('Your Invoice is Ready', `Payment due ${escapeHtml(params.dueDate)}`)}

    <div style="padding: 48px 40px;">
      <h2 style="color: ${COLOR_PRIMARY_900}; font-size: 22px; font-weight: 600; margin: 0 0 18px 0;">
        Hello ${escapeHtml(org)} 👋
      </h2>

      <p style="color: ${COLOR_NEUTRAL_600}; font-size: 15px; line-height: 1.7; margin: 0 0 28px 0;">
        Your MinbarAI invoice has been prepared and is ready for payment. Review the details below and complete payment securely through Stripe using the button at the bottom of this email.
      </p>

      <!-- Amount callout -->
      <div style="background: linear-gradient(135deg, ${COLOR_ACCENT}15 0%, ${COLOR_ACCENT}08 100%); border-left: 4px solid ${COLOR_ACCENT}; padding: 24px; border-radius: 8px; margin: 0 0 28px 0;">
        <p style="color: ${COLOR_NEUTRAL_400}; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px; margin: 0 0 8px 0;">Amount Due</p>
        <p style="color: ${COLOR_PRIMARY_900}; font-size: 38px; font-weight: 700; margin: 0; letter-spacing: -0.5px;">
          ${escapeHtml(amount)}
        </p>
      </div>

      <!-- Details table -->
      <table style="width: 100%; border-collapse: collapse; margin: 0 0 28px 0;">
        <tbody>
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid ${COLOR_NEUTRAL_200}; color: ${COLOR_NEUTRAL_400}; font-size: 13px; width: 40%;">Description</td>
            <td style="padding: 12px 0; border-bottom: 1px solid ${COLOR_NEUTRAL_200}; color: ${COLOR_PRIMARY_900}; font-size: 14px; font-weight: 500;">
              ${escapeHtml(params.description)}
            </td>
          </tr>
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid ${COLOR_NEUTRAL_200}; color: ${COLOR_NEUTRAL_400}; font-size: 13px;">Currency</td>
            <td style="padding: 12px 0; border-bottom: 1px solid ${COLOR_NEUTRAL_200}; color: ${COLOR_PRIMARY_900}; font-size: 14px; font-weight: 500;">
              ${escapeHtml(params.currency.toUpperCase())}
            </td>
          </tr>
          <tr>
            <td style="padding: 12px 0; color: ${COLOR_NEUTRAL_400}; font-size: 13px;">Due Date</td>
            <td style="padding: 12px 0; color: ${COLOR_PRIMARY_900}; font-size: 14px; font-weight: 500;">
              ${escapeHtml(params.dueDate)}
            </td>
          </tr>
        </tbody>
      </table>

      ${ctaButton(params.invoiceUrl, 'View & Pay Invoice')}

      <p style="color: ${COLOR_NEUTRAL_400}; font-size: 13px; line-height: 1.6; text-align: center; margin: 24px 0 0 0;">
        You'll be taken to a secure Stripe payment page.<br>
        No MinbarAI login required to pay.
      </p>

      <div style="background-color: ${COLOR_NEUTRAL_50}; padding: 20px; border-radius: 8px; margin-top: 32px;">
        <p style="color: ${COLOR_NEUTRAL_600}; font-size: 13px; margin: 0 0 4px 0;">
          <strong>Questions about this invoice?</strong>
        </p>
        <p style="color: ${COLOR_NEUTRAL_400}; font-size: 13px; margin: 0;">
          📧 <a href="mailto:support@minbarai.com" style="color: ${COLOR_ACCENT}; text-decoration: none;">support@minbarai.com</a>
        </p>
      </div>

      <p style="color: ${COLOR_NEUTRAL_400}; font-size: 13px; line-height: 1.6; margin: 28px 0 0 0;">
        Thank you for partnering with MinbarAI.<br>
        <span style="color: ${COLOR_NEUTRAL_600};">The MinbarAI Team</span>
      </p>
    </div>

    ${footer()}
  `

  return {
    subject: `Invoice from MinbarAI — ${amount} due ${params.dueDate}`,
    html: wrap(innerHtml),
  }
}
