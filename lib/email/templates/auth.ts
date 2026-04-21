/**
 * Email Templates — Authentication & Onboarding
 *
 * Covers: welcome, subscription confirmation, and auth-related messages.
 * Shared brand blocks (header/footer/button/wrap) live in _common.ts so all
 * templates in this directory use the same design system.
 */

import {
  escapeHtml,
  headerStandard,
  footer,
  ctaButton,
  wrap,
  COLOR_PRIMARY_900,
  COLOR_ACCENT,
  COLOR_NEUTRAL_600,
  COLOR_NEUTRAL_400,
  COLOR_NEUTRAL_50,
  COLOR_NEUTRAL_200,
} from './_common'

// ---------------------------------------------------------------------------
// Welcome Email
// ---------------------------------------------------------------------------

export interface WelcomeEmailOptions {
  firstName?: string
  dashboardUrl?: string
}

export function generateWelcomeEmailHtml(opts: WelcomeEmailOptions = {}): string {
  const greeting = opts.firstName ? `Hello ${escapeHtml(opts.firstName)}` : 'Welcome'
  const dashboardUrl = opts.dashboardUrl || 'https://minbarai.com/dashboard'

  return wrap(`
    ${headerStandard('Welcome to MinbarAI', 'Real-time Khutba Captioning & Translation')}
    <div style="padding: 48px 40px;">
      <h2 style="color: ${COLOR_PRIMARY_900}; font-size: 24px; font-weight: 600; margin: 0 0 24px 0;">${greeting}! 👋</h2>

      <p style="color: ${COLOR_NEUTRAL_600}; font-size: 15px; line-height: 1.7; margin: 0 0 20px 0;">
        We're thrilled to have you join MinbarAI. Our platform makes Islamic teachings more accessible to everyone through live, accurate captioning and real-time translation.
      </p>

      <div style="background: linear-gradient(135deg, ${COLOR_ACCENT}15 0%, ${COLOR_ACCENT}08 100%); border-left: 4px solid ${COLOR_ACCENT}; padding: 24px; border-radius: 8px; margin: 28px 0;">
        <h3 style="color: ${COLOR_PRIMARY_900}; font-size: 15px; font-weight: 600; margin: 0 0 16px 0;">🎯 Here's what you can do:</h3>
        <ul style="color: ${COLOR_NEUTRAL_600}; font-size: 14px; padding-left: 20px; margin: 0;">
          <li style="margin-bottom: 10px;">Start live captioning sessions instantly</li>
          <li style="margin-bottom: 10px;">Translate Arabic sermons to any language in real-time</li>
          <li style="margin-bottom: 10px;">Adjust playback speed, text size, and display modes</li>
          <li style="margin-bottom: 10px;">Export session transcripts and translations</li>
        </ul>
      </div>

      <p style="color: ${COLOR_NEUTRAL_600}; font-size: 15px; line-height: 1.7; margin: 28px 0 0 0;">
        Your subscription gives you unlimited access to all features. Start your first session whenever you're ready — just click the button below.
      </p>

      ${ctaButton(dashboardUrl, 'Go to Dashboard')}

      <div style="background-color: ${COLOR_NEUTRAL_50}; padding: 20px; border-radius: 8px; margin-top: 32px;">
        <p style="color: ${COLOR_NEUTRAL_400}; font-size: 13px; margin: 0;">
          📧 Need help? Reach out to our support team at
          <a href="mailto:support@minbarai.com" style="color: ${COLOR_ACCENT}; text-decoration: none;">support@minbarai.com</a>
        </p>
      </div>
    </div>
    ${footer()}
  `)
}

// ---------------------------------------------------------------------------
// Subscription Activated / Confirmed
// ---------------------------------------------------------------------------

export interface SubscriptionActivatedOptions {
  firstName?: string
  plan?: string
  endDate?: string
  dashboardUrl?: string
}

export function generateSubscriptionActivatedEmailHtml(opts: SubscriptionActivatedOptions = {}): string {
  const firstName = opts.firstName || 'there'
  const plan = opts.plan || 'Premium'
  const dashboardUrl = opts.dashboardUrl || 'https://minbarai.com/dashboard'

  return wrap(`
    ${headerStandard('Subscription Activated ✓', `You're all set, ${escapeHtml(firstName)}!`)}
    <div style="padding: 48px 40px;">
      <div style="background: linear-gradient(135deg, #10b98115 0%, #10b98108 100%); border-left: 4px solid #10b981; padding: 20px; border-radius: 8px; margin: 0 0 28px 0;">
        <p style="color: #065f46; font-size: 15px; font-weight: 500; margin: 0;">
          ✓ Your ${escapeHtml(plan)} plan is now active
        </p>
      </div>

      <p style="color: ${COLOR_NEUTRAL_600}; font-size: 15px; line-height: 1.7; margin: 0 0 20px 0;">
        Your MinbarAI subscription is confirmed and active. You now have full access to all premium features including:
      </p>

      <ul style="color: ${COLOR_NEUTRAL_600}; font-size: 14px; padding-left: 20px; margin: 0 0 28px 0;">
        <li style="margin-bottom: 10px;"><strong>Unlimited live sessions</strong> — No restrictions on duration or frequency</li>
        <li style="margin-bottom: 10px;"><strong>All languages</strong> — Translate to 100+ languages instantly</li>
        <li style="margin-bottom: 10px;"><strong>Advanced controls</strong> — Custom speed, fonts, display modes</li>
        <li style="margin-bottom: 10px;"><strong>Export transcripts</strong> — Download translations for your records</li>
      </ul>

      ${
        opts.endDate
          ? `<div style="background: ${COLOR_NEUTRAL_50}; padding: 16px; border-radius: 6px; margin: 28px 0;">
              <p style="color: ${COLOR_NEUTRAL_600}; font-size: 13px; margin: 0;">
                <strong>Renewal date:</strong> ${escapeHtml(opts.endDate)}
              </p>
            </div>`
          : ''
      }

      ${ctaButton(dashboardUrl, 'Start Your First Session')}

      <p style="color: ${COLOR_NEUTRAL_400}; font-size: 13px; text-align: center; margin-top: 32px;">
        Questions? Contact us at
        <a href="mailto:support@minbarai.com" style="color: ${COLOR_ACCENT}; text-decoration: none;">support@minbarai.com</a>
      </p>
    </div>
    ${footer()}
  `)
}

// ---------------------------------------------------------------------------
// Usage Reminder / Low Quota
// ---------------------------------------------------------------------------

export interface UsageReminderOptions {
  firstName?: string
  sessionMinutesRemaining?: number
  subscriptionDetailsUrl?: string
}

export function generateUsageReminderEmailHtml(opts: UsageReminderOptions = {}): string {
  const firstName = opts.firstName || 'there'
  const minutes = opts.sessionMinutesRemaining || 30
  const subscriptionUrl = opts.subscriptionDetailsUrl || 'https://minbarai.com/dashboard'

  return wrap(`
    ${headerStandard('Session Time Remaining', 'Keep broadcasting without interruption')}
    <div style="padding: 48px 40px;">
      <p style="color: ${COLOR_NEUTRAL_600}; font-size: 15px; line-height: 1.7; margin: 0 0 20px 0;">
        Hello ${escapeHtml(firstName)},
      </p>

      <div style="background: linear-gradient(135deg, #f5951615 0%, #f5951608 100%); border-left: 4px solid #f59516; padding: 20px; border-radius: 8px; margin: 0 0 28px 0;">
        <p style="color: #78350f; font-size: 15px; font-weight: 500; margin: 0;">
          📢 You have <strong>${minutes} minutes</strong> of session time remaining this cycle.
        </p>
      </div>

      <p style="color: ${COLOR_NEUTRAL_600}; font-size: 15px; line-height: 1.7; margin: 0 0 20px 0;">
        Your current session limit is approaching. To ensure uninterrupted service for your upcoming khutbas and events, consider reviewing your subscription.
      </p>

      <p style="color: ${COLOR_NEUTRAL_600}; font-size: 14px; line-height: 1.6; margin: 0;">
        With a <strong>Premium subscription</strong>, you get unlimited session time — no limits, no surprises.
      </p>

      ${ctaButton(subscriptionUrl, 'View Your Subscription')}

      <p style="color: ${COLOR_NEUTRAL_400}; font-size: 13px; text-align: center; margin-top: 32px;">
        Need a custom plan? Email
        <a href="mailto:support@minbarai.com" style="color: ${COLOR_ACCENT}; text-decoration: none;">support@minbarai.com</a>
      </p>
    </div>
    ${footer()}
  `)
}

// ---------------------------------------------------------------------------
// Generic Admin/Support Message
// ---------------------------------------------------------------------------

export interface AdminMessageOptions {
  firstName?: string
  subject?: string
  message: string
  ctaLabel?: string
  ctaUrl?: string
}

export function generateAdminMessageEmailHtml(opts: AdminMessageOptions): string {
  const firstName = opts.firstName || 'there'
  const subject = opts.subject || 'Message from MinbarAI'

  return wrap(`
    ${headerStandard(subject)}
    <div style="padding: 48px 40px;">
      <p style="color: ${COLOR_NEUTRAL_600}; font-size: 15px; line-height: 1.7; margin: 0 0 24px 0;">
        Hello ${escapeHtml(firstName)},
      </p>

      <div style="background: ${COLOR_NEUTRAL_50}; border-left: 4px solid ${COLOR_ACCENT}; padding: 24px; border-radius: 8px; margin: 0 0 28px 0;">
        <div style="color: ${COLOR_NEUTRAL_600}; font-size: 14px; line-height: 1.7; white-space: pre-wrap; margin: 0;">
          ${escapeHtml(opts.message)}
        </div>
      </div>

      ${
        opts.ctaUrl && opts.ctaLabel
          ? ctaButton(opts.ctaUrl, opts.ctaLabel)
          : ''
      }

      <p style="color: ${COLOR_NEUTRAL_400}; font-size: 13px; text-align: center; margin-top: 32px;">
        Questions or feedback? Reach out to
        <a href="mailto:support@minbarai.com" style="color: ${COLOR_ACCENT}; text-decoration: none;">support@minbarai.com</a>
      </p>
    </div>
    ${footer()}
  `)
}

export interface PasswordResetOptions {
  resetLink?: string
}

export function generatePasswordResetEmailHtml(opts: PasswordResetOptions = {}): string {
  return wrap(`
    ${headerStandard('Reset Your Password', 'Create a new password for your MinbarAI account')}
    <div style="padding: 48px 40px;">
      <p style="color: ${COLOR_NEUTRAL_600}; font-size: 15px; line-height: 1.7; margin: 0 0 24px 0;">
        We received a request to reset the password for your MinbarAI account. Click the button below to create a new password.
      </p>

      <div style="background: linear-gradient(135deg, #f5951615 0%, #f5951608 100%); border-left: 4px solid #f59516; padding: 20px; border-radius: 8px; margin: 0 0 28px 0;">
        <p style="color: #78350f; font-size: 13px; font-weight: 500; margin: 0;">
          ⏱️ This link expires in 24 hours
        </p>
      </div>

      ${
        opts.resetLink
          ? ctaButton(opts.resetLink, 'Reset Password Now', COLOR_ACCENT)
          : ''
      }

      ${
        opts.resetLink
          ? `<div style="background: ${COLOR_NEUTRAL_50}; padding: 20px; border-radius: 8px; margin: 28px 0 0 0;">
              <p style="color: ${COLOR_NEUTRAL_400}; font-size: 12px; margin: 0 0 8px 0;">
                Or copy this link if the button doesn't work:
              </p>
              <p style="color: ${COLOR_ACCENT}; word-break: break-all; font-size: 12px; margin: 0; font-family: 'Courier New', monospace;">
                ${escapeHtml(opts.resetLink)}
              </p>
            </div>`
          : ''
      }

      <p style="color: ${COLOR_NEUTRAL_400}; font-size: 13px; text-align: center; margin-top: 32px; padding-top: 24px; border-top: 1px solid ${COLOR_NEUTRAL_200};">
        Didn't request this? No problem — you can safely ignore this email. Your password won't change unless you complete the reset.
      </p>
    </div>
    ${footer()}
  `)
}
