/**
 * Resend Email Service
 * 
 * Provides email sending functionality using the Resend API.
 * Used for admin-sent messages and password reset emails.
 */

import { Resend } from 'resend'

// Initialize Resend client only if API key is available
const resend = process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== 'your_resend_api_key'
  ? new Resend(process.env.RESEND_API_KEY)
  : null

/**
 * Default from email address
 * Use onboarding@resend.dev for testing if domain not verified
 */
const DEFAULT_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'

/**
 * Send an email from admin to a user
 * @param to - Recipient email address
 * @param subject - Email subject line
 * @param html - HTML email content
 * @returns Resend API response with email ID
 */
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

    // Use the configured FROM email, fallback to test domain if not set
    const fromEmail = DEFAULT_FROM_EMAIL
    console.log('[Resend] Sending email from:', fromEmail, 'to:', to)
    
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to,
      subject,
      html,
    })

    if (error) {
      console.error('[Resend] Error sending email:', error)
      
      // If domain verification error, suggest using test domain
      if (error.message?.includes('not verified')) {
        return { 
          success: false, 
          error: 'Domain not verified. Set RESEND_FROM_EMAIL=onboarding@resend.dev in .env.local to use test domain, or verify your domain at https://resend.com/domains' 
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
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    }
  }
}

/**
 * Send a password reset email
 * Note: This uses Supabase's built-in password reset functionality
 * This function is a placeholder for future custom implementation
 * @param email - User email address
 * @returns Success status
 */
export async function sendPasswordReset(
  email: string
): Promise<{ success: boolean; error?: string }> {
  // This is handled by Supabase auth
  // For now, return a note that this should be done via Supabase API
  return {
    success: false,
    error: 'Password reset should be triggered via Supabase Auth API'
  }
}

/**
 * Send a welcome email to a new user
 * @param to - Recipient email address
 * @param name - User's name (optional)
 * @returns Resend API response
 */
export async function sendWelcomeEmail(
  to: string,
  name?: string
): Promise<{ success: boolean; id?: string; error?: string }> {
  const subject = 'Welcome to MinbarAI'
  const html = generateWelcomeEmailHtml(name)
  return sendAdminEmail(to, subject, html)
}

/**
 * Send a reminder email to a user
 * @param to - Recipient email address
 * @param message - Custom reminder message
 * @returns Resend API response
 */
export async function sendReminderEmail(
  to: string,
  message: string
): Promise<{ success: boolean; id?: string; error?: string }> {
  const subject = 'Reminder from MinbarAI'
  const html = generateReminderEmailHtml(message)
  return sendAdminEmail(to, subject, html)
}

/**
 * Generate HTML for welcome email
 */
function generateWelcomeEmailHtml(name?: string): string {
  const greeting = name ? `Hello ${name}` : 'Hello'
  
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to MinbarAI</title>
      </head>
      <body style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1F2937; background-color: #F9FAFB; margin: 0; padding: 0;">
        <div style="max-width: 600px; margin: 40px auto; background-color: #FFFFFF; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
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
    </html>
  `
}

/**
 * Generate HTML for reminder email
 */
function generateReminderEmailHtml(message: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reminder from MinbarAI</title>
      </head>
      <body style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1F2937; background-color: #F9FAFB; margin: 0; padding: 0;">
        <div style="max-width: 600px; margin: 40px auto; background-color: #FFFFFF; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <div style="background: linear-gradient(135deg, #0D1B20 0%, #1A2E35 50%, #2A4047 100%); padding: 40px 30px; text-align: center;">
            <h1 style="color: #FFFFFF; font-size: 32px; font-weight: 600; margin: 0;">MinbarAI</h1>
            <p style="color: #55a39a; font-size: 16px; margin: 10px 0 0 0;">Reminder</p>
          </div>
          <div style="padding: 40px 30px;">
            <h2 style="color: #0D1B20; font-size: 24px; font-weight: 600; margin: 0 0 20px 0;">You have a reminder</h2>
            <div style="background-color: #F9FAFB; border-left: 4px solid #55a39a; padding: 20px; margin: 0 0 30px 0;">
              <p style="color: #4B5563; font-size: 16px; margin: 0; white-space: pre-wrap;">${message}</p>
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
    </html>
  `
}
