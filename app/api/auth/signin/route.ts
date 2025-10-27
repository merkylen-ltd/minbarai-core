import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit, RATE_LIMIT_CONFIGS, getUserRateLimitKey } from '@/lib/auth/rate-limiting'
import { checkAccountLockout, recordFailedAttempt, clearFailedAttempts, ACCOUNT_LOCKOUT_CONFIGS } from '@/lib/auth/account-lockout'
import { sanitizeEmail, validateEmailStrict } from '@/lib/auth/email-validation'
import { authLogger } from '@/lib/auth/secure-logger'
import { cookies } from 'next/headers'

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    // Rate limiting check
    const rateLimitResult = checkRateLimit(request, RATE_LIMIT_CONFIGS.AUTH)
    
    if (!rateLimitResult.allowed) {
      authLogger.rateLimitExceeded(request.ip || 'unknown', '/api/auth/signin')
      return NextResponse.json(
        {
          error: 'Too many sign-in attempts',
          message: 'You have made too many sign-in attempts. Please wait a few minutes before trying again.',
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

    const { email, password } = body

    // Validate input types and presence
    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      return NextResponse.json(
        { error: 'Email and password are required and must be strings' },
        { status: 400 }
      )
    }

    // Check for reasonable length limits
    if (email.length > 320 || password.length > 128) {
      return NextResponse.json(
        { error: 'Email or password exceeds maximum length' },
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

    // Check account lockout before attempting sign-in
    const lockoutResult = checkAccountLockout(sanitizedEmail, ACCOUNT_LOCKOUT_CONFIGS.STANDARD)
    
    if (lockoutResult.isLocked) {
      authLogger.accountLocked(sanitizedEmail, new Date(lockoutResult.lockoutUntil!))
      return NextResponse.json(
        {
          error: 'Account temporarily locked',
          message: `Your account has been temporarily locked due to too many failed sign-in attempts. Please try again in ${Math.ceil(lockoutResult.retryAfter! / 60)} minutes.`,
          retryAfter: lockoutResult.retryAfter,
          lockoutUntil: lockoutResult.lockoutUntil
        },
        {
          status: 423, // 423 Locked
          headers: {
            'Retry-After': lockoutResult.retryAfter?.toString() || '900',
            'X-RateLimit-Limit': RATE_LIMIT_CONFIGS.AUTH.maxAttempts.toString(),
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': new Date(rateLimitResult.resetTime).toISOString()
          }
        }
      )
    }

    // Basic password validation (minimum length check)
    // Full validation is done by Supabase during authentication
    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long' },
        { status: 400 }
      )
    }

    const cookieStore = cookies()
    const supabase = createClient(cookieStore)

    // Attempt sign-in
    const { data, error } = await supabase.auth.signInWithPassword({
      email: sanitizedEmail,
      password,
    })

    if (error) {
      // Log failed attempt for monitoring
      authLogger.authFailure(sanitizedEmail, error.message, 'password')
      
      // Only record failed attempts for invalid credentials
      // Don't penalize users for unverified emails or Supabase rate limits
      let shouldRecordFailedAttempt = true
      
      if (error.message.includes('Email not confirmed') || error.message.includes('Too many requests')) {
        shouldRecordFailedAttempt = false
      }
      
      // Record failed attempt for account lockout if applicable
      const lockoutResult = shouldRecordFailedAttempt 
        ? recordFailedAttempt(sanitizedEmail, ACCOUNT_LOCKOUT_CONFIGS.STANDARD)
        : { isLocked: false, remainingAttempts: ACCOUNT_LOCKOUT_CONFIGS.STANDARD.maxAttempts, lockoutUntil: undefined, retryAfter: undefined }
      
      // Return appropriate error message
      let errorMessage = 'Sign-in failed'
      let statusCode = 401

      if (error.message.includes('Invalid login credentials')) {
        errorMessage = 'Invalid email or password'
        
        // Check if account is now locked after this failed attempt
        if (lockoutResult.isLocked) {
          errorMessage = `Your account has been temporarily locked due to too many failed sign-in attempts. Please try again in ${Math.ceil(lockoutResult.retryAfter! / 60)} minutes.`
          statusCode = 423
        } else if (lockoutResult.remainingAttempts <= 2) {
          errorMessage = `Invalid email or password. ${lockoutResult.remainingAttempts} attempts remaining before account lockout.`
        }
      } else if (error.message.includes('Email not confirmed')) {
        errorMessage = 'Please check your email and click the verification link before signing in'
        statusCode = 403
        // Don't count email verification errors as failed attempts
      } else if (error.message.includes('Too many requests')) {
        errorMessage = 'Too many sign-in attempts. Please wait a few minutes before trying again'
        statusCode = 429
      }

      const responseHeaders: Record<string, string> = {
        'X-RateLimit-Limit': RATE_LIMIT_CONFIGS.AUTH.maxAttempts.toString(),
        'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
        'X-RateLimit-Reset': new Date(rateLimitResult.resetTime).toISOString()
      }

      // Add lockout headers if account is locked
      if (lockoutResult.isLocked) {
        responseHeaders['Retry-After'] = lockoutResult.retryAfter?.toString() || '900'
        responseHeaders['X-Account-Locked'] = 'true'
        responseHeaders['X-Account-Lockout-Until'] = new Date(lockoutResult.lockoutUntil!).toISOString()
      } else {
        responseHeaders['X-Account-Remaining-Attempts'] = lockoutResult.remainingAttempts.toString()
      }

      return NextResponse.json(
        { 
          error: errorMessage,
          details: error.message,
          remainingAttempts: lockoutResult.remainingAttempts,
          lockoutUntil: lockoutResult.lockoutUntil,
          retryAfter: lockoutResult.retryAfter
        },
        { 
          status: statusCode,
          headers: responseHeaders
        }
      )
    }

    if (!data.user) {
      return NextResponse.json(
        { error: 'Sign-in failed - no user data returned' },
        { status: 500 }
      )
    }

    // Check if user exists in database
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, email, subscription_status')
      .eq('id', data.user.id)
      .single()

    if (userError || !userData) {
      authLogger.securityEvent('authenticated_user_not_in_database', {
        userId: data.user.id,
        email: data.user.email,
        error: userError?.message
      })
      return NextResponse.json(
        { 
          error: 'Account setup incomplete',
          message: 'Your account needs to be set up. Please contact support.',
          redirectTo: '/subscribe'
        },
        { status: 403 }
      )
    }

    // Log successful sign-in
    authLogger.authSuccess(data.user.id, data.user.email || sanitizedEmail, 'password')

    // Clear any failed attempts for this account
    clearFailedAttempts(sanitizedEmail)

    return NextResponse.json(
      {
        success: true,
        user: {
          id: data.user.id,
          email: data.user.email,
          subscription_status: userData.subscription_status
        },
        redirectTo: '/dashboard'
      },
      {
        status: 200,
        headers: {
          'X-RateLimit-Limit': RATE_LIMIT_CONFIGS.AUTH.maxAttempts.toString(),
          'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
          'X-RateLimit-Reset': new Date(rateLimitResult.resetTime).toISOString()
        }
      }
    )

  } catch (error) {
    authLogger.error('signin_api', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
