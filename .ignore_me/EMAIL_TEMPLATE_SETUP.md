# MinbarAI Email Template Configuration

This guide explains how to update your Supabase confirmation emails to match your MinbarAI website design and branding.

## 🎨 What's Included

The custom email templates feature:

- **MinbarAI Logo**: Your distinctive geometric logo with gradient styling
- **Brand Colors**: Primary color scheme (#55a39a) matching your website
- **Professional Design**: Clean, modern layout with proper typography
- **Mobile Responsive**: Optimized for all device sizes
- **Dark Mode Support**: Automatic adaptation to user preferences
- **Security Features**: Clear notices and expiration warnings
- **Accessibility**: Proper contrast ratios and readable fonts

## 📧 Email Templates Created

1. **Account Confirmation** (`confirmation-email.html`)
   - Welcome message for new users
   - Clear call-to-action button
   - Feature highlights
   - Security notices

2. **Magic Link Sign-In** (`magic-link-email.html`)
   - Passwordless authentication
   - Secure access link
   - Time-limited validity

3. **Password Recovery** (`recovery-email.html`)
   - Password reset functionality
   - Security warnings
   - Clear instructions

4. **Email Change Confirmation** (`email-change-email.html`)
   - New email verification
   - Account security notices
   - Change confirmation

## 🚀 Quick Setup

### Option 1: Automated Script (Recommended)

```bash
# Run the configuration script
./scripts/configure-email-templates.sh
```

The script will:
- Check for Supabase CLI installation
- Verify authentication
- Create all email templates
- Provide step-by-step instructions

### Option 2: Manual Configuration

1. **Access Supabase Dashboard**
   - Go to: https://supabase.com/dashboard/project/hjsifxofnqbnrgqkbomx
   - Navigate to: **Authentication** → **Email Templates**

2. **Configure Each Template**
   - Click **Edit** on each template type
   - Copy HTML content from `public/email-templates/`
   - Paste into the template editor
   - Update subject lines as needed
   - Save changes

## 📁 File Structure

```
public/email-templates/
├── confirmation-email.html      # Account confirmation
├── magic-link-email.html        # Passwordless sign-in
├── recovery-email.html         # Password reset
└── email-change-email.html     # Email change confirmation

scripts/
└── configure-email-templates.sh # Automated setup script
```

## 🎯 Template Features

### Visual Design
- **Header**: Gradient background with MinbarAI logo and branding
- **Content**: Clean typography with proper spacing
- **CTA Buttons**: Prominent, branded action buttons
- **Footer**: Contact information and support links

### Technical Features
- **Responsive**: Mobile-first design approach
- **Cross-client**: Tested across major email clients
- **Accessible**: Proper contrast and readable fonts
- **Secure**: Clear security notices and warnings

### Branding Elements
- **Logo**: SVG-based geometric MinbarAI logo
- **Colors**: Primary (#55a39a), accent (#70b3aa), neutral grays
- **Typography**: Inter font family matching website
- **Gradients**: Subtle background gradients for depth

## 🔧 Customization

### Colors
Update the CSS variables in each template:
```css
/* Primary brand color */
--primary-color: #55a39a;

/* Accent color */
--accent-color: #70b3aa;

/* Background gradients */
--header-gradient: linear-gradient(135deg, #0D1B20 0%, #1A2E35 25%, #2A4047 50%, #1A2E35 75%, #0D1B20 100%);
```

### Logo
Replace the SVG logo in each template with your preferred version:
```html
<svg class="logo-icon" viewBox="0 0 512 512" fill="none">
  <!-- Your logo SVG content -->
</svg>
```

### Content
Modify the text content in each template:
- Welcome messages
- Feature descriptions
- Security notices
- Contact information

## 🧪 Testing

### Test Email Delivery
1. Create a test account with a real email address
2. Check email delivery and formatting
3. Test on different email clients (Gmail, Outlook, Apple Mail)
4. Verify mobile responsiveness

### Test Links
1. Confirm all confirmation links work correctly
2. Test expiration times
3. Verify redirect URLs
4. Check error handling

## 📱 Email Client Compatibility

The templates are tested and optimized for:
- **Gmail** (Web, Mobile, Desktop)
- **Outlook** (2016, 2019, 365, Web)
- **Apple Mail** (macOS, iOS)
- **Yahoo Mail**
- **Thunderbird**
- **Mobile clients** (iOS Mail, Android Gmail)

## 🔒 Security Considerations

### Template Security
- No external resources (all CSS inline)
- No JavaScript (email security)
- HTTPS links only
- Clear expiration notices

### Supabase Security
- Templates stored securely in Supabase
- No sensitive data in templates
- Proper URL validation
- Rate limiting protection

## 🆘 Troubleshooting

### Common Issues

**Templates not updating:**
- Clear browser cache
- Check Supabase dashboard for changes
- Verify template syntax

**Styling issues:**
- Check CSS compatibility
- Test in different email clients
- Verify responsive breakpoints

**Links not working:**
- Check Supabase URL configuration
- Verify redirect URLs
- Test confirmation flow

### Support

If you encounter issues:
1. Check the Supabase documentation
2. Review template syntax
3. Test with different email addresses
4. Contact support@minbarai.com

## 📈 Monitoring

### Email Analytics
Monitor email performance through:
- Supabase Auth logs
- Email delivery rates
- User confirmation rates
- Template effectiveness

### A/B Testing
Consider testing different:
- Subject lines
- Call-to-action buttons
- Content length
- Visual elements

## 🎉 Success Metrics

After implementation, you should see:
- **Improved brand recognition** in email communications
- **Higher confirmation rates** due to professional design
- **Better user experience** with consistent branding
- **Reduced support requests** due to clearer instructions

---

**Need help?** Contact support@minbarai.com or check the Supabase documentation for advanced configuration options.
