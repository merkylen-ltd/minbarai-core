import { NextResponse, type NextRequest } from 'next/server'
import { createMiddlewareClient } from '@/lib/supabase/server'
import { isValidSubscriptionStatus, isCancelledSubscriptionActive } from '@/lib/subscription'

export async function middleware(request: NextRequest) {
  const response = NextResponse.next()
  const supabase = createMiddlewareClient(request, response)

  // Refresh session if expired - required for Server Components
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const { pathname } = request.nextUrl

  // Protect dashboard routes
  if (pathname.startsWith('/dashboard')) {
    console.log(`Middleware: Dashboard route accessed: ${pathname}`)
    if (!session) {
      console.log('Middleware: No session, redirecting to signin')
      return NextResponse.redirect(new URL('/auth/signin', request.url))
    }

    // Check subscription status
    console.log(`Middleware: Checking user ${session.user.id} in database`)
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', session.user.id)
      .single()

    if (userError) {
      console.log('Middleware: Database error:', userError)
    }

    console.log('Middleware: User data from database:', user)

    if (!user) {
      console.log('Middleware: User not found in database, redirecting to subscribe')
      return NextResponse.redirect(new URL('/subscribe', request.url))
    }

    console.log(`Middleware: User subscription status: ${user.subscription_status}`)

    // Check if cancelled subscription is still within paid period
    if (user.subscription_status === 'canceled') {
      const isStillActive = isCancelledSubscriptionActive(user.subscription_status, user.subscription_period_end)
      console.log(`Middleware: Cancelled subscription check - period_end: ${user.subscription_period_end}, still_active: ${isStillActive}`)
      if (!isStillActive) {
        console.log('Middleware: Cancelled subscription period ended, redirecting to subscribe')
        return NextResponse.redirect(new URL('/subscribe', request.url))
      } else {
        console.log('Middleware: Cancelled subscription still within paid period, allowing access')
      }
    }

    // Allow access for incomplete status (payment processing)
    if (user.subscription_status === 'incomplete') {
      console.log('Middleware: Payment processing, allowing access')
      // Allow access during payment processing
      return response
    }

    if (!isValidSubscriptionStatus(user.subscription_status)) {
      console.log(`Middleware: Invalid subscription status: ${user.subscription_status}, redirecting to subscribe`)
      return NextResponse.redirect(new URL('/subscribe', request.url))
    }

    console.log('Middleware: Access granted to dashboard')
  }

  // Redirect authenticated users away from auth pages (but allow callback redirects with messages)
  if (pathname.startsWith('/auth/') && session) {
    // Allow auth pages with URL parameters (messages from callback)
    if (request.nextUrl.searchParams.has('message')) {
      console.log('Middleware: Allowing auth page with message parameter')
      return response
    }

    // Check if user has valid subscription
    const { data: user } = await supabase
      .from('users')
      .select('subscription_status, subscription_period_end')
      .eq('id', session.user.id)
      .single()

    if (user) {
      // Check if cancelled subscription is still within paid period
      if (user.subscription_status === 'canceled' && !isCancelledSubscriptionActive(user.subscription_status, user.subscription_period_end)) {
        return NextResponse.redirect(new URL('/subscribe', request.url))
      }
      
      // Allow access for incomplete status (payment processing) or valid subscription
      if (user.subscription_status === 'incomplete' || isValidSubscriptionStatus(user.subscription_status)) {
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
    }
    
    return NextResponse.redirect(new URL('/subscribe', request.url))
  }

  return response
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
