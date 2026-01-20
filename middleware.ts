import { NextResponse, type NextRequest } from 'next/server'
import { createMiddlewareClient } from '@/lib/supabase/server'
import { isValidSubscriptionStatus, isCancelledSubscriptionActive } from '@/lib/subscription'
import { securityHeadersMiddleware } from '@/lib/auth/security-headers'

// Type for user data we need from the database
interface UserSubscriptionData {
  subscription_status: string | null
  subscription_period_end: string | null
}

export async function middleware(request: NextRequest) {
  const response = NextResponse.next()
  
  // Add security headers to all responses
  const securedResponse = securityHeadersMiddleware(request, response)
  
  const supabase = createMiddlewareClient(request, securedResponse)

  // Refresh session if expired - required for Server Components
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const { pathname } = request.nextUrl

  // Early return for paths that don't need user data lookup
  const needsUserCheck = pathname.startsWith('/dashboard') || (pathname.startsWith('/auth/') && session)
  
  // Single database query for routes that need subscription data
  let userData: UserSubscriptionData | null = null
  if (needsUserCheck && session) {
    const { data, error } = await supabase
      .from('users')
      .select('subscription_status, subscription_period_end')
      .eq('id', session.user.id)
      .single()
    
    if (error && error.code !== 'PGRST116') {
      console.error('Middleware: Database error:', error.message)
    }
    userData = data
  }

  // Protect dashboard routes
  if (pathname.startsWith('/dashboard')) {
    if (!session) {
      return securityHeadersMiddleware(request, NextResponse.redirect(new URL('/auth/signin', request.url)))
    }

    if (!userData) {
      return securityHeadersMiddleware(request, NextResponse.redirect(new URL('/subscribe', request.url)))
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

  // Redirect authenticated users away from auth pages (but allow callback redirects with messages)
  if (pathname.startsWith('/auth/') && session) {
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
