# Stripe Production Redirect Fix - MinbarAI

## Problem Analysis

After fixing the OAuth issue, Stripe checkout was redirecting to `localhost:3000` instead of the production domain, causing the error:
```
http://localhost:3000/subscribe#error=server_error&error_code=flow_state_not_found&error_description=Flow+state+not+found
```

### Root Cause
The Stripe checkout and portal routes were using hardcoded `localhost:3000` URLs for development instead of using the environment variable for production.

## Fixes Applied

### 1. Updated Stripe Checkout Route

**File:** `app/api/stripe/checkout/route.ts` (line 301)

**Before:**
```typescript
const baseUrl = process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : getURL().slice(0, -1)
```

**After:**
```typescript
const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || getURL().slice(0, -1)
```

### 2. Updated Stripe Portal Route

**File:** `app/api/stripe/portal/route.ts` (line 48)

**Before:**
```typescript
return_url: `${process.env.NODE_ENV === 'development' ? 'http://localhost:3000/' : getURL()}dashboard/billing`,
```

**After:**
```typescript
return_url: `${process.env.NEXT_PUBLIC_SITE_URL || getURL()}dashboard/billing`,
```

## How the Fix Works

### Environment Variable Priority
The fix uses the same environment variable (`NEXT_PUBLIC_SITE_URL`) that we set for OAuth:

1. **Production:** Uses `NEXT_PUBLIC_SITE_URL=https://minbaraibeta.vercel.app`
2. **Development:** Falls back to `getURL()` which handles localhost automatically
3. **Fallback:** Uses Vercel's automatic URL detection

### URL Generation Logic
```typescript
// Stripe checkout URLs
const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || getURL().slice(0, -1)
const successUrl = `${baseUrl}/dashboard/success`
const cancelUrl = `${baseUrl}/subscribe?canceled=true`

// Stripe portal URL
return_url: `${process.env.NEXT_PUBLIC_SITE_URL || getURL()}dashboard/billing`
```

## Verification Steps

### 1. Test Stripe Checkout Flow
1. Go to `https://minbaraibeta.vercel.app/subscribe`
2. Click on a subscription plan
3. Complete Stripe checkout
4. Verify redirect to `https://minbaraibeta.vercel.app/dashboard/success` (not localhost)

### 2. Test Stripe Portal Flow
1. Go to `https://minbaraibeta.vercel.app/dashboard/billing`
2. Click "Manage Subscription" or similar portal link
3. Complete billing portal actions
4. Verify redirect back to `https://minbaraibeta.vercel.app/dashboard/billing` (not localhost)

### 3. Check Server Logs
Look for these log messages in Vercel function logs:
```
Creating checkout session with URLs:
- Success URL: https://minbaraibeta.vercel.app/dashboard/success
- Cancel URL: https://minbaraibeta.vercel.app/subscribe?canceled=true
```

## Environment Configuration

### Required Environment Variable
```bash
NEXT_PUBLIC_SITE_URL=https://minbaraibeta.vercel.app
```

This should already be set from the OAuth fix, but verify it's configured in Vercel.

### Stripe Configuration
No additional Stripe configuration needed - the fix uses the same environment variable approach as OAuth.

## Error Resolution

### Before Fix
- Stripe checkout redirected to `localhost:3000/subscribe#error=...`
- Flow state not found errors
- Users couldn't complete subscription process

### After Fix
- Stripe checkout redirects to production domain
- Proper flow state handling
- Users can complete subscription process successfully

## Files Modified Summary

```
app/api/stripe/checkout/route.ts  - Updated checkout URL generation
app/api/stripe/portal/route.ts   - Updated portal return URL
STRIPE_PRODUCTION_FIX.md        - This documentation file
```

## Next Steps

1. **Deploy the changes** (if not already deployed)
2. **Verify environment variable** is set in Vercel
3. **Test the complete flow:**
   - OAuth sign in → Dashboard → Subscribe → Stripe checkout → Success
4. **Monitor for any remaining issues**

The fix ensures that all Stripe redirects use the correct production domain while maintaining development functionality.
