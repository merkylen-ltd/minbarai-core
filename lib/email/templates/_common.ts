/**
 * Shared email building blocks used by every MinbarAI transactional email.
 *
 * Extracted so the admin invoice email, auth emails, and billing emails all
 * share the same brand look/feel and drift is impossible. Tweak the header/
 * footer/button once here and every email inherits the change.
 */

export function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }
  return text.replace(/[&<>"']/g, (c) => map[c])
}

// Brand tokens — keep in sync with tailwind config
export const FONT = `font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;`
export const COLOR_PRIMARY_900 = '#0D1B20'
export const COLOR_PRIMARY_800 = '#1A2E35'
export const COLOR_ACCENT = '#55a39a'
export const COLOR_NEUTRAL_600 = '#4B5563'
export const COLOR_NEUTRAL_400 = '#9CA3AF'
export const COLOR_NEUTRAL_50 = '#F9FAFB'
export const COLOR_NEUTRAL_200 = '#E5E7EB'

export function headerStandard(heading: string, subheading?: string): string {
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

export function footer(): string {
  return `
    <div style="background-color: ${COLOR_NEUTRAL_50}; padding: 32px 40px; text-align: center; border-top: 1px solid ${COLOR_NEUTRAL_200};">
      <p style="color: #6B7280; font-size: 13px; margin: 0;">© 2026 MinbarAI. All rights reserved.</p>
      <p style="color: #9CA3AF; font-size: 12px; margin: 8px 0 0 0;">
        <a href="https://minbarai.com" style="color: ${COLOR_ACCENT}; text-decoration: none;">Live Khutba Captioning and Translation</a>
      </p>
    </div>`
}

export function ctaButton(href: string, label: string, color = COLOR_ACCENT): string {
  return `
    <div style="text-align: center; margin-top: 32px;">
      <a href="${escapeHtml(href)}"
         style="display: inline-block; background-color: ${color}; color: #FFFFFF; text-decoration: none;
                padding: 14px 36px; border-radius: 8px; font-size: 15px; font-weight: 600; letter-spacing: 0.5px;">
        ${escapeHtml(label)}
      </a>
    </div>`
}

export function wrap(innerHtml: string): string {
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

/** Format a cents integer as a human currency string: 12500 + 'eur' → '€125.00' */
export function formatAmount(amountCents: number, currency: string): string {
  const symbols: Record<string, string> = { eur: '€', usd: '$', gbp: '£' }
  const lower = currency.toLowerCase()
  const symbol = symbols[lower] ?? ''
  const value = (amountCents / 100).toFixed(2)
  return symbol ? `${symbol}${value}` : `${value} ${currency.toUpperCase()}`
}
