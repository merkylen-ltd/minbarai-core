# 📧 Email Verification Setup Guide for MinbarAI

This comprehensive guide will help you set up email verification for your Supabase project with custom branded email templates.

## 🎯 Overview

Your MinbarAI project already has:
- ✅ Supabase authentication integration
- ✅ Custom email templates with MinbarAI branding
- ✅ Email verification logic in the authentication flow
- ✅ Proper redirect handling

## 🔧 Step 1: Supabase Dashboard Configuration

### 1.1 Access Your Supabase Project
- **Project ID**: `hjsifxofnqbnrgqkbomx`
- **Dashboard URL**: https://supabase.com/dashboard/project/hjsifxofnqbnrgqkbomx

### 1.2 Enable Email Confirmation
1. Navigate to **Authentication** → **Settings**
2. Under **User Signups**, ensure these are checked:
   - ✅ **Enable email confirmations**
   - ✅ **Enable email change confirmations** 
   - ✅ **Enable password recovery**

### 1.3 Configure URL Settings
1. Go to **Authentication** → **URL Configuration**
2. Set the following URLs:

   **Site URL**:
   ```
   http://localhost:3000
   ```
   (Change to `https://minbarai.com` for production)

   **Redirect URLs**:
   ```
   http://localhost:3000/auth/callback
   https://minbarai.com/auth/callback
   ```

## 🎨 Step 2: Configure Custom Email Templates

### 2.1 Access Email Templates
1. Navigate to **Authentication** → **Email Templates**
2. You'll see four template types that need configuration

### 2.2 Configure Each Template

#### A) Confirm Signup Template
1. Click **Edit** on "Confirm signup"
2. **Subject**: `Confirm your MinbarAI account`
3. **Body**: Copy the entire content from `public/email-templates/confirmation-email.html`
4. Click **Save**

#### B) Magic Link Template  
1. Click **Edit** on "Magic Link"
2. **Subject**: `Your MinbarAI sign-in link`
3. **Body**: Copy the entire content from `public/email-templates/magic-link-email.html`
4. Click **Save**

#### C) Reset Password Template
1. Click **Edit** on "Reset password"
2. **Subject**: `Reset your MinbarAI password`
3. **Body**: Copy the entire content from `public/email-templates/recovery-email.html`
4. Click **Save**

#### D) Change Email Address Template
1. Click **Edit** on "Change email address"
2. **Subject**: `Confirm your new email address`
3. **Body**: Copy the entire content from `public/email-templates/email-change-email.html`
4. Click **Save**

## 🧪 Step 3: Test Email Verification

### 3.1 Run the Test Script
```bash
# Make sure you're in the project root
cd "/media/abi/ext_nvme/Merkyen LTD/MinberAI"

# Run the email verification test
node scripts/test-email-verification.js
```

### 3.2 Manual Testing
1. **Start your development server**:
   ```bash
   npm run dev
   ```

2. **Test sign-up flow**:
   - Go to `http://localhost:3000/auth/signup`
   - Enter a test email address
   - Complete the sign-up form
   - Check your email for the confirmation message

3. **Verify email confirmation**:
   - Click the confirmation link in the email
   - You should be redirected to `/auth/callback`
   - Then redirected to `/subscribe` (or your intended destination)

## 🔍 Step 4: Verify Configuration

### 4.1 Check Authentication Settings
In your Supabase dashboard, verify:
- ✅ Email confirmations are enabled
- ✅ Redirect URLs are properly configured
- ✅ Site URL matches your development/production environment

### 4.2 Check Email Templates
Verify all four templates are configured:
- ✅ Confirm signup
- ✅ Magic Link
- ✅ Reset password  
- ✅ Change email address

### 4.3 Test Different Scenarios
- ✅ New user sign-up
- ✅ Email confirmation flow
- ✅ Password reset
- ✅ Email change

## 🚨 Troubleshooting

### Common Issues

#### 1. Emails Not Sending
**Problem**: Users don't receive confirmation emails
**Solution**: 
- Check Supabase email settings
- Verify SMTP configuration in Supabase
- Check spam folders

#### 2. Redirect URL Errors
**Problem**: "Invalid redirect URL" errors
**Solution**:
- Ensure redirect URLs are added to Supabase settings
- Check that URLs match exactly (including protocol)
- Verify Site URL is set correctly

#### 3. Email Templates Not Loading
**Problem**: Default templates showing instead of custom ones
**Solution**:
- Verify HTML content was copied completely
- Check for any syntax errors in the HTML
- Ensure all template variables are preserved

#### 4. Authentication Callback Issues
**Problem**: Users stuck after clicking email link
**Solution**:
- Check `app/auth/callback/route.ts` for errors
- Verify email confirmation logic
- Check browser console for JavaScript errors

## 📋 Production Deployment

### For Production Environment:
1. **Update Site URL** in Supabase to your production domain:
   ```
   https://minbarai.com
   ```

2. **Add Production Redirect URLs**:
   ```
   https://minbarai.com/auth/callback
   ```

3. **Update Environment Variables**:
   ```env
   NEXT_PUBLIC_SITE_URL=https://minbarai.com
   ```

## 🎉 Success Indicators

You'll know email verification is working when:
- ✅ New users receive branded confirmation emails
- ✅ Users must confirm email before accessing the app
- ✅ Password reset emails are sent with custom templates
- ✅ Email change confirmations work properly
- ✅ All redirects work correctly

## 📞 Support

If you encounter issues:
1. Check the Supabase logs in your dashboard
2. Review the test script output
3. Verify all configuration steps were completed
4. Test with different email providers

---

**Your MinbarAI email verification is now ready! 🚀**

The system will automatically:
- Send branded confirmation emails to new users
- Require email verification before account activation
- Handle password resets with custom templates
- Manage email changes securely
