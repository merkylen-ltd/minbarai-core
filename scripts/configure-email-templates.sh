#!/bin/bash

# ================================================================================
#                    MINBERAI EMAIL TEMPLATE CONFIGURATION
# ================================================================================
# This script helps configure custom email templates for MinbarAI in Supabase
# ================================================================================

echo "🚀 MinbarAI Email Template Configuration"
echo "========================================"
echo ""

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI is not installed."
    echo "Please install it first:"
    echo "  npm install -g supabase"
    echo "  or"
    echo "  brew install supabase/tap/supabase"
    echo ""
    exit 1
fi

echo "✅ Supabase CLI found"
echo ""

# Check if user is logged in to Supabase
if ! supabase projects list &> /dev/null; then
    echo "❌ Not logged in to Supabase CLI."
    echo "Please log in first:"
    echo "  supabase login"
    echo ""
    exit 1
fi

echo "✅ Logged in to Supabase"
echo ""

# Get project ID from environment or prompt user
PROJECT_ID="hjsifxofnqbnrgqkbomx"

if [ -z "$PROJECT_ID" ]; then
    echo "Please enter your Supabase project ID:"
    read -p "Project ID: " PROJECT_ID
fi

echo "📧 Configuring email templates for project: $PROJECT_ID"
echo ""

# Create email template configuration
cat > email-config.json << EOF
{
  "confirmation": {
    "subject": "Confirm your MinbarAI account",
    "template": "confirmation-email.html"
  },
  "magic_link": {
    "subject": "Your MinbarAI sign-in link",
    "template": "magic-link-email.html"
  },
  "recovery": {
    "subject": "Reset your MinbarAI password",
    "template": "recovery-email.html"
  },
  "email_change": {
    "subject": "Confirm your new email address",
    "template": "email-change-email.html"
  }
}
EOF

echo "📝 Email template configuration created: email-config.json"
echo ""

# Instructions for manual configuration
echo "🔧 MANUAL CONFIGURATION REQUIRED"
echo "================================"
echo ""
echo "Since Supabase CLI doesn't directly support email template upload,"
echo "you'll need to configure this manually in the Supabase Dashboard:"
echo ""
echo "1. Go to: https://supabase.com/dashboard/project/$PROJECT_ID"
echo "2. Navigate to: Authentication → Email Templates"
echo "3. For each template type, click 'Edit' and:"
echo "   - Copy the HTML content from public/email-templates/"
echo "   - Paste it into the template editor"
echo "   - Update the subject line as needed"
echo ""
echo "📁 Available templates:"
echo "   - confirmation-email.html (Account confirmation)"
echo "   - magic-link-email.html (Magic link sign-in)"
echo "   - recovery-email.html (Password reset)"
echo "   - email-change-email.html (Email change confirmation)"
echo ""
echo "🎨 Template Features:"
echo "   ✅ MinbarAI branding and logo"
echo "   ✅ Website color scheme (#55a39a primary)"
echo "   ✅ Responsive design for mobile"
echo "   ✅ Dark mode support"
echo "   ✅ Professional typography"
echo "   ✅ Security notices"
echo ""

# Create additional email templates
echo "📧 Creating additional email templates..."

# Magic Link Email Template
cat > public/email-templates/magic-link-email.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Your MinbarAI Sign-In Link</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; line-height: 1.6; color: #374151; background-color: #f9fafb; }
        .email-container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
        .email-header { background: linear-gradient(135deg, #0D1B20 0%, #1A2E35 25%, #2A4047 50%, #1A2E35 75%, #0D1B20 100%); padding: 40px 30px; text-align: center; position: relative; }
        .email-header::before { content: ''; position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: linear-gradient(135deg, rgba(85, 163, 154, 0.06) 0%, rgba(5, 10, 12, 0.98) 30%, rgba(8, 15, 18, 0.95) 70%, rgba(15, 26, 30, 0.92) 100%); }
        .logo-container { position: relative; z-index: 1; display: flex; align-items: center; justify-content: center; margin-bottom: 20px; }
        .logo-icon { width: 48px; height: 48px; margin-right: 12px; }
        .logo-text { font-size: 28px; font-weight: 600; color: #55a39a; text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1); }
        .header-title { position: relative; z-index: 1; font-size: 24px; font-weight: 600; color: #ffffff; margin-bottom: 8px; }
        .header-subtitle { position: relative; z-index: 1; font-size: 16px; color: #d1d5db; }
        .email-content { padding: 40px 30px; }
        .welcome-message { font-size: 18px; font-weight: 500; color: #1f2937; margin-bottom: 16px; }
        .confirmation-text { font-size: 16px; color: #4b5563; margin-bottom: 30px; line-height: 1.7; }
        .cta-container { text-align: center; margin: 40px 0; }
        .cta-button { display: inline-block; background: linear-gradient(135deg, #55a39a 0%, #70b3aa 50%, #95cfc6 100%); color: #ffffff; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 16px rgba(85, 163, 154, 0.3); transition: all 0.3s ease; }
        .cta-button:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(85, 163, 154, 0.4); }
        .security-notice { background-color: #f3f4f6; border-left: 4px solid #55a39a; padding: 20px; margin: 30px 0; border-radius: 0 8px 8px 0; }
        .security-title { font-weight: 600; color: #1f2937; margin-bottom: 8px; }
        .security-text { font-size: 14px; color: #6b7280; }
        .email-footer { background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb; }
        .footer-text { font-size: 14px; color: #6b7280; margin-bottom: 20px; }
        .contact-info { font-size: 14px; color: #9ca3af; }
        .contact-link { color: #55a39a; text-decoration: none; }
        .contact-link:hover { text-decoration: underline; }
        @media (max-width: 600px) { .email-container { margin: 0; border-radius: 0; } .email-header { padding: 30px 20px; } .email-content { padding: 30px 20px; } .email-footer { padding: 20px; } .logo-text { font-size: 24px; } .header-title { font-size: 20px; } .cta-button { padding: 14px 28px; font-size: 15px; } }
        @media (prefers-color-scheme: dark) { body { background-color: #111827; } .email-container { background-color: #1f2937; } .welcome-message { color: #f9fafb; } .confirmation-text { color: #d1d5db; } .security-notice { background-color: #374151; border-left-color: #70b3aa; } .security-title { color: #f9fafb; } .security-text { color: #9ca3af; } .email-footer { background-color: #111827; border-top-color: #374151; } .footer-text { color: #9ca3af; } .contact-info { color: #9ca3af; } }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="email-header">
            <div class="logo-container">
                <svg class="logo-icon" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <linearGradient id="faceFront" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stop-color="#55a39a" stop-opacity="1"/>
                            <stop offset="100%" stop-color="#70b3aa" stop-opacity="0.8"/>
                        </linearGradient>
                        <linearGradient id="faceSide" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stop-color="#70b3aa" stop-opacity="0.7"/>
                            <stop offset="100%" stop-color="#95cfc6" stop-opacity="0.5"/>
                        </linearGradient>
                        <linearGradient id="faceTop" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stop-color="#95cfc6" stop-opacity="0.6"/>
                            <stop offset="100%" stop-color="#b8d9d3" stop-opacity="0.4"/>
                        </linearGradient>
                    </defs>
                    <polygon points="128,160 128,384 256,448 256,224" fill="url(#faceFront)"/>
                    <polygon points="256,224 256,448 384,384 384,160" fill="url(#faceSide)"/>
                    <polygon points="128,160 256,224 384,160 256,96" fill="url(#faceTop)"/>
                </svg>
                <span class="logo-text">MinbarAI</span>
            </div>
            <h1 class="header-title">Sign In to MinbarAI</h1>
            <p class="header-subtitle">Your secure access link</p>
        </div>
        <div class="email-content">
            <h2 class="welcome-message">Hello!</h2>
            <p class="confirmation-text">You requested a sign-in link for your MinbarAI account. Click the button below to securely sign in:</p>
            <div class="cta-container">
                <a href="{{ .ConfirmationURL }}" class="cta-button">Sign In to MinbarAI</a>
            </div>
            <div class="security-notice">
                <div class="security-title">🔒 Security Notice</div>
                <div class="security-text">This sign-in link will expire in 1 hour for your security. If you didn't request this link, please ignore this email.</div>
            </div>
            <p class="confirmation-text">If the button above doesn't work, copy and paste this link into your browser:</p>
            <p style="word-break: break-all; background-color: #f3f4f6; padding: 12px; border-radius: 6px; font-family: monospace; font-size: 14px; color: #6b7280;">{{ .ConfirmationURL }}</p>
        </div>
        <div class="email-footer">
            <p class="footer-text">This email was sent because you requested a sign-in link for your MinbarAI account.</p>
            <div class="contact-info">
                <p>Need help? Contact us at <a href="mailto:support@minbarai.com" class="contact-link">support@minbarai.com</a></p>
                <p style="margin-top: 8px;">MinbarAI.com - Transforming Sermons Across Languages</p>
            </div>
        </div>
    </div>
</body>
</html>
EOF

# Recovery Email Template
cat > public/email-templates/recovery-email.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reset Your MinbarAI Password</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; line-height: 1.6; color: #374151; background-color: #f9fafb; }
        .email-container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
        .email-header { background: linear-gradient(135deg, #0D1B20 0%, #1A2E35 25%, #2A4047 50%, #1A2E35 75%, #0D1B20 100%); padding: 40px 30px; text-align: center; position: relative; }
        .email-header::before { content: ''; position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: linear-gradient(135deg, rgba(85, 163, 154, 0.06) 0%, rgba(5, 10, 12, 0.98) 30%, rgba(8, 15, 18, 0.95) 70%, rgba(15, 26, 30, 0.92) 100%); }
        .logo-container { position: relative; z-index: 1; display: flex; align-items: center; justify-content: center; margin-bottom: 20px; }
        .logo-icon { width: 48px; height: 48px; margin-right: 12px; }
        .logo-text { font-size: 28px; font-weight: 600; color: #55a39a; text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1); }
        .header-title { position: relative; z-index: 1; font-size: 24px; font-weight: 600; color: #ffffff; margin-bottom: 8px; }
        .header-subtitle { position: relative; z-index: 1; font-size: 16px; color: #d1d5db; }
        .email-content { padding: 40px 30px; }
        .welcome-message { font-size: 18px; font-weight: 500; color: #1f2937; margin-bottom: 16px; }
        .confirmation-text { font-size: 16px; color: #4b5563; margin-bottom: 30px; line-height: 1.7; }
        .cta-container { text-align: center; margin: 40px 0; }
        .cta-button { display: inline-block; background: linear-gradient(135deg, #55a39a 0%, #70b3aa 50%, #95cfc6 100%); color: #ffffff; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 16px rgba(85, 163, 154, 0.3); transition: all 0.3s ease; }
        .cta-button:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(85, 163, 154, 0.4); }
        .security-notice { background-color: #f3f4f6; border-left: 4px solid #55a39a; padding: 20px; margin: 30px 0; border-radius: 0 8px 8px 0; }
        .security-title { font-weight: 600; color: #1f2937; margin-bottom: 8px; }
        .security-text { font-size: 14px; color: #6b7280; }
        .email-footer { background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb; }
        .footer-text { font-size: 14px; color: #6b7280; margin-bottom: 20px; }
        .contact-info { font-size: 14px; color: #9ca3af; }
        .contact-link { color: #55a39a; text-decoration: none; }
        .contact-link:hover { text-decoration: underline; }
        @media (max-width: 600px) { .email-container { margin: 0; border-radius: 0; } .email-header { padding: 30px 20px; } .email-content { padding: 30px 20px; } .email-footer { padding: 20px; } .logo-text { font-size: 24px; } .header-title { font-size: 20px; } .cta-button { padding: 14px 28px; font-size: 15px; } }
        @media (prefers-color-scheme: dark) { body { background-color: #111827; } .email-container { background-color: #1f2937; } .welcome-message { color: #f9fafb; } .confirmation-text { color: #d1d5db; } .security-notice { background-color: #374151; border-left-color: #70b3aa; } .security-title { color: #f9fafb; } .security-text { color: #9ca3af; } .email-footer { background-color: #111827; border-top-color: #374151; } .footer-text { color: #9ca3af; } .contact-info { color: #9ca3af; } }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="email-header">
            <div class="logo-container">
                <svg class="logo-icon" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <linearGradient id="faceFront" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stop-color="#55a39a" stop-opacity="1"/>
                            <stop offset="100%" stop-color="#70b3aa" stop-opacity="0.8"/>
                        </linearGradient>
                        <linearGradient id="faceSide" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stop-color="#70b3aa" stop-opacity="0.7"/>
                            <stop offset="100%" stop-color="#95cfc6" stop-opacity="0.5"/>
                        </linearGradient>
                        <linearGradient id="faceTop" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stop-color="#95cfc6" stop-opacity="0.6"/>
                            <stop offset="100%" stop-color="#b8d9d3" stop-opacity="0.4"/>
                        </linearGradient>
                    </defs>
                    <polygon points="128,160 128,384 256,448 256,224" fill="url(#faceFront)"/>
                    <polygon points="256,224 256,448 384,384 384,160" fill="url(#faceSide)"/>
                    <polygon points="128,160 256,224 384,160 256,96" fill="url(#faceTop)"/>
                </svg>
                <span class="logo-text">MinbarAI</span>
            </div>
            <h1 class="header-title">Reset Your Password</h1>
            <p class="header-subtitle">Secure password recovery for your account</p>
        </div>
        <div class="email-content">
            <h2 class="welcome-message">Password Reset Request</h2>
            <p class="confirmation-text">We received a request to reset the password for your MinbarAI account. Click the button below to create a new password:</p>
            <div class="cta-container">
                <a href="{{ .ConfirmationURL }}" class="cta-button">Reset My Password</a>
            </div>
            <div class="security-notice">
                <div class="security-title">🔒 Security Notice</div>
                <div class="security-text">This password reset link will expire in 1 hour for your security. If you didn't request a password reset, please ignore this email and your password will remain unchanged.</div>
            </div>
            <p class="confirmation-text">If the button above doesn't work, copy and paste this link into your browser:</p>
            <p style="word-break: break-all; background-color: #f3f4f6; padding: 12px; border-radius: 6px; font-family: monospace; font-size: 14px; color: #6b7280;">{{ .ConfirmationURL }}</p>
        </div>
        <div class="email-footer">
            <p class="footer-text">This email was sent because you requested a password reset for your MinbarAI account.</p>
            <div class="contact-info">
                <p>Need help? Contact us at <a href="mailto:support@minbarai.com" class="contact-link">support@minbarai.com</a></p>
                <p style="margin-top: 8px;">MinbarAI.com - Transforming Sermons Across Languages</p>
            </div>
        </div>
    </div>
</body>
</html>
EOF

# Email Change Template
cat > public/email-templates/email-change-email.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Confirm Your New Email Address</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; line-height: 1.6; color: #374151; background-color: #f9fafb; }
        .email-container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
        .email-header { background: linear-gradient(135deg, #0D1B20 0%, #1A2E35 25%, #2A4047 50%, #1A2E35 75%, #0D1B20 100%); padding: 40px 30px; text-align: center; position: relative; }
        .email-header::before { content: ''; position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: linear-gradient(135deg, rgba(85, 163, 154, 0.06) 0%, rgba(5, 10, 12, 0.98) 30%, rgba(8, 15, 18, 0.95) 70%, rgba(15, 26, 30, 0.92) 100%); }
        .logo-container { position: relative; z-index: 1; display: flex; align-items: center; justify-content: center; margin-bottom: 20px; }
        .logo-icon { width: 48px; height: 48px; margin-right: 12px; }
        .logo-text { font-size: 28px; font-weight: 600; color: #55a39a; text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1); }
        .header-title { position: relative; z-index: 1; font-size: 24px; font-weight: 600; color: #ffffff; margin-bottom: 8px; }
        .header-subtitle { position: relative; z-index: 1; font-size: 16px; color: #d1d5db; }
        .email-content { padding: 40px 30px; }
        .welcome-message { font-size: 18px; font-weight: 500; color: #1f2937; margin-bottom: 16px; }
        .confirmation-text { font-size: 16px; color: #4b5563; margin-bottom: 30px; line-height: 1.7; }
        .cta-container { text-align: center; margin: 40px 0; }
        .cta-button { display: inline-block; background: linear-gradient(135deg, #55a39a 0%, #70b3aa 50%, #95cfc6 100%); color: #ffffff; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 16px rgba(85, 163, 154, 0.3); transition: all 0.3s ease; }
        .cta-button:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(85, 163, 154, 0.4); }
        .security-notice { background-color: #f3f4f6; border-left: 4px solid #55a39a; padding: 20px; margin: 30px 0; border-radius: 0 8px 8px 0; }
        .security-title { font-weight: 600; color: #1f2937; margin-bottom: 8px; }
        .security-text { font-size: 14px; color: #6b7280; }
        .email-footer { background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb; }
        .footer-text { font-size: 14px; color: #6b7280; margin-bottom: 20px; }
        .contact-info { font-size: 14px; color: #9ca3af; }
        .contact-link { color: #55a39a; text-decoration: none; }
        .contact-link:hover { text-decoration: underline; }
        @media (max-width: 600px) { .email-container { margin: 0; border-radius: 0; } .email-header { padding: 30px 20px; } .email-content { padding: 30px 20px; } .email-footer { padding: 20px; } .logo-text { font-size: 24px; } .header-title { font-size: 20px; } .cta-button { padding: 14px 28px; font-size: 15px; } }
        @media (prefers-color-scheme: dark) { body { background-color: #111827; } .email-container { background-color: #1f2937; } .welcome-message { color: #f9fafb; } .confirmation-text { color: #d1d5db; } .security-notice { background-color: #374151; border-left-color: #70b3aa; } .security-title { color: #f9fafb; } .security-text { color: #9ca3af; } .email-footer { background-color: #111827; border-top-color: #374151; } .footer-text { color: #9ca3af; } .contact-info { color: #9ca3af; } }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="email-header">
            <div class="logo-container">
                <svg class="logo-icon" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <linearGradient id="faceFront" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stop-color="#55a39a" stop-opacity="1"/>
                            <stop offset="100%" stop-color="#70b3aa" stop-opacity="0.8"/>
                        </linearGradient>
                        <linearGradient id="faceSide" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stop-color="#70b3aa" stop-opacity="0.7"/>
                            <stop offset="100%" stop-color="#95cfc6" stop-opacity="0.5"/>
                        </linearGradient>
                        <linearGradient id="faceTop" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stop-color="#95cfc6" stop-opacity="0.6"/>
                            <stop offset="100%" stop-color="#b8d9d3" stop-opacity="0.4"/>
                        </linearGradient>
                    </defs>
                    <polygon points="128,160 128,384 256,448 256,224" fill="url(#faceFront)"/>
                    <polygon points="256,224 256,448 384,384 384,160" fill="url(#faceSide)"/>
                    <polygon points="128,160 256,224 384,160 256,96" fill="url(#faceTop)"/>
                </svg>
                <span class="logo-text">MinbarAI</span>
            </div>
            <h1 class="header-title">Confirm New Email</h1>
            <p class="header-subtitle">Verify your new email address</p>
        </div>
        <div class="email-content">
            <h2 class="welcome-message">Email Change Confirmation</h2>
            <p class="confirmation-text">You requested to change the email address for your MinbarAI account. Click the button below to confirm your new email address:</p>
            <div class="cta-container">
                <a href="{{ .ConfirmationURL }}" class="cta-button">Confirm New Email</a>
            </div>
            <div class="security-notice">
                <div class="security-title">🔒 Security Notice</div>
                <div class="security-text">This email confirmation link will expire in 24 hours for your security. If you didn't request this email change, please ignore this email and contact our support team.</div>
            </div>
            <p class="confirmation-text">If the button above doesn't work, copy and paste this link into your browser:</p>
            <p style="word-break: break-all; background-color: #f3f4f6; padding: 12px; border-radius: 6px; font-family: monospace; font-size: 14px; color: #6b7280;">{{ .ConfirmationURL }}</p>
        </div>
        <div class="email-footer">
            <p class="footer-text">This email was sent because you requested to change the email address for your MinbarAI account.</p>
            <div class="contact-info">
                <p>Need help? Contact us at <a href="mailto:support@minbarai.com" class="contact-link">support@minbarai.com</a></p>
                <p style="margin-top: 8px;">MinbarAI.com - Transforming Sermons Across Languages</p>
            </div>
        </div>
    </div>
</body>
</html>
EOF

echo "✅ All email templates created successfully!"
echo ""
echo "📁 Template files created:"
echo "   - public/email-templates/confirmation-email.html"
echo "   - public/email-templates/magic-link-email.html"
echo "   - public/email-templates/recovery-email.html"
echo "   - public/email-templates/email-change-email.html"
echo ""

echo "🎯 NEXT STEPS:"
echo "=============="
echo "1. Go to your Supabase Dashboard: https://supabase.com/dashboard/project/$PROJECT_ID"
echo "2. Navigate to Authentication → Email Templates"
echo "3. For each template type (Confirmation, Magic Link, Recovery, Email Change):"
echo "   - Click 'Edit' on the template"
echo "   - Copy the HTML content from the corresponding file in public/email-templates/"
echo "   - Paste it into the template editor"
echo "   - Update the subject line as needed"
echo "4. Save each template"
echo "5. Test by signing up with a new email address"
echo ""

echo "✨ Your confirmation emails will now feature:"
echo "   - MinbarAI branding and logo"
echo "   - Professional design matching your website"
echo "   - Mobile-responsive layout"
echo "   - Dark mode support"
echo "   - Security notices and clear CTAs"
echo ""

echo "🔧 Configuration complete! 🎉"
