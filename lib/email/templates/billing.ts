/**
 * Email Templates — Billing Events
 *
 * Covers: payment failed, 3DS action required, trial ending,
 * refund notification, subscription cancellation, dispute alert (admin).
 *
 * All user-supplied or Stripe-supplied strings are passed through
 * escapeHtml() before interpolation.
 */

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }
  return text.replace(/[&<>"']/g, (c) => map[c])
}

// Shared CSS constants
const FONT = `font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;`
const BRAND_TEAL = '#55a39a'

function header(bgGradient: string, heading: string, subheading: string): string {
  return `
    <div style="background: ${bgGradient}; padding: 40px 30px; text-align: center;">
      <h1 style="color: #FFFFFF; font-size: 28px; font-weight: 600; margin: 0;">${escapeHtml(heading)}</h1>
      <p style="color: rgba(255,255,255,0.8); font-size: 15px; margin: 10px 0 0 0;">${escapeHtml(subheading)}</p>
    </div>`
}

function footer(): string {
  return `
    <div style="background-color: #F9FAFB; padding: 24px 30px; text-align: center; border-top: 1px solid #E5E7EB;">
      <p style="color: #6B7280; font-size: 13px; margin: 0;">© 2026 MinbarAI. All rights reserved.</p>
      <p style="color: #9CA3AF; font-size: 12px; margin: 6px 0 0 0;">Live Khutba Captioning and Translation</p>
    </div>`
}

function ctaButton(href: string, label: string, color = BRAND_TEAL): string {
  return `
    <div style="text-align: center; margin-top: 28px;">
      <a href="${escapeHtml(href)}"
         style="display: inline-block; background-color: ${color}; color: #FFFFFF; text-decoration: none;
                padding: 14px 32px; border-radius: 8px; font-size: 15px; font-weight: 500;">
        ${escapeHtml(label)}
      </a>
    </div>`
}

function wrap(innerHtml: string): string {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
  </head>
  <body style="${FONT} line-height: 1.6; color: #1F2937; background-color: #F9FAFB; margin: 0; padding: 0;">
    <div style="max-width: 600px; margin: 40px auto; background-color: #FFFFFF; border-radius: 12px;
                overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
      ${innerHtml}
    </div>
  </body>
</html>`
}

// ---------------------------------------------------------------------------
// Payment Failed
// ---------------------------------------------------------------------------

export interface PaymentFailedOptions {
  amount: string          // e.g. "€99.00"
  nextRetryDate?: string  // human-readable e.g. "April 20, 2026"
  updatePaymentUrl: string
}

export function generatePaymentFailedHtml(opts: PaymentFailedOptions): string {
  const retryLine = opts.nextRetryDate
    ? `<p style="color: #4B5563; font-size: 15px; margin: 0 0 16px 0;">
         We'll automatically retry the charge on <strong>${escapeHtml(opts.nextRetryDate)}</strong>.
       </p>`
    : `<p style="color: #4B5563; font-size: 15px; margin: 0 0 16px 0;">
         We'll retry the charge automatically in the coming days.
       </p>`

  return wrap(`
    ${header(
      'linear-gradient(135deg, #7F1D1D 0%, #991B1B 50%, #B91C1C 100%)',
      'Payment Failed',
      'MinbarAI — Action Required'
    )}
    <div style="padding: 36px 30px;">
      <p style="color: #4B5563; font-size: 15px; margin: 0 0 16px 0;">
        We were unable to charge <strong>${escapeHtml(opts.amount)}</strong> for your MinbarAI subscription.
        Please update your payment method to avoid any interruption to your service.
      </p>
      ${retryLine}
      <div style="background: #FEF2F2; border-left: 4px solid #DC2626; padding: 16px 20px; border-radius: 4px; margin: 0 0 16px 0;">
        <p style="color: #991B1B; font-size: 14px; margin: 0; font-weight: 500;">
          If payment continues to fail your subscription may be paused.
        </p>
      </div>
      ${ctaButton(opts.updatePaymentUrl, 'Update Payment Method', '#DC2626')}
      <p style="color: #9CA3AF; font-size: 13px; text-align: center; margin-top: 20px;">
        Questions? Email <a href="mailto:support@minbarai.com" style="color: ${BRAND_TEAL};">support@minbarai.com</a>
      </p>
    </div>
    ${footer()}
  `)
}

// ---------------------------------------------------------------------------
// Payment Action Required (3D Secure)
// ---------------------------------------------------------------------------

export interface PaymentActionRequiredOptions {
  amount: string
  invoiceUrl: string
}

export function generatePaymentActionRequiredHtml(opts: PaymentActionRequiredOptions): string {
  return wrap(`
    ${header(
      'linear-gradient(135deg, #78350F 0%, #92400E 50%, #B45309 100%)',
      'Payment Authorization Required',
      'MinbarAI — Complete Your Payment'
    )}
    <div style="padding: 36px 30px;">
      <p style="color: #4B5563; font-size: 15px; margin: 0 0 16px 0;">
        Your bank requires additional verification to process your payment of
        <strong>${escapeHtml(opts.amount)}</strong>.
        This is a standard security step (3D Secure) and only takes a moment.
      </p>
      <div style="background: #FFFBEB; border-left: 4px solid #D97706; padding: 16px 20px; border-radius: 4px; margin: 0 0 16px 0;">
        <p style="color: #92400E; font-size: 14px; margin: 0; font-weight: 500;">
          Your subscription will not activate until this step is completed.
        </p>
      </div>
      ${ctaButton(opts.invoiceUrl, 'Complete Payment', '#D97706')}
      <p style="color: #9CA3AF; font-size: 13px; text-align: center; margin-top: 20px;">
        This link expires in 24 hours. Need help?
        Email <a href="mailto:support@minbarai.com" style="color: ${BRAND_TEAL};">support@minbarai.com</a>
      </p>
    </div>
    ${footer()}
  `)
}

// ---------------------------------------------------------------------------
// Trial Ending
// ---------------------------------------------------------------------------

export interface TrialEndingOptions {
  trialEndDate: string   // human-readable
  addPaymentUrl: string
}

export function generateTrialEndingHtml(opts: TrialEndingOptions): string {
  return wrap(`
    ${header(
      'linear-gradient(135deg, #0D1B20 0%, #1A2E35 50%, #2A4047 100%)',
      'Your Free Trial Ends Soon',
      'MinbarAI'
    )}
    <div style="padding: 36px 30px;">
      <p style="color: #4B5563; font-size: 15px; margin: 0 0 16px 0;">
        Your MinbarAI free trial ends on <strong>${escapeHtml(opts.trialEndDate)}</strong>.
        To keep uninterrupted access to live captioning and translation, add a payment method before your trial ends.
      </p>
      <ul style="color: #4B5563; font-size: 15px; padding-left: 20px; margin: 0 0 20px 0;">
        <li style="margin-bottom: 8px;">Real-time Arabic-to-multilingual translation</li>
        <li style="margin-bottom: 8px;">Unlimited live captioning sessions</li>
        <li style="margin-bottom: 8px;">Focus mode and fullscreen display</li>
      </ul>
      ${ctaButton(opts.addPaymentUrl, 'Add Payment Method')}
      <p style="color: #9CA3AF; font-size: 13px; text-align: center; margin-top: 20px;">
        Questions? Email <a href="mailto:support@minbarai.com" style="color: ${BRAND_TEAL};">support@minbarai.com</a>
      </p>
    </div>
    ${footer()}
  `)
}

// ---------------------------------------------------------------------------
// Subscription Cancelled (voluntary / end of period)
// ---------------------------------------------------------------------------

export interface SubscriptionCancelledOptions {
  periodEnd: string  // human-readable access-until date
}

export function generateSubscriptionCancelledHtml(opts: SubscriptionCancelledOptions): string {
  return wrap(`
    ${header(
      'linear-gradient(135deg, #374151 0%, #4B5563 50%, #6B7280 100%)',
      'Subscription Cancelled',
      'MinbarAI'
    )}
    <div style="padding: 36px 30px;">
      <p style="color: #4B5563; font-size: 15px; margin: 0 0 16px 0;">
        Your MinbarAI subscription has been cancelled as requested.
      </p>
      <div style="background: #F3F4F6; border-left: 4px solid #6B7280; padding: 16px 20px; border-radius: 4px; margin: 0 0 16px 0;">
        <p style="color: #374151; font-size: 14px; margin: 0;">
          You have full access until <strong>${escapeHtml(opts.periodEnd)}</strong>.
          After that date your account will revert to free tier.
        </p>
      </div>
      <p style="color: #4B5563; font-size: 15px; margin: 0 0 20px 0;">
        We're sorry to see you go. If you change your mind you can resubscribe at any time.
      </p>
      ${ctaButton('https://minbarai.com/subscribe', 'Resubscribe')}
      <p style="color: #9CA3AF; font-size: 13px; text-align: center; margin-top: 20px;">
        Feedback or questions? Email <a href="mailto:support@minbarai.com" style="color: ${BRAND_TEAL};">support@minbarai.com</a>
      </p>
    </div>
    ${footer()}
  `)
}

// ---------------------------------------------------------------------------
// Refund Notification (to customer)
// ---------------------------------------------------------------------------

export interface RefundNotificationOptions {
  amount: string  // e.g. "€99.00"
}

export function generateRefundNotificationHtml(opts: RefundNotificationOptions): string {
  return wrap(`
    ${header(
      'linear-gradient(135deg, #064E3B 0%, #065F46 50%, #047857 100%)',
      'Refund Issued',
      'MinbarAI'
    )}
    <div style="padding: 36px 30px;">
      <p style="color: #4B5563; font-size: 15px; margin: 0 0 16px 0;">
        A refund of <strong>${escapeHtml(opts.amount)}</strong> has been issued to your original payment method.
      </p>
      <p style="color: #4B5563; font-size: 15px; margin: 0 0 20px 0;">
        Refunds typically appear within <strong>5–10 business days</strong>, depending on your bank or card issuer.
      </p>
      <p style="color: #9CA3AF; font-size: 13px; text-align: center; margin-top: 20px;">
        Questions about your refund? Email <a href="mailto:support@minbarai.com" style="color: ${BRAND_TEAL};">support@minbarai.com</a>
      </p>
    </div>
    ${footer()}
  `)
}

// ---------------------------------------------------------------------------
// Dispute Alert (to admin)
// ---------------------------------------------------------------------------

export interface DisputeAlertOptions {
  disputeId: string
  chargeId: string
  amount: string
  reason: string
  stripeDashboardUrl?: string
}

export function generateDisputeAlertHtml(opts: DisputeAlertOptions): string {
  const dashboardUrl = opts.stripeDashboardUrl ||
    `https://dashboard.stripe.com/disputes/${encodeURIComponent(opts.disputeId)}`

  return wrap(`
    ${header(
      'linear-gradient(135deg, #7F1D1D 0%, #991B1B 50%, #DC2626 100%)',
      '⚠ Stripe Dispute Opened',
      'MinbarAI Admin Alert'
    )}
    <div style="padding: 36px 30px;">
      <div style="background: #FEF2F2; border: 1px solid #FECACA; border-radius: 8px; padding: 20px; margin: 0 0 20px 0;">
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr>
            <td style="padding: 6px 0; color: #6B7280; width: 140px;">Dispute ID</td>
            <td style="padding: 6px 0; color: #1F2937; font-family: monospace;">${escapeHtml(opts.disputeId)}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #6B7280;">Charge ID</td>
            <td style="padding: 6px 0; color: #1F2937; font-family: monospace;">${escapeHtml(opts.chargeId)}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #6B7280;">Amount</td>
            <td style="padding: 6px 0; color: #1F2937; font-weight: 600;">${escapeHtml(opts.amount)}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #6B7280;">Reason</td>
            <td style="padding: 6px 0; color: #1F2937;">${escapeHtml(opts.reason)}</td>
          </tr>
        </table>
      </div>
      <p style="color: #991B1B; font-size: 14px; font-weight: 500; margin: 0 0 16px 0;">
        You typically have 7–21 days to respond. Evidence must be submitted before the deadline shown in your Stripe dashboard.
      </p>
      ${ctaButton(dashboardUrl, 'View in Stripe Dashboard', '#DC2626')}
    </div>
    ${footer()}
  `)
}
