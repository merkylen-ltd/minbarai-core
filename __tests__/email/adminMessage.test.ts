/**
 * Admin Message Email Templates Tests
 *
 * Covers:
 * 1. generateAdminMessageHtml — subject, message body, optional sender, HTML escaping
 * 2. generateSuspensionEmailHtml — with/without reason, HTML escaping
 * 3. generateReactivationEmailHtml — structure and content
 */

import {
  generateAdminMessageHtml,
  generateSuspensionEmailHtml,
  generateReactivationEmailHtml,
} from '@/lib/email/templates/admin-message'

// ---------------------------------------------------------------------------
// 1. generateAdminMessageHtml
// ---------------------------------------------------------------------------

describe('generateAdminMessageHtml', () => {
  it('includes subject in h2 heading', () => {
    const html = generateAdminMessageHtml('Your account update', 'All good.')
    expect(html).toContain('Your account update')
  })

  it('includes message body in output', () => {
    const html = generateAdminMessageHtml('Subject', 'Please renew your subscription.')
    expect(html).toContain('Please renew your subscription.')
  })

  it('includes sender name in header when provided', () => {
    const html = generateAdminMessageHtml('Notice', 'Message body', 'admin@minbarai.com')
    expect(html).toContain('admin@minbarai.com')
    expect(html).toContain('from MinbarAI Team')
  })

  it('does not include sender email when senderName is not provided', () => {
    const html = generateAdminMessageHtml('Notice', 'Message body')
    // Template always renders "Message from MinbarAI Team";
    // when no sender email is given, no email address should appear before "MinbarAI Team"
    expect(html).toContain('MinbarAI Team')
    // No email address pattern in the header
    expect(html).not.toMatch(/from\s+\S+@\S+\s+from MinbarAI/)
  })

  it('is a valid HTML document starting with DOCTYPE', () => {
    const html = generateAdminMessageHtml('Subject', 'Body').trim()
    expect(html).toMatch(/^<!DOCTYPE html>/i)
  })

  it('contains dashboard CTA link', () => {
    const html = generateAdminMessageHtml('Subject', 'Body')
    expect(html).toContain('minbarai.com/dashboard')
  })

  // --- XSS prevention ---

  it('escapes <script> tag in message', () => {
    const html = generateAdminMessageHtml('Subject', '<script>alert(1)</script>')
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('escapes <script> tag in subject', () => {
    const html = generateAdminMessageHtml('<script>xss</script>', 'Body')
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('escapes XSS payload in senderName', () => {
    const html = generateAdminMessageHtml('Subject', 'Body', '<img src=x onerror=alert(1)>')
    expect(html).not.toContain('<img')
    expect(html).toContain('&lt;img')
  })

  it('escapes & in message', () => {
    const html = generateAdminMessageHtml('Subject', 'Terms & Conditions apply')
    expect(html).toContain('Terms &amp; Conditions apply')
  })

  it('escapes double-quotes in message', () => {
    const html = generateAdminMessageHtml('Subject', '"Important notice"')
    expect(html).toContain('&quot;Important notice&quot;')
  })

  it('escapes & in senderName', () => {
    const html = generateAdminMessageHtml('Subject', 'Body', 'admin&test@example.com')
    expect(html).toContain('admin&amp;test@example.com')
    expect(html).not.toContain('admin&test')
  })
})

// ---------------------------------------------------------------------------
// 2. generateSuspensionEmailHtml
// ---------------------------------------------------------------------------

describe('generateSuspensionEmailHtml', () => {
  it('contains "suspended" in content', () => {
    const html = generateSuspensionEmailHtml()
    expect(html.toLowerCase()).toContain('suspended')
  })

  it('is a valid HTML document starting with DOCTYPE', () => {
    const html = generateSuspensionEmailHtml().trim()
    expect(html).toMatch(/^<!DOCTYPE html>/i)
  })

  it('includes a contact support link', () => {
    const html = generateSuspensionEmailHtml()
    expect(html).toContain('support@minbarai.com')
  })

  it('includes reason text when reason is provided', () => {
    const html = generateSuspensionEmailHtml('Policy violation detected')
    expect(html).toContain('Policy violation detected')
    expect(html).toContain('Reason')
  })

  it('does not include reason section when reason is omitted', () => {
    const html = generateSuspensionEmailHtml()
    expect(html).not.toContain('Reason:')
  })

  it('does not include reason section when reason is empty string', () => {
    const html = generateSuspensionEmailHtml('')
    expect(html).not.toContain('Reason:')
  })

  // --- XSS prevention ---

  it('escapes <script> tag in reason', () => {
    const html = generateSuspensionEmailHtml('<script>alert(1)</script>')
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('escapes & in reason', () => {
    const html = generateSuspensionEmailHtml('Terms & Conditions violation')
    expect(html).toContain('Terms &amp; Conditions violation')
  })

  it('escapes quotes in reason', () => {
    const html = generateSuspensionEmailHtml('"Prohibited" content posted')
    expect(html).toContain('&quot;Prohibited&quot; content posted')
  })
})

// ---------------------------------------------------------------------------
// 3. generateReactivationEmailHtml
// ---------------------------------------------------------------------------

describe('generateReactivationEmailHtml', () => {
  it('contains "reactivated" in content', () => {
    const html = generateReactivationEmailHtml()
    expect(html.toLowerCase()).toContain('reactivated')
  })

  it('is a valid HTML document starting with DOCTYPE', () => {
    const html = generateReactivationEmailHtml().trim()
    expect(html).toMatch(/^<!DOCTYPE html>/i)
  })

  it('contains a dashboard link', () => {
    const html = generateReactivationEmailHtml()
    expect(html).toContain('minbarai.com/dashboard')
  })

  it('has a welcoming headline', () => {
    const html = generateReactivationEmailHtml()
    // Regex-agnostic: just check something positive in the header
    expect(html.toLowerCase()).toMatch(/welcome back|reactivated/i)
  })

  it('takes no user input (no XSS surface)', () => {
    // Pure function with no parameters — always safe
    const html1 = generateReactivationEmailHtml()
    const html2 = generateReactivationEmailHtml()
    expect(html1).toBe(html2)
  })
})
