/**
 * Resend Email Service
 *
 * Core send helper + all transactional email functions (welcome, reminders,
 * billing events). HTML templates for billing events live in
 * lib/email/templates/billing.ts.
 */

import { Resend } from 'resend'
import {
  generatePaymentFailedHtml,
  generatePaymentActionRequiredHtml,
  generateTrialEndingHtml,
  generateSubscriptionCancelledHtml,
  generateRefundNotificationHtml,
  generateDisputeAlertHtml,
  type DisputeAlertOptions,
} from '@/lib/email/templates/billing'

// ---------------------------------------------------------------------------
// Client initialisation
// ---------------------------------------------------------------------------

const resend =
  process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== 'your_resend_api_key'
    ? new Resend(process.env.RESEND_API_KEY)
    : null

const DEFAULT_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'

// ---------------------------------------------------------------------------
// Local helpers
// ---------------------------------------------------------------------------

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

/** Returns the list of admin email addresses from the ADMIN_EMAILS env var. */
function getAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS || ''
  return raw
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean)
}

// ---------------------------------------------------------------------------
// Core send helper
// ---------------------------------------------------------------------------

export async function sendAdminEmail(
  to: string,
  subject: string,
  html: string
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    if (!resend) {
      console.error('[Resend] API key not configured')
      return { success: false, error: 'Email service not configured. Please set RESEND_API_KEY.' }
    }

    console.log('[Resend] Sending email from:', DEFAULT_FROM_EMAIL, 'to:', to)

    const { data, error } = await resend.emails.send({
      from: DEFAULT_FROM_EMAIL,
      to,
      subject,
      html,
    })

    if (error) {
      console.error('[Resend] Error sending email:', error)
      if (error.message?.includes('not verified')) {
        return {
          success: false,
          error:
            'Domain not verified. Set RESEND_FROM_EMAIL=onboarding@resend.dev in .env.local to use test domain, or verify your domain at https://resend.com/domains',
        }
      }
      return { success: false, error: error.message || 'Failed to send email' }
    }

    console.log('[Resend] Email sent successfully:', data?.id)
    return { success: true, id: data?.id }
  } catch (error) {
    console.error('[Resend] Exception sending email:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    }
  }
}

// ---------------------------------------------------------------------------
// Onboarding
// ---------------------------------------------------------------------------

export async function sendWelcomeEmail(
  to: string,
  name?: string
): Promise<{ success: boolean; id?: string; error?: string }> {
  return sendAdminEmail(to, 'Welcome to MinbarAI', generateWelcomeEmailHtml(name))
}

// ---------------------------------------------------------------------------
// Admin / miscellaneous
// ---------------------------------------------------------------------------

export async function sendReminderEmail(
  to: string,
  message: string
): Promise<{ success: boolean; id?: string; error?: string }> {
  return sendAdminEmail(to, 'Reminder from MinbarAI', generateReminderEmailHtml(message))
}

// ---------------------------------------------------------------------------
// Billing events (customer-facing)
// ---------------------------------------------------------------------------

export async function sendPaymentFailedEmail(
  to: string,
  amount: string,
  updatePaymentUrl: string,
  nextRetryDate?: string
): Promise<{ success: boolean; id?: string; error?: string }> {
  const html = generatePaymentFailedHtml({ amount, updatePaymentUrl, nextRetryDate })
  return sendAdminEmail(to, 'Payment Failed — Action Required', html)
}

export async function sendPaymentActionRequiredEmail(
  to: string,
  amount: string,
  invoiceUrl: string
): Promise<{ success: boolean; id?: string; error?: string }> {
  const html = generatePaymentActionRequiredHtml({ amount, invoiceUrl })
  return sendAdminEmail(to, 'Payment Authorization Required', html)
}

export async function sendTrialEndingEmail(
  to: string,
  trialEndDate: string,
  addPaymentUrl: string
): Promise<{ success: boolean; id?: string; error?: string }> {
  const html = generateTrialEndingHtml({ trialEndDate, addPaymentUrl })
  return sendAdminEmail(to, 'Your Free Trial Ends Soon', html)
}

export async function sendSubscriptionCancelledEmail(
  to: string,
  periodEnd: string
): Promise<{ success: boolean; id?: string; error?: string }> {
  const html = generateSubscriptionCancelledHtml({ periodEnd })
  return sendAdminEmail(to, 'Your MinbarAI Subscription Has Been Cancelled', html)
}

export async function sendRefundNotificationEmail(
  to: string,
  amount: string
): Promise<{ success: boolean; id?: string; error?: string }> {
  const html = generateRefundNotificationHtml({ amount })
  return sendAdminEmail(to, 'Refund Issued', html)
}

// ---------------------------------------------------------------------------
// Billing events (admin-facing)
// ---------------------------------------------------------------------------

/** Sends dispute alert to every address in the ADMIN_EMAILS env var. */
export async function sendDisputeAlertEmail(
  opts: DisputeAlertOptions
): Promise<{ success: boolean; errors?: string[] }> {
  const admins = getAdminEmails()
  if (admins.length === 0) {
    console.warn('[Resend] sendDisputeAlertEmail: ADMIN_EMAILS is empty — dispute alert not sent')
    return { success: false, errors: ['ADMIN_EMAILS not configured'] }
  }

  const html = generateDisputeAlertHtml(opts)
  const subject = `⚠ Stripe Dispute — ${opts.amount} (${opts.reason})`

  const results = await Promise.allSettled(
    admins.map((email) => sendAdminEmail(email, subject, html))
  )

  const errors: string[] = []
  for (const result of results) {
    if (result.status === 'rejected') {
      errors.push(String(result.reason))
    } else if (!result.value.success) {
      errors.push(result.value.error || 'Unknown error')
    }
  }

  return { success: errors.length === 0, errors: errors.length > 0 ? errors : undefined }
}

// ---------------------------------------------------------------------------
// HTML template helpers (inline — welcome + reminder)
// ---------------------------------------------------------------------------

function generateWelcomeEmailHtml(name?: string): string {
  const greeting = name ? `Hello ${escapeHtml(name)}` : 'Hello'

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to MinbarAI</title>
  </head>
  <body style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1F2937; background-color: #F9FAFB; margin: 0; padding: 0;">
    <div style="max-width: 600px; margin: 40px auto; background-color: #FFFFFF; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
      <div style="background: linear-gradient(135deg, #0D1B20 0%, #1A2E35 50%, #2A4047 100%); padding: 40px 30px; text-align: center;">
        <h1 style="color: #FFFFFF; font-size: 32px; font-weight: 600; margin: 0;">MinbarAI</h1>
        <p style="color: #55a39a; font-size: 16px; margin: 10px 0 0 0;">Live Khutba Captioning and Translation</p>
      </div>
      <div style="padding: 40px 30px;">
        <h2 style="color: #0D1B20; font-size: 24px; font-weight: 600; margin: 0 0 20px 0;">${greeting}!</h2>
        <p style="color: #4B5563; font-size: 16px; margin: 0 0 20px 0;">Welcome to MinbarAI. We're excited to have you on board!</p>
        <p style="color: #4B5563; font-size: 16px; margin: 0 0 20px 0;">Our platform provides real-time captioning and translation for Khutba sermons, making Islamic teachings more accessible to everyone.</p>
        <p style="color: #4B5563; font-size: 16px; margin: 0 0 30px 0;">If you have any questions or need assistance, please don't hesitate to reach out to our support team.</p>
        <div style="text-align: center;">
          <a href="https://minbarai.com/dashboard" style="display: inline-block; background-color: #55a39a; color: #FFFFFF; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 500;">Get Started</a>
        </div>
      </div>
      <div style="background-color: #F9FAFB; padding: 30px; text-align: center; border-top: 1px solid #E5E7EB;">
        <p style="color: #6B7280; font-size: 14px; margin: 0;">© 2026 MinbarAI. All rights reserved.</p>
      </div>
    </div>
  </body>
</html>`
}

function generateReminderEmailHtml(message: string): string {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reminder from MinbarAI</title>
  </head>
  <body style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1F2937; background-color: #F9FAFB; margin: 0; padding: 0;">
    <div style="max-width: 600px; margin: 40px auto; background-color: #FFFFFF; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
      <div style="background: linear-gradient(135deg, #0D1B20 0%, #1A2E35 50%, #2A4047 100%); padding: 40px 30px; text-align: center;">
        <h1 style="color: #FFFFFF; font-size: 32px; font-weight: 600; margin: 0;">MinbarAI</h1>
        <p style="color: #55a39a; font-size: 16px; margin: 10px 0 0 0;">Reminder</p>
      </div>
      <div style="padding: 40px 30px;">
        <h2 style="color: #0D1B20; font-size: 24px; font-weight: 600; margin: 0 0 20px 0;">You have a reminder</h2>
        <div style="background-color: #F9FAFB; border-left: 4px solid #55a39a; padding: 20px; margin: 0 0 30px 0;">
          <p style="color: #4B5563; font-size: 16px; margin: 0; white-space: pre-wrap;">${escapeHtml(message)}</p>
        </div>
        <div style="text-align: center;">
          <a href="https://minbarai.com/dashboard" style="display: inline-block; background-color: #55a39a; color: #FFFFFF; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 500;">Go to Dashboard</a>
        </div>
      </div>
      <div style="background-color: #F9FAFB; padding: 30px; text-align: center; border-top: 1px solid #E5E7EB;">
        <p style="color: #6B7280; font-size: 14px; margin: 0;">© 2026 MinbarAI. All rights reserved.</p>
      </div>
    </div>
  </body>
</html>`
}
