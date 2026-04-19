/**
 * Email Templates for Admin Messages
 *
 * Generates HTML email templates for messages sent by admins to users:
 * admin messages, account suspension, and reactivation notifications.
 * Consistent with website brand colors and design system.
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

// Shared CSS constants — matches tailwind config
const FONT = `font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;`
const COLOR_PRIMARY_900 = '#0D1B20'
const COLOR_PRIMARY_800 = '#1A2E35'
const COLOR_ACCENT = '#55a39a'
const COLOR_NEUTRAL_600 = '#4B5563'
const COLOR_NEUTRAL_400 = '#9CA3AF'
const COLOR_NEUTRAL_50 = '#F9FAFB'
const COLOR_NEUTRAL_200 = '#E5E7EB'

function headerStandard(heading: string, subheading?: string): string {
  return `
    <div style="background: linear-gradient(135deg, ${COLOR_PRIMARY_900} 0%, ${COLOR_PRIMARY_800} 50%, #2A4047 100%); padding: 48px 40px; text-align: center;">
      <h1 style="color: #FFFFFF; font-size: 32px; font-weight: 600; margin: 0; letter-spacing: -0.5px;">${escapeHtml(heading)}</h1>
      ${
        subheading
          ? `<p style="color: rgba(255,255,255,0.75); font-size: 16px; margin: 14px 0 0 0; line-height: 1.5;">${escapeHtml(subheading)}</p>`
          : ''
      }
    </div>`
}

function headerAlert(heading: string, bgGradient: string): string {
  return `
    <div style="background: ${bgGradient}; padding: 48px 40px; text-align: center;">
      <h1 style="color: #FFFFFF; font-size: 32px; font-weight: 600; margin: 0; letter-spacing: -0.5px;">${escapeHtml(heading)}</h1>
    </div>`
}

function footer(): string {
  return `
    <div style="background-color: ${COLOR_NEUTRAL_50}; padding: 32px 40px; text-align: center; border-top: 1px solid ${COLOR_NEUTRAL_200};">
      <p style="color: #6B7280; font-size: 13px; margin: 0;">© 2026 MinbarAI. All rights reserved.</p>
      <p style="color: #9CA3AF; font-size: 12px; margin: 8px 0 0 0;">
        <a href="https://minbarai.com" style="color: ${COLOR_ACCENT}; text-decoration: none;">Live Khutba Captioning and Translation</a>
      </p>
    </div>`
}

function ctaButton(href: string, label: string, color = COLOR_ACCENT): string {
  return `
    <div style="text-align: center; margin-top: 32px;">
      <a href="${escapeHtml(href)}"
         style="display: inline-block; background-color: ${color}; color: #FFFFFF; text-decoration: none;
                padding: 14px 36px; border-radius: 8px; font-size: 15px; font-weight: 600; letter-spacing: 0.5px;">
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
    <style>
      a { color: ${COLOR_ACCENT}; }
    </style>
  </head>
  <body style="${FONT} line-height: 1.6; color: ${COLOR_NEUTRAL_600}; background-color: ${COLOR_NEUTRAL_50}; margin: 0; padding: 0;">
    <table style="width: 100%; max-width: 600px; margin: 40px auto; background-color: #FFFFFF; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); border-collapse: collapse;">
      <tbody>
        <tr>
          <td style="padding: 0;">
            ${innerHtml}
          </td>
        </tr>
      </tbody>
    </table>
  </body>
</html>`
}

// ---------------------------------------------------------------------------
// Admin Message — Custom message from admin/support
// ---------------------------------------------------------------------------

export function generateAdminMessageHtml(
  subject: string,
  message: string,
  senderName?: string
): string {
  const senderLine = senderName
    ? `Message from ${escapeHtml(senderName)} from MinbarAI Team`
    : 'Message from MinbarAI Team'

  return wrap(`
    ${headerStandard(subject)}
    <div style="padding: 48px 40px;">
      <h2 style="color: ${COLOR_PRIMARY_900}; font-size: 24px; font-weight: 600; margin: 0 0 24px 0;">${escapeHtml(subject)}</h2>

      <div style="background: ${COLOR_NEUTRAL_50}; border-left: 4px solid ${COLOR_ACCENT}; padding: 24px; border-radius: 8px; margin: 0 0 28px 0;">
        <div style="color: ${COLOR_NEUTRAL_600}; font-size: 14px; line-height: 1.7; white-space: pre-wrap; margin: 0;">
          ${escapeHtml(message)}
        </div>
      </div>

      ${ctaButton('https://minbarai.com/dashboard', 'Go to Dashboard')}

      <p style="color: ${COLOR_NEUTRAL_400}; font-size: 13px; text-align: center; margin-top: 32px; padding-top: 24px; border-top: 1px solid ${COLOR_NEUTRAL_200};">
        ${senderLine}
      </p>
    </div>
    ${footer()}
  `)
}

// ---------------------------------------------------------------------------
// Account Suspension
// ---------------------------------------------------------------------------

export function generateSuspensionEmailHtml(reason?: string): string {
  return wrap(`
    ${headerAlert('Account Suspended', 'linear-gradient(135deg, #991B1B 0%, #B91C1C 50%, #DC2626 100%)')}
    <div style="padding: 48px 40px;">
      <p style="color: ${COLOR_NEUTRAL_600}; font-size: 15px; line-height: 1.7; margin: 0 0 24px 0;">
        Your MinbarAI account has been temporarily suspended.
      </p>

      ${
        reason
          ? `<div style="background: #FEF2F2; border-left: 4px solid #DC2626; padding: 24px; border-radius: 8px; margin: 0 0 28px 0;">
              <p style="color: #7F1D1D; font-size: 14px; font-weight: 500; margin: 0 0 8px 0;">Reason:</p>
              <p style="color: ${COLOR_NEUTRAL_600}; font-size: 14px; margin: 0;">
                ${escapeHtml(reason)}
              </p>
            </div>`
          : ''
      }

      <p style="color: ${COLOR_NEUTRAL_600}; font-size: 15px; line-height: 1.7; margin: 0 0 20px 0;">
        If you believe this is a mistake or would like to appeal this decision, please contact our support team immediately.
      </p>

      ${ctaButton('mailto:support@minbarai.com', 'Contact Support', '#DC2626')}

      <p style="color: ${COLOR_NEUTRAL_400}; font-size: 13px; text-align: center; margin-top: 32px; padding-top: 24px; border-top: 1px solid ${COLOR_NEUTRAL_200};">
        We take account security and compliance seriously. Our support team will work with you to resolve this.
      </p>
    </div>
    ${footer()}
  `)
}

// ---------------------------------------------------------------------------
// Account Reactivation
// ---------------------------------------------------------------------------

export function generateReactivationEmailHtml(): string {
  return wrap(`
    ${headerAlert('Welcome Back!', 'linear-gradient(135deg, #047857 0%, #059669 50%, #10B981 100%)')}
    <div style="padding: 48px 40px;">
      <div style="background: #F0FDF4; border-left: 4px solid #10B981; padding: 24px; border-radius: 8px; margin: 0 0 28px 0;">
        <p style="color: #065F46; font-size: 14px; font-weight: 500; margin: 0;">
          ✓ Your account has been reactivated
        </p>
      </div>

      <p style="color: ${COLOR_NEUTRAL_600}; font-size: 15px; line-height: 1.7; margin: 0 0 20px 0;">
        Good news! Your MinbarAI account has been restored and is now fully accessible. You can resume using all features immediately.
      </p>

      <p style="color: ${COLOR_NEUTRAL_600}; font-size: 15px; line-height: 1.7; margin: 0 0 20px 0;">
        Thank you for your patience during the review period.
      </p>

      ${ctaButton('https://minbarai.com/dashboard', 'Go to Dashboard', '#10B981')}

      <p style="color: ${COLOR_NEUTRAL_400}; font-size: 13px; text-align: center; margin-top: 32px;">
        Questions? Contact
        <a href="mailto:support@minbarai.com" style="color: ${COLOR_ACCENT}; text-decoration: none;">support@minbarai.com</a>
      </p>
    </div>
    ${footer()}
  `)
}
