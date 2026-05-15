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
import {
  generateWelcomeEmailHtml,
  generateSubscriptionActivatedEmailHtml,
  generateUsageReminderEmailHtml,
  generateAdminMessageEmailHtml,
  generatePasswordResetEmailHtml,
  type WelcomeEmailOptions,
  type SubscriptionActivatedOptions,
  type UsageReminderOptions,
  type AdminMessageOptions,
  type PasswordResetOptions,
} from '@/lib/email/templates/auth'

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
  opts?: WelcomeEmailOptions | string
): Promise<{ success: boolean; id?: string; error?: string }> {
  // Support legacy string argument (firstName)
  const options: WelcomeEmailOptions = typeof opts === 'string' ? { firstName: opts } : opts || {}
  return sendAdminEmail(to, 'Welcome to MinbarAI', generateWelcomeEmailHtml(options))
}

export async function sendSubscriptionActivatedEmail(
  to: string,
  opts?: SubscriptionActivatedOptions
): Promise<{ success: boolean; id?: string; error?: string }> {
  return sendAdminEmail(to, 'Your MinbarAI Subscription is Active ✓', generateSubscriptionActivatedEmailHtml(opts))
}

export async function sendPasswordResetEmail(
  to: string,
  resetLink: string
): Promise<{ success: boolean; id?: string; error?: string }> {
  const opts: PasswordResetOptions = { resetLink }
  return sendAdminEmail(to, 'Reset Your MinbarAI Password', generatePasswordResetEmailHtml(opts))
}

// ---------------------------------------------------------------------------
// Admin / Notifications
// ---------------------------------------------------------------------------

export async function sendAdminMessageEmail(
  to: string,
  opts: AdminMessageOptions
): Promise<{ success: boolean; id?: string; error?: string }> {
  const subject = opts.subject || 'Message from MinbarAI'
  return sendAdminEmail(to, subject, generateAdminMessageEmailHtml(opts))
}

export async function sendUsageReminderEmail(
  to: string,
  opts?: UsageReminderOptions
): Promise<{ success: boolean; id?: string; error?: string }> {
  return sendAdminEmail(to, 'Session Time Remaining', generateUsageReminderEmailHtml(opts))
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


