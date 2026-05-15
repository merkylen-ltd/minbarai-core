import { NextResponse, type NextRequest } from 'next/server'
import { createMiddlewareClient } from '@/lib/supabase/server'
import { isValidSubscriptionStatus, isCancelledSubscriptionActive } from '@/lib/subscription'
import { securityHeadersMiddleware } from '@/lib/auth/security-headers'
import { isAdminUser } from '@/lib/auth/admin'

// GRACE PERIOD LOGIC:
// Cancelled subscriptions continue to work until subscription_period_end passes.
// This grace period allows users to have uninterrupted access after cancellation.
// See lib/subscription.ts for CANCELLED_GRACE_PERIOD_DAYS constant.
//
// CACHING BEHAVIOR:
// Subscription state is not re-checked on every request for authenticated users
// already on /dashboard. The user's session cookie is the source of truth until
// it refreshes. This means:
// 1. If a subscription expires while a user is actively browsing, they won't be
//    immediately logged out (they'll be redirected on next navigation).
// 2. If a subscription is reactivated, the user might need to refresh to see changes.
// This is acceptable for the UX vs. the cost of querying the database on every request.

// Type for user data we need from the database
interface UserSubscriptionData {
  subscription_status: string | null
  subscription_period_end: string | null
  is_suspended: boolean
}

export async function middleware(request: NextRequest) {
  const response = NextResponse.next()
  
  // Add security headers to all responses
  const securedResponse = securityHeadersMiddleware(request, response)
  
  const supabase = createMiddlewareClient(request, securedResponse)

  // Use getUser() to validate the session against Supabase Auth (not just cookie storage)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Protect admin routes - check authentication and admin privileges
  if (pathname.startsWith('/admin')) {
    // Allow public health check endpoint for monitoring
    if (pathname === '/admin/api/health/status') {
      return securedResponse
    }

    // Require authentication
    if (!user) {
      const loginUrl = new URL('/auth/signin', request.url)
      loginUrl.searchParams.set('redirect', pathname)
      loginUrl.searchParams.set('message', 'Please sign in to access the admin panel')
      return securityHeadersMiddleware(request, NextResponse.redirect(loginUrl))
    }

    // Require admin privileges
    if (!isAdminUser(user.email)) {
      const dashboardUrl = new URL('/dashboard', request.url)
      dashboardUrl.searchParams.set('error', 'Access denied: Admin privileges required')
      return securityHeadersMiddleware(request, NextResponse.redirect(dashboardUrl))
    }

    // Admin user authenticated - allow access
    return securedResponse
  }

  // Early return for paths that don't need user data lookup
  const needsUserCheck = pathname.startsWith('/dashboard') ||
    (pathname.startsWith('/subscribe') && !!user) ||
    (pathname.startsWith('/auth/') && !!user)

  // Single database query for routes that need subscription data
  let userData: UserSubscriptionData | null = null
  if (needsUserCheck && user) {
    const { data, error } = await supabase
      .from('users')
      .select('subscription_status, subscription_period_end, is_suspended')
      .eq('id', user.id)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('Middleware: Database error:', error.message)
    }
    userData = data
  }

  // Protect dashboard routes
  if (pathname.startsWith('/dashboard')) {
    if (!user) {
      return securityHeadersMiddleware(request, NextResponse.redirect(new URL('/auth/signin', request.url)))
    }

    if (!userData) {
      return securityHeadersMiddleware(request, NextResponse.redirect(new URL('/subscribe', request.url)))
    }

    // Admin-suspended users are blocked regardless of Stripe state
    if (userData.is_suspended) {
      return securityHeadersMiddleware(request, NextResponse.redirect(new URL('/auth/suspended', request.url)))
    }

    // Check if cancelled subscription is still within paid period
    if (userData.subscription_status === 'canceled') {
      const isStillActive = isCancelledSubscriptionActive(userData.subscription_status, userData.subscription_period_end)
      if (!isStillActive) {
        return securityHeadersMiddleware(request, NextResponse.redirect(new URL('/subscribe', request.url)))
      }
    }

    // Allow access for incomplete status (payment processing)
    if (userData.subscription_status === 'incomplete') {
      return securedResponse
    }

    if (!isValidSubscriptionStatus(userData.subscription_status)) {
      return securityHeadersMiddleware(request, NextResponse.redirect(new URL('/subscribe', request.url)))
    }
  }

  // Redirect authenticated users with an active subscription away from /subscribe → /dashboard
  if (pathname.startsWith('/subscribe') && user && userData) {
    if (userData.is_suspended) {
      return securityHeadersMiddleware(request, NextResponse.redirect(new URL('/auth/suspended', request.url)))
    }

    // Mirror the dashboard middleware exactly: only redirect to /dashboard when
    // the user would actually be allowed in (avoids a /subscribe ↔ /dashboard loop
    // for canceled users whose period has expired).
    const hasValidSub =
      userData.subscription_status === 'active' ||
      userData.subscription_status === 'incomplete' ||
      (userData.subscription_status === 'canceled' &&
        isCancelledSubscriptionActive(userData.subscription_status, userData.subscription_period_end))

    if (hasValidSub) {
      return securityHeadersMiddleware(request, NextResponse.redirect(new URL('/dashboard', request.url)))
    }
  }

  // Redirect authenticated users away from auth pages (but allow callback redirects with messages)
  if (pathname.startsWith('/auth/') && user) {
    // Allow auth pages with URL parameters (messages from callback)
    if (request.nextUrl.searchParams.has('message')) {
      return securedResponse
    }

    if (userData) {
      // Check if cancelled subscription is still within paid period
      if (userData.subscription_status === 'canceled' && !isCancelledSubscriptionActive(userData.subscription_status, userData.subscription_period_end)) {
        return securityHeadersMiddleware(request, NextResponse.redirect(new URL('/subscribe', request.url)))
      }
      
      // Allow access for incomplete status (payment processing) or valid subscription
      if (userData.subscription_status === 'incomplete' || isValidSubscriptionStatus(userData.subscription_status)) {
        return securityHeadersMiddleware(request, NextResponse.redirect(new URL('/dashboard', request.url)))
      }
    }
    
    return securityHeadersMiddleware(request, NextResponse.redirect(new URL('/subscribe', request.url)))
  }

  return securedResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
