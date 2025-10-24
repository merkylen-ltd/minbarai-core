# Production OAuth Configuration Guide

## 🚀 Production Setup Steps

### Step 1: Google Cloud Console Configuration

**Current Client ID**: `874332971589-i5fpiera82v4b69h0sk3m72n2u9tukh3`

1. **Go to**: https://console.cloud.google.com/
2. **Select your project** (with the above client ID)
3. **Navigate to**: APIs & Services → Credentials
4. **Click on your OAuth 2.0 Client ID**
5. **Add these Authorized redirect URIs**:

```
https://hjsifxofnqbnrgqkbomx.supabase.co/auth/v1/callback
https://yourdomain.com/auth/callback
```

**⚠️ Replace `yourdomain.com` with your actual production domain!**

### Step 2: Supabase Configuration

**Current Supabase Project**: `hjsifxofnqbnrgqkbomx`

1. **Go to**: https://supabase.com/dashboard
2. **Select project**: `hjsifxofnqbnrgqkbomx`
3. **Navigate to**: Authentication → URL Configuration
4. **Add these Redirect URLs**:

```
http://localhost:3000/auth/callback
https://yourdomain.com/auth/callback
```

### Step 3: Environment Variables

**For Production Deployment:**

```env
# Replace with your actual production domain
NEXT_PUBLIC_SITE_URL=https://yourdomain.com

# Supabase (already configured)
NEXT_PUBLIC_SUPABASE_URL=https://hjsifxofnqbnrgqkbomx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhqc2lmeG9mbnFibnJncWtib214Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA1Mjg5NTAsImV4cCI6MjA3NjEwNDk1MH0.zKHLaT6H5HtjUgG_gZxmgsPpMY7GE7l0rdiMitn9iaY

# Production Stripe keys
STRIPE_SECRET_KEY=sk_live_your_production_stripe_secret_key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_your_production_stripe_publishable_key

# Production AI API key
GEMINI_API_KEY=your_production_gemini_api_key
```

### Step 4: OAuth Flow Explanation

**How it works:**

1. **User clicks "Continue with Google"** → Redirects to Google OAuth
2. **Google authenticates user** → Redirects to Supabase callback
3. **Supabase processes OAuth** → Redirects to your app callback
4. **Your app handles the callback** → Redirects to appropriate page

**The flow:**
```
User → Google OAuth → Supabase Callback → Your App Callback → Dashboard/Subscribe
```

### Step 5: Testing Production

**Before going live:**

1. **Test in staging environment** with production-like setup
2. **Verify all redirect URLs** are configured correctly
3. **Test OAuth flow** end-to-end
4. **Check error handling** for edge cases

### Step 6: Common Production Issues

**Issue**: OAuth redirects to wrong URL
**Solution**: Check both Google Cloud Console and Supabase redirect URLs

**Issue**: SSL certificate errors
**Solution**: Ensure HTTPS is properly configured

**Issue**: CORS errors
**Solution**: Verify domain configuration in both Google and Supabase

### Step 7: Monitoring Production

**Monitor these logs:**
- OAuth callback success/failure rates
- User authentication errors
- Redirect URL mismatches
- Session establishment failures

## 🔧 Quick Fix Commands

**Verify current configuration:**
```bash
node scripts/verify-oauth-config.js
```

**Test OAuth flow:**
```bash
node scripts/test-oauth-flow.js
```

## 📋 Production Checklist

- [ ] Google Cloud Console redirect URIs configured
- [ ] Supabase redirect URLs configured
- [ ] Production environment variables set
- [ ] SSL certificates configured
- [ ] OAuth flow tested end-to-end
- [ ] Error handling verified
- [ ] Monitoring setup

## 🚨 Critical Notes

1. **Never use development URLs in production**
2. **Always use HTTPS in production**
3. **Test OAuth flow before going live**
4. **Monitor authentication success rates**
5. **Have fallback error handling**

## 📞 Support

If you encounter issues:
1. Check Google Cloud Console configuration
2. Verify Supabase redirect URLs
3. Test OAuth flow manually
4. Check server logs for specific errors

**Remember**: The OAuth flow requires configuration in BOTH Google Cloud Console AND Supabase!
