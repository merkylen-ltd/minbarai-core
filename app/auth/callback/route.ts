import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic'

// Simple in-memory rate limiting (in production, use Redis or similar)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const windowMs = 15 * 60 * 1000 // 15 minutes
  const maxAttempts = 10 // Max 10 attempts per 15 minutes
  
  const record = rateLimitMap.get(ip)
  
  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs })
    return true
  }
  
  if (record.count >= maxAttempts) {
    return false
  }
  
  record.count++
  return true
}

export async function GET(request: Request) {
  try {
    const { searchParams, origin } = new URL(request.url)
    
    // Rate limiting check
    const clientIP = request.headers.get('x-forwarded-for') || 
                    request.headers.get('x-real-ip') || 
                    'unknown'
    
    if (!checkRateLimit(clientIP)) {
      console.error(`Auth callback: Rate limit exceeded for IP: ${clientIP}`)
      return NextResponse.redirect(`${origin}/auth/auth-code-error?error=rate_limit_exceeded`)
    }

    const code = searchParams.get('code')
    const next = searchParams.get('next') ?? '/dashboard'
    const action = searchParams.get('action') // 'signin' or 'signup'
    const error = searchParams.get('error')
    const errorDescription = searchParams.get('error_description')

    console.log(`Auth callback: action=${action}, next=${next}, code=${code ? 'present' : 'missing'}, error=${error || 'none'}`)

    // Handle OAuth errors first
    if (error) {
      console.error(`Auth callback: OAuth error - ${error}: ${errorDescription}`)
      return NextResponse.redirect(`${origin}/auth/auth-code-error?error=oauth_error&description=${encodeURIComponent(errorDescription || error)}`)
    }

    // Validate action parameter
    if (action && !['signin', 'signup'].includes(action)) {
      console.error(`Auth callback: Invalid action parameter: ${action}`)
      return NextResponse.redirect(`${origin}/auth/auth-code-error?error=invalid_action`)
    }

    // Validate next parameter to prevent open redirects
    const allowedPaths = ['/dashboard', '/subscribe', '/auth/signin', '/auth/signup']
    if (next && !allowedPaths.some(path => next.startsWith(path))) {
      console.error(`Auth callback: Invalid next parameter: ${next}`)
      return NextResponse.redirect(`${origin}/auth/auth-code-error?error=invalid_redirect`)
    }

    // Ensure we have a code parameter
    if (!code) {
      console.error(`Auth callback: No authorization code provided`)
      return NextResponse.redirect(`${origin}/auth/auth-code-error?error=no_code`)
    }

    const cookieStore = cookies()
    const supabase = createClient(cookieStore)
    
    try {
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      
      if (!error) {
        const { data: { user } } = await supabase.auth.getUser()
        
        if (user) {
          console.log(`Auth callback: User authenticated - ${user.email}`)
          
          // Check if user exists in our users table
          const { data: existingUser, error: userError } = await supabase
            .from('users')
            .select('id, email, subscription_status')
            .eq('email', user.email)
            .single()

          console.log(`Auth callback: User existence check - exists: ${!!existingUser}, error: ${userError?.code || 'none'}`)

          // Determine redirect based on user existence and action
          let redirectTo = next

          if (action === 'signin') {
            if (!existingUser) {
              // User doesn't exist, redirect to signup with message
              redirectTo = `/auth/signup?message=${encodeURIComponent('No account found with this email. Please sign up first.')}&email=${encodeURIComponent(user.email || '')}`
              console.log(`Auth callback: New user trying to sign in - redirecting to signup`)
            } else {
              // User exists, proceed to dashboard
              redirectTo = '/dashboard'
              console.log(`Auth callback: Existing user signing in - redirecting to dashboard`)
            }
          } else if (action === 'signup') {
            if (existingUser) {
              // User already exists, redirect to signin with message
              redirectTo = `/auth/signin?message=${encodeURIComponent('Account already exists. Please sign in instead.')}&email=${encodeURIComponent(user.email || '')}`
              console.log(`Auth callback: Existing user trying to sign up - redirecting to signin`)
            } else {
              // New user, ensure they exist in users table and redirect to subscribe
              console.log(`Auth callback: New user signing up - creating user record`)
              
              const { error: upsertError } = await supabase
                .from('users')
                .upsert({
                  id: user.id,
                  email: user.email,
                  subscription_status: null,  // No subscription by default
                  session_limit_minutes: 180  // 3 hours session limit
                }, {
                  onConflict: 'id'  // Handle race conditions
                })
              
              if (upsertError) {
                console.error(`Auth callback: Error creating user record:`, upsertError)
                // If user creation fails, still redirect to subscribe (user might exist from race condition)
                // The middleware will handle the case where user doesn't exist in database
              }
              
              redirectTo = '/subscribe'
              console.log(`Auth callback: New user created - redirecting to subscribe`)
            }
          }

          console.log(`Auth callback: Final redirect to ${redirectTo}`)
          
          // Redirect to the determined URL
          const finalRedirectUrl = `${origin}${redirectTo}`
          console.log(`Auth callback: Redirecting to ${finalRedirectUrl}`)
          return NextResponse.redirect(finalRedirectUrl)
        } else {
          console.error(`Auth callback: No user data after successful session exchange`)
          return NextResponse.redirect(`${origin}/auth/auth-code-error?error=no_user_data`)
        }
      } else {
        console.error(`Auth callback: Session exchange error - ${error.message}`)
        return NextResponse.redirect(`${origin}/auth/auth-code-error?error=session_exchange_failed`)
      }
    } catch (sessionError) {
      console.error(`Auth callback: Session exchange exception:`, sessionError)
      return NextResponse.redirect(`${origin}/auth/auth-code-error?error=session_exception`)
    }
  } catch (error) {
    console.error(`Auth callback: Unexpected error:`, error)
    return NextResponse.redirect(`${origin}/auth/auth-code-error?error=unexpected`)
  }
}
