# Production OAuth Fix - MinbarAI

## Problem Analysis

The Google OAuth authentication was failing in production with the error:
```
http://localhost:3000/auth/auth-code-error?error=session_exchange_failed
```

### Root Cause
The production deployment was using `localhost:3000` URLs instead of the production domain `https://minbarai-beta.vercel.app` for OAuth redirects.

## Fixes Applied

### 1. Updated OAuth Redirect URLs in Frontend

**Files Modified:**
- `app/auth/signin/page.tsx` (line 179-180)
- `app/auth/signup/page.tsx` (line 229-230, 163)

**Changes:**
- Changed from hardcoded `window.location.origin` to use environment variable
- Added fallback to `window.location.origin` for development
- Added console logging for debugging

**Before:**
```typescript
redirectTo: `${window.location.origin}/auth/callback?next=/dashboard&action=signin`
```

**After:**
```typescript
const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin
const redirectTo = `${baseUrl}/auth/callback?next=/dashboard&action=signin`
console.log('Google OAuth redirect URL:', redirectTo)
```

### 2. Environment Variable Configuration

**Required Environment Variable:**
```bash
NEXT_PUBLIC_SITE_URL=https://minbaraibeta.vercel.app
```

## Deployment Steps

### Step 1: Set Environment Variable in Vercel

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add/Update:
   - **Name:** `NEXT_PUBLIC_SITE_URL`
   - **Value:** `https://minbaraibeta.vercel.app`
   - **Environment:** Production (and Preview if needed)

### Step 2: Update Supabase OAuth Configuration

1. Go to Supabase Dashboard → Authentication → Providers → Google
2. Update **Redirect URLs** to include:
   ```
   https://minbaraibeta.vercel.app/auth/callback
   ```
3. Update **Site URL** to:
   ```
   https://minbaraibeta.vercel.app
   ```

### Step 3: Redeploy

1. Push changes to your repository
2. Vercel will automatically redeploy
3. Or manually trigger a deployment

## Verification Steps

### 1. Test Google OAuth Sign In
1. Go to `https://minbaraibeta.vercel.app/auth/signin`
2. Click "Continue with Google"
3. Complete Google authentication
4. Verify redirect to dashboard (not error page)

### 2. Test Google OAuth Sign Up
1. Go to `https://minbaraibeta.vercel.app/auth/signup`
2. Click "Continue with Google"
3. Complete Google authentication
4. Verify redirect to subscribe page (not error page)

### 3. Check Browser Console
- Look for the logged redirect URL in browser console
- Should show: `https://minbaraibeta.vercel.app/auth/callback?...`

## Additional Considerations

### Development vs Production
- **Development:** Uses `window.location.origin` (localhost:3000)
- **Production:** Uses `NEXT_PUBLIC_SITE_URL` environment variable

### Error Handling
The error page at `/auth/auth-code-error` will now show the correct domain instead of localhost.

### Security
- Environment variables are properly scoped to production
- No sensitive data exposed in frontend code
- Proper fallback mechanisms in place

## Troubleshooting

### If OAuth Still Fails:

1. **Check Environment Variable:**
   ```bash
   # In Vercel function logs, you should see:
   console.log('Google OAuth redirect URL:', 'https://minbaraibeta.vercel.app/auth/callback?...')
   ```

2. **Verify Supabase Configuration:**
   - Site URL: `https://minbaraibeta.vercel.app`
   - Redirect URLs: `https://minbaraibeta.vercel.app/auth/callback`

3. **Check Browser Network Tab:**
   - Look for redirects to correct domain
   - No localhost:3000 URLs in production

4. **Clear Browser Cache:**
   - OAuth state might be cached
   - Try incognito/private browsing

## Files Modified Summary

```
app/auth/signin/page.tsx     - Updated Google OAuth redirect URL
app/auth/signup/page.tsx     - Updated Google OAuth redirect URL (2 locations)
PRODUCTION_OAUTH_FIX.md     - This documentation file
```

## Next Steps

1. Deploy the changes
2. Set the environment variable in Vercel
3. Update Supabase OAuth configuration
4. Test the authentication flow
5. Monitor for any remaining issues

The fix ensures that production OAuth redirects use the correct domain while maintaining development functionality.
