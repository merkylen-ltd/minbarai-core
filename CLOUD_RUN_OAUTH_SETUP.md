# Google OAuth2 Setup for Cloud Run Deployment

## Overview

This guide covers the complete setup of Google OAuth2 authentication for MinberAI deployed on Google Cloud Run. The OAuth flow has been updated to work with both Cloud Run URLs and custom domains.

## 🔧 Required Configuration Steps

### 1. Google Cloud Console OAuth Configuration

**Current Client ID**: `874332971589-i5fpiera82v4b69h0sk3m72n2u9tukh3`

1. **Go to**: [Google Cloud Console](https://console.cloud.google.com/)
2. **Select your project** (with the above client ID)
3. **Navigate to**: APIs & Services → Credentials
4. **Click on your OAuth 2.0 Client ID**
5. **Add these Authorized redirect URIs**:

```
# Supabase callback (required)
https://hjsifxofnqbnrgqkbomx.supabase.co/auth/v1/callback

# Development environment
https://minbarai-dev-878512438019.europe-west3.run.app/auth/callback

# Production environment (custom domain)
https://minbarai.com/auth/callback

# Local development
http://localhost:3000/auth/callback
```

### 2. Supabase OAuth Configuration

**Current Supabase Project**: `hjsifxofnqbnrgqkbomx`

1. **Go to**: [Supabase Dashboard](https://supabase.com/dashboard)
2. **Select project**: `hjsifxofnqbnrgqkbomx`
3. **Navigate to**: Authentication → URL Configuration
4. **Update Site URL and Redirect URLs**:

**Site URL:**
```
https://minbarai.com
```

**Redirect URLs:**
```
http://localhost:3000/auth/callback
https://minbarai-dev-878512438019.europe-west3.run.app/auth/callback
https://minbarai.com/auth/callback
```

### 3. Environment Variables Configuration

Update your `.env` file with the correct URLs:

```bash
# Development
NEXT_PUBLIC_SITE_URL=https://minbarai-dev-878512438019.europe-west3.run.app
NEXTAUTH_URL=https://minbarai-dev-878512438019.europe-west3.run.app

# Production (when using custom domain)
NEXT_PUBLIC_SITE_URL=https://minbarai.com
NEXTAUTH_URL=https://minbarai.com
```

### 4. Cloud Run Deployment Configuration

The deployment scripts automatically set the correct environment variables:

**Development Deployment:**
```bash
./deploy-dev.sh
```
- Sets `NEXT_PUBLIC_SITE_URL` to the Cloud Run dev URL
- Sets `NEXTAUTH_URL` to the Cloud Run dev URL

**Production Deployment:**
```bash
./deploy-pro.sh
```
- Sets `NEXT_PUBLIC_SITE_URL` to the custom domain
- Sets `NEXTAUTH_URL` to the custom domain

## 🔄 OAuth Flow Explanation

### How the Updated Flow Works:

1. **User clicks "Continue with Google"** → Frontend detects environment
2. **Environment Detection** → Uses `NEXT_PUBLIC_SITE_URL` or falls back to `window.location.origin`
3. **Redirect to Google** → Google OAuth with correct redirect URL
4. **Google authenticates** → Redirects to Supabase callback
5. **Supabase processes** → Redirects to your app callback
6. **App handles callback** → Redirects to dashboard/subscribe

### Environment Detection Logic:

```typescript
// Updated logic supports Cloud Run URLs
const isProduction = window.location.hostname === 'minbarai.com' || 
                    window.location.hostname.includes('minbarai-pro-') ||
                    window.location.hostname.includes('minbarai-dev-')
const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin
```

## 🧪 Testing OAuth Flow

### 1. Test Development Environment

```bash
# Deploy to development
./deploy-dev.sh

# Test OAuth flow
curl -I https://minbarai-dev-878512438019.europe-west3.run.app/auth/signin
```

### 2. Test Production Environment

```bash
# Deploy to production
./deploy-pro.sh

# Test OAuth flow
curl -I https://minbarai.com/auth/signin
```

### 3. Verify OAuth Configuration

```bash
# Check if OAuth endpoints are accessible
curl -I https://minbarai-dev-878512438019.europe-west3.run.app/auth/callback
curl -I https://minbarai.com/auth/callback
```

## 🚨 Troubleshooting

### Common Issues:

1. **"Invalid redirect URI" error**
   - Check Google Cloud Console redirect URIs
   - Ensure Supabase redirect URLs are correct
   - Verify environment variables are set

2. **"Session exchange failed" error**
   - Check Supabase OAuth configuration
   - Verify Site URL matches your domain
   - Clear browser cache and cookies

3. **OAuth redirects to wrong URL**
   - Check `NEXT_PUBLIC_SITE_URL` environment variable
   - Verify deployment script sets correct URLs
   - Check browser console for redirect URL logs

### Debug Steps:

1. **Check Environment Variables:**
   ```bash
   # In Cloud Run logs
   echo $NEXT_PUBLIC_SITE_URL
   echo $NEXTAUTH_URL
   ```

2. **Check OAuth Redirect URLs:**
   ```bash
   # Test the callback endpoint
   curl -v https://your-domain.com/auth/callback
   ```

3. **Check Supabase Configuration:**
   - Go to Supabase Dashboard → Authentication → URL Configuration
   - Verify Site URL and Redirect URLs match your deployment

## 📋 Deployment Checklist

### Before Deployment:
- [ ] Google Cloud Console OAuth redirect URIs updated
- [ ] Supabase OAuth configuration updated
- [ ] Environment variables configured in `.env`
- [ ] Custom domain DNS configured (for production)

### After Deployment:
- [ ] Test OAuth sign-in flow
- [ ] Test OAuth sign-up flow
- [ ] Verify redirect URLs in browser console
- [ ] Check Cloud Run logs for OAuth errors
- [ ] Test with different browsers/incognito mode

## 🔐 Security Considerations

1. **HTTPS Only**: All OAuth URLs must use HTTPS in production
2. **Domain Validation**: Google OAuth validates redirect URIs exactly
3. **Environment Variables**: Keep OAuth secrets in Google Secret Manager
4. **Rate Limiting**: OAuth endpoints have built-in rate limiting

## 📞 Support

If you encounter issues:

1. Check Cloud Run logs: `gcloud logs read --service=minbarai-dev`
2. Check Supabase logs: Supabase Dashboard → Logs
3. Verify OAuth configuration in both Google Cloud Console and Supabase
4. Test with browser developer tools to see redirect URLs

---

**Last Updated**: October 2025  
**Version**: 1.0  
**Environment**: Google Cloud Run
