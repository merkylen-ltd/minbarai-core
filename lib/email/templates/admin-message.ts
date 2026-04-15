/**
 * Email Templates for Admin Messages
 * 
 * Generates HTML email templates for messages sent by admins to users.
 */

/**
 * Generate HTML email template for admin-sent message
 * @param subject - Email subject
 * @param message - Message content (plain text, will be escaped)
 * @param senderName - Name of admin sending the message (optional)
 * @returns HTML string for email body
 */
export function generateAdminMessageHtml(
  subject: string,
  message: string,
  senderName?: string
): string {
  // Escape HTML in message to prevent injection
  const escapedMessage = escapeHtml(message)
  const sender = senderName ? `${escapeHtml(senderName)} from ` : ''
  
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${escapeHtml(subject)}</title>
      </head>
      <body style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1F2937; background-color: #F9FAFB; margin: 0; padding: 0;">
        <div style="max-width: 600px; margin: 40px auto; background-color: #FFFFFF; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #0D1B20 0%, #1A2E35 50%, #2A4047 100%); padding: 40px 30px; text-align: center;">
            <h1 style="color: #FFFFFF; font-size: 32px; font-weight: 600; margin: 0;">MinbarAI</h1>
            <p style="color: #55a39a; font-size: 16px; margin: 10px 0 0 0;">Message from ${sender}MinbarAI Team</p>
          </div>
          
          <!-- Content -->
          <div style="padding: 40px 30px;">
            <h2 style="color: #0D1B20; font-size: 24px; font-weight: 600; margin: 0 0 20px 0;">${escapeHtml(subject)}</h2>
            
            <!-- Message Box -->
            <div style="background-color: #F9FAFB; border-left: 4px solid #55a39a; padding: 24px; margin: 0 0 30px 0; border-radius: 4px;">
              <p style="color: #4B5563; font-size: 16px; margin: 0; white-space: pre-wrap;">${escapedMessage}</p>
            </div>
            
            <!-- Call to Action -->
            <div style="text-align: center; margin-top: 30px;">
              <a href="https://minbarai.com/dashboard" style="display: inline-block; background-color: #55a39a; color: #FFFFFF; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 500;">Go to Dashboard</a>
            </div>
            
            <!-- Help Text -->
            <div style="margin-top: 30px; padding-top: 30px; border-top: 1px solid #E5E7EB;">
              <p style="color: #6B7280; font-size: 14px; margin: 0 0 10px 0;">Need help? Have questions?</p>
              <p style="color: #6B7280; font-size: 14px; margin: 0;">Reply to this email or visit our support page.</p>
            </div>
          </div>
          
          <!-- Footer -->
          <div style="background-color: #F9FAFB; padding: 30px; text-align: center; border-top: 1px solid #E5E7EB;">
            <p style="color: #6B7280; font-size: 14px; margin: 0 0 10px 0;">© 2026 MinbarAI. All rights reserved.</p>
            <p style="color: #9CA3AF; font-size: 12px; margin: 0;">Live Khutba Captioning and Translation</p>
          </div>
        </div>
      </body>
    </html>
  `
}

/**
 * Generate HTML email template for account suspension notification
 * @param reason - Reason for suspension (optional)
 * @returns HTML string for email body
 */
export function generateSuspensionEmailHtml(reason?: string): string {
  const reasonText = reason 
    ? `<p style="color: #4B5563; font-size: 16px; margin: 0 0 20px 0;"><strong>Reason:</strong> ${escapeHtml(reason)}</p>`
    : ''
  
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Account Suspended</title>
      </head>
      <body style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1F2937; background-color: #F9FAFB; margin: 0; padding: 0;">
        <div style="max-width: 600px; margin: 40px auto; background-color: #FFFFFF; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <div style="background: linear-gradient(135deg, #991B1B 0%, #B91C1C 50%, #DC2626 100%); padding: 40px 30px; text-align: center;">
            <h1 style="color: #FFFFFF; font-size: 32px; font-weight: 600; margin: 0;">Account Suspended</h1>
          </div>
          <div style="padding: 40px 30px;">
            <p style="color: #4B5563; font-size: 16px; margin: 0 0 20px 0;">Your MinbarAI account has been temporarily suspended.</p>
            ${reasonText}
            <p style="color: #4B5563; font-size: 16px; margin: 0 0 30px 0;">If you believe this is a mistake or would like to appeal this decision, please contact our support team.</p>
            <div style="text-align: center;">
              <a href="mailto:support@minbarai.com" style="display: inline-block; background-color: #55a39a; color: #FFFFFF; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 500;">Contact Support</a>
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
 * Generate HTML email template for account reactivation notification
 * @returns HTML string for email body
 */
export function generateReactivationEmailHtml(): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Account Reactivated</title>
      </head>
      <body style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1F2937; background-color: #F9FAFB; margin: 0; padding: 0;">
        <div style="max-width: 600px; margin: 40px auto; background-color: #FFFFFF; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <div style="background: linear-gradient(135deg, #047857 0%, #059669 50%, #10B981 100%); padding: 40px 30px; text-align: center;">
            <h1 style="color: #FFFFFF; font-size: 32px; font-weight: 600; margin: 0;">Welcome Back!</h1>
          </div>
          <div style="padding: 40px 30px;">
            <p style="color: #4B5563; font-size: 16px; margin: 0 0 20px 0;">Good news! Your MinbarAI account has been reactivated.</p>
            <p style="color: #4B5563; font-size: 16px; margin: 0 0 30px 0;">You can now access all features and services. Thank you for your patience.</p>
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

/**
 * Escape HTML special characters to prevent injection
 * @param text - Text to escape
 * @returns Escaped text
 */
function escapeHtml(text: string): string {
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }
  return text.replace(/[&<>"']/g, (char) => map[char])
}
