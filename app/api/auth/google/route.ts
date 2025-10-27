import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { checkRateLimit, RATE_LIMIT_CONFIGS } from '@/lib/auth/rate-limiting'
import { sanitizeEmail, validateEmailStrict } from '@/lib/auth/email-validation'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    // Rate limiting check
    const rateLimitResult = checkRateLimit(request, RATE_LIMIT_CONFIGS.AUTH)
    
    if (!rateLimitResult.allowed) {
      console.warn(`Rate limit exceeded for Google auth check`)
      return NextResponse.json(
        {
          error: 'Too many requests',
          message: 'You have made too many authentication requests. Please wait a few minutes before trying again.',
          retryAfter: rateLimitResult.retryAfter
        },
        {
          status: 429,
          headers: {
            'Retry-After': rateLimitResult.retryAfter?.toString() || '900',
            'X-RateLimit-Limit': RATE_LIMIT_CONFIGS.AUTH.maxAttempts.toString(),
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': new Date(rateLimitResult.resetTime).toISOString()
          }
        }
      )
    }

    let body;
    try {
      body = await request.json()
    } catch (parseError) {
      return NextResponse.json(
        { error: 'Invalid request format' },
        { status: 400 }
      )
    }

    const { email, action } = body
    
    // Validate input types and presence
    if (!email || !action || typeof email !== 'string' || typeof action !== 'string') {
      return NextResponse.json(
        { error: 'Email and action are required and must be strings' },
        { status: 400 }
      )
    }

    // Validate action parameter
    if (!['signin', 'signup'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be "signin" or "signup"' },
        { status: 400 }
      )
    }

    // Sanitize and validate email
    const sanitizedEmail = sanitizeEmail(email)
    const emailValidation = validateEmailStrict(sanitizedEmail)
    
    if (!emailValidation.isValid) {
      return NextResponse.json(
        { 
          error: 'Invalid email',
          details: emailValidation.errors[0]
        },
        { status: 400 }
      )
    }

    const cookieStore = cookies()
    const supabase = createClient(cookieStore)

    // Check if user exists in our users table (use sanitized email)
    const { data: existingUser, error: userError } = await supabase
      .from('users')
      .select('id, email, subscription_status')
      .eq('email', sanitizedEmail)
      .single()

    if (userError && userError.code !== 'PGRST116') {
      // PGRST116 is "not found" error, which is expected for new users
      console.error('Error checking user existence:', userError)
      return NextResponse.json(
        { error: 'Failed to check user status' },
        { status: 500 }
      )
    }

    const userExists = !!existingUser

    // Determine the appropriate redirect based on user existence and action
    let redirectTo = '/dashboard'
    let message = ''

    if (action === 'signin') {
      if (userExists) {
        redirectTo = '/dashboard'
        message = 'Welcome back! Redirecting to your dashboard...'
      } else {
        redirectTo = '/auth/signup'
        message = 'No account found with this email. Please sign up first.'
      }
    } else if (action === 'signup') {
      if (userExists) {
        redirectTo = '/auth/signin'
        message = 'Account already exists. Please sign in instead.'
      } else {
        redirectTo = '/subscribe'
        message = 'Welcome! Let\'s set up your account.'
      }
    }

    return NextResponse.json({
      success: true,
      userExists,
      redirectTo,
      message,
      user: existingUser || null
    })

  } catch (error) {
    console.error('Google auth check error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
