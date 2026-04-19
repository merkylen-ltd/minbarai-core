export const adminWelcomeNewUserEmail = (params: {
  organizationName?: string
  email: string
  temporaryPassword: string
  dashboardUrl: string
}) => {
  return {
    subject: `Welcome to MinbarAI – Your Account is Ready`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { border-bottom: 3px solid #55a39a; padding-bottom: 20px; margin-bottom: 30px; }
    .logo { font-size: 24px; font-weight: bold; color: #1a1a1a; }
    .content { margin: 30px 0; }
    .credentials-section { background: #f8f8f8; border-left: 4px solid #55a39a; padding: 20px; margin: 20px 0; font-family: monospace; }
    .credential-row { margin: 12px 0; }
    .credential-label { color: #666; font-size: 12px; text-transform: uppercase; font-weight: bold; }
    .credential-value { background: white; padding: 10px; border-radius: 4px; margin-top: 4px; word-break: break-all; }
    .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; color: #856404; }
    .cta-button { display: inline-block; background: #55a39a; color: white; padding: 12px 30px; border-radius: 4px; text-decoration: none; margin: 20px 0; font-weight: bold; }
    .footer { border-top: 1px solid #ddd; padding-top: 20px; margin-top: 40px; font-size: 12px; color: #999; text-align: center; }
    .step { margin: 20px 0; padding-left: 20px; border-left: 2px solid #55a39a; }
    .step-number { font-weight: bold; color: #55a39a; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">MinbarAI</div>
    </div>

    <div class="content">
      <p>Dear ${params.organizationName || 'Valued Partner'},</p>

      <p>Your MinbarAI account has been successfully created and is ready to use. Below you will find your login credentials and next steps.</p>

      <h3 style="color: #55a39a; margin-top: 30px;">Your Login Credentials</h3>

      <div class="credentials-section">
        <div class="credential-row">
          <div class="credential-label">Email Address</div>
          <div class="credential-value">${params.email}</div>
        </div>
        <div class="credential-row">
          <div class="credential-label">Temporary Password</div>
          <div class="credential-value">${params.temporaryPassword}</div>
        </div>
      </div>

      <div class="warning">
        <strong>⚠️ Important Security Notice</strong><br>
        This temporary password will only work once. Upon first login, you will be required to set a new permanent password of your choice. This password will not be sent to you in any email.
      </div>

      <h3 style="color: #55a39a; margin-top: 30px;">Getting Started</h3>

      <div class="step">
        <span class="step-number">1.</span> Go to your dashboard and log in using the credentials above<br>
        <a href="${params.dashboardUrl}" class="cta-button" style="display: inline-block; margin-top: 10px;">Access Dashboard</a>
      </div>

      <div class="step">
        <span class="step-number">2.</span> You will be prompted to change your password. Create a strong, unique password that you will remember.
      </div>

      <div class="step">
        <span class="step-number">3.</span> Once your password is set, you will have full access to MinbarAI's live translation platform.
      </div>

      <p style="margin-top: 30px; color: #666;">If you encounter any issues logging in or have questions about your account, please contact our support team at <strong>support@minbarai.com</strong></p>

      <p style="margin-top: 20px;">We are excited to have you on board and look forward to helping you break language barriers with MinbarAI.</p>

      <p style="margin-top: 30px; color: #666;">
        Best regards,<br>
        The MinbarAI Team
      </p>
    </div>

    <div class="footer">
      <p>© 2026 MinbarAI. All rights reserved.</p>
      <p>This is an automated message. Please do not reply directly to this email.</p>
    </div>
  </div>
</body>
</html>
    `,
  }
}
