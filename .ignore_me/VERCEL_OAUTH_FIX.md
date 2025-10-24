# Vercel Deployment OAuth Fix Guide

## 🚨 Issue Identified

Your Vercel deployment is redirecting to `http://localhost:3000/?code=...` instead of your production domain. This happens because:

1. **Google Cloud Console** doesn't have your Vercel URL configured
2. **Supabase** doesn't have your Vercel URL configured
3. The OAuth flow is falling back to localhost

## 🔧 Solution: Configure OAuth URLs

### Step 1: Google Cloud Console Configuration

**Your Client ID**: `874332971589-i5fpiera82v4b69h0sk3m72n2u9tukh3`

1. **Go to**: https://console.cloud.google.com/
2. **Select your project** (with the above client ID)
3. **Navigate to**: APIs & Services → Credentials
4. **Click on your OAuth 2.0 Client ID**
5. **Add these Authorized redirect URIs**:

```
https://hjsifxofnqbnrgqkbomx.supabase.co/auth/v1/callback
http://localhost:3000/auth/callback
https://mibaraibeta-d1i1e6pad-merkylens-projects.vercel.app/auth/callback
https://minbarai.com/auth/callback
```

**⚠️ Replace with your actual domains!**

### Step 2: Supabase Configuration

**Your Supabase Project**: `hjsifxofnqbnrgqkbomx`

1. **Go to**: https://supabase.com/dashboard
2. **Select project**: `hjsifxofnqbnrgqkbomx`
3. **Navigate to**: Authentication → URL Configuration
4. **Add these Redirect URLs**:

```
http://localhost:3000/auth/callback
https://mibaraibeta-d1i1e6pad-merkylens-projects.vercel.app/auth/callback
https://minbarai.com/auth/callback
```

### Step 3: Environment Variables for Vercel

In your Vercel deployment settings, set these environment variables:

```env
NEXT_PUBLIC_SITE_URL=https://mibaraibeta-d1i1e6pad-merkylens-projects.vercel.app
NEXT_PUBLIC_SUPABASE_URL=https://hjsifxofnqbnrgqkbomx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhqc2lmeG9mbnFibnJncWtib214Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA1Mjg5NTAsImV4cCI6MjA3NjEwNDk1MH0.zKHLaT6H5HtjUgG_gZxmgsPpMY7GE7l0rdiMitn9iaY
```

## 🔍 How Preview Deployment Detection Works

Your app has a preview deployment detection mechanism that:

1. **Detects Vercel preview deployments** (like your current URL)
2. **Saves the preview URL** to localStorage
3. **Uses the saved URL** for OAuth redirects

This should work automatically, but the OAuth providers need to be configured first.

## 🧪 Testing Steps

### Test 1: Verify Configuration
1. Go to your Vercel deployment
2. Open browser console
3. Check if preview URL is detected:
   ```javascript
   localStorage.getItem('minbarai_preview_url')
   ```

### Test 2: OAuth Flow
1. Go to `https://mibaraibeta-d1i1e6pad-merkylens-projects.vercel.app/auth/signin`
2. Click "Continue with Google"
3. Complete authentication
4. **VERIFY**: Redirects to your Vercel domain (not localhost)

## 🚨 Common Issues

### Issue: Still redirecting to localhost
**Solution**: 
1. Check Google Cloud Console redirect URIs
2. Check Supabase redirect URLs
3. Clear browser cache
4. Redeploy to Vercel

### Issue: Preview detection not working
**Solution**:
1. Check browser console for errors
2. Verify localStorage has preview URL
3. Check if `isPreviewDeployment()` returns true

### Issue: CORS errors
**Solution**:
1. Verify domain configuration in both Google and Supabase
2. Check SSL certificates
3. Ensure HTTPS is used

## 📋 Quick Fix Checklist

- [ ] Google Cloud Console has Vercel URL configured
- [ ] Supabase has Vercel URL configured
- [ ] Vercel environment variables set
- [ ] Preview deployment detection working
- [ ] OAuth flow tested on Vercel
- [ ] No localhost redirects

## 🔧 Debugging Commands

```bash
# Check if preview detection is working
# In browser console on Vercel deployment:
console.log('Preview URL:', localStorage.getItem('minbarai_preview_url'))
console.log('Is Preview:', window.location.hostname.includes('.vercel.app'))
```

## 📞 Next Steps

1. **Configure Google Cloud Console** (most important!)
2. **Configure Supabase redirect URLs**
3. **Set Vercel environment variables**
4. **Test OAuth flow on Vercel**
5. **Verify no localhost redirects**

**The main issue is that your OAuth providers don't know about your Vercel URL yet!**


