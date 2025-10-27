import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit, RATE_LIMIT_CONFIGS } from '@/lib/auth/rate-limiting'
import { sanitizeEmail, validateEmailStrict } from '@/lib/auth/email-validation'
import { validatePassword } from '@/lib/auth/password-strength'
import { cookies } from 'next/headers'

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    // Rate limiting check - stricter for sign-up to prevent spam
    const rateLimitResult = checkRateLimit(request, RATE_LIMIT_CONFIGS.AUTH)
    
    if (!rateLimitResult.allowed) {
      console.warn(`Rate limit exceeded for sign-up attempt`)
      return NextResponse.json(
        {
          error: 'Too many sign-up attempts',
          message: 'You have made too many sign-up attempts. Please wait a few minutes before trying again.',
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

    const { email, password, confirmPassword } = body

    // Validate input types and presence
    if (!email || !password || !confirmPassword || 
        typeof email !== 'string' || typeof password !== 'string' || typeof confirmPassword !== 'string') {
      return NextResponse.json(
        { error: 'Email, password, and password confirmation are required and must be strings' },
        { status: 400 }
      )
    }

    // Check for reasonable length limits
    if (email.length > 320 || password.length > 128 || confirmPassword.length > 128) {
      return NextResponse.json(
        { error: 'Input exceeds maximum length' },
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

    // Validate password strength
    const passwordValidation = validatePassword(password)
    
    if (!passwordValidation.isValid) {
      return NextResponse.json(
        { 
          error: 'Password does not meet requirements',
          details: passwordValidation.errors
        },
        { status: 400 }
      )
    }

    // Validate password confirmation
    if (password !== confirmPassword) {
      return NextResponse.json(
        { error: 'Passwords do not match' },
        { status: 400 }
      )
    }

    const cookieStore = cookies()
    const supabase = createClient(cookieStore)

    // Check if user already exists in auth system
    const { data: authUser, error: authUserError } = await supabase.auth.admin.listUsers()

    if (authUser && authUser.users && !authUserError) {
      const existingUser = authUser.users.find(user => user.email === sanitizedEmail)
      
      if (existingUser) {
        // User exists - check if email is confirmed
        if (existingUser.email_confirmed_at) {
          // Verified user - tell them to sign in
          console.warn(`Sign-up attempt with verified email: ${sanitizedEmail}`)
          return NextResponse.json(
            { 
              error: 'Account already exists',
              message: 'An account with this email already exists. Please sign in instead.',
              redirectTo: '/auth/signin',
              showResendOption: false
            },
            { status: 409 } // 409 Conflict
          )
        } else {
          // Unverified user - offer to resend confirmation
          console.warn(`Sign-up attempt with unverified email: ${sanitizedEmail}`)
          return NextResponse.json(
            { 
              error: 'Email not verified',
              message: 'An account with this email exists but is not verified. Would you like us to resend the confirmation email?',
              showResendOption: true,
              email: sanitizedEmail
            },
            { status: 403 } // 403 Forbidden
          )
        }
      }
    }

    // Get the origin for redirect URL
    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL
    const redirectTo = `${origin}/auth/callback?next=/subscribe&action=signup`

    // Attempt sign-up
    const { data, error } = await supabase.auth.signUp({
      email: sanitizedEmail,
      password,
      options: {
        emailRedirectTo: redirectTo,
        data: {
          email: sanitizedEmail,
        }
      }
    })

    if (error) {
      // Log failed attempt for monitoring (use sanitized email)
      console.warn(`Failed sign-up attempt for email: ${sanitizedEmail}, error: ${error.message}`)
      
      // Return appropriate error message
      let errorMessage = 'Sign-up failed'
      let statusCode = 400

      if (error.message.includes('User already registered')) {
        errorMessage = 'An account with this email already exists. Please sign in instead.'
        statusCode = 409
      } else if (error.message.includes('Password')) {
        errorMessage = error.message
        statusCode = 400
      } else if (error.message.includes('Invalid email')) {
        errorMessage = 'Please enter a valid email address'
        statusCode = 400
      } else if (error.message.includes('Too many requests')) {
        errorMessage = 'Too many sign-up attempts. Please wait a few minutes before trying again'
        statusCode = 429
      }

      return NextResponse.json(
        { 
          error: errorMessage,
          details: error.message
        },
        { 
          status: statusCode,
          headers: {
            'X-RateLimit-Limit': RATE_LIMIT_CONFIGS.AUTH.maxAttempts.toString(),
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': new Date(rateLimitResult.resetTime).toISOString()
          }
        }
      )
    }

    if (!data.user) {
      return NextResponse.json(
        { error: 'Sign-up failed - no user data returned' },
        { status: 500 }
      )
    }

    // Log successful sign-up
    console.log(`Successful sign-up for user: ${data.user.email}, email confirmed: ${!!data.user.email_confirmed_at}`)

    // Determine response based on email confirmation
    const requiresEmailConfirmation = !data.user.email_confirmed_at

    return NextResponse.json(
      {
        success: true,
        user: {
          id: data.user.id,
          email: data.user.email,
          emailConfirmed: !!data.user.email_confirmed_at
        },
        requiresEmailConfirmation,
        message: requiresEmailConfirmation 
          ? 'Please check your email and click the confirmation link to complete your registration.'
          : 'Account created successfully! Redirecting...',
        redirectTo: requiresEmailConfirmation ? null : '/subscribe'
      },
      {
        status: 201, // 201 Created
        headers: {
          'X-RateLimit-Limit': RATE_LIMIT_CONFIGS.AUTH.maxAttempts.toString(),
          'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
          'X-RateLimit-Reset': new Date(rateLimitResult.resetTime).toISOString()
        }
      }
    )

  } catch (error) {
    console.error('Sign-up API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

