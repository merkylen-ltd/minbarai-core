import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit, RATE_LIMIT_CONFIGS } from '@/lib/auth/rate-limiting'
import { sanitizeEmail, validateEmailStrict } from '@/lib/auth/email-validation'
import { cookies } from 'next/headers'

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    // Stricter rate limiting for resend (prevent abuse)
    const rateLimitResult = checkRateLimit(request, {
      ...RATE_LIMIT_CONFIGS.AUTH,
      maxAttempts: 3, // Only 3 attempts
      windowMs: 3600000 // Per hour
    })
    
    if (!rateLimitResult.allowed) {
      console.warn(`Rate limit exceeded for resend confirmation attempt`)
      return NextResponse.json(
        { 
          error: 'Too many resend attempts', 
          message: 'You have made too many resend attempts. Please wait an hour before trying again.',
          retryAfter: rateLimitResult.retryAfter 
        },
        { 
          status: 429,
          headers: {
            'Retry-After': rateLimitResult.retryAfter?.toString() || '3600',
            'X-RateLimit-Limit': '3',
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

    const { email } = body

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    // Check for reasonable length limits
    if (email.length > 320) {
      return NextResponse.json(
        { error: 'Email exceeds maximum length' },
        { status: 400 }
      )
    }

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

    // Check if user exists and is unverified
    const { data: users, error: userError } = await supabase.auth.admin.listUsers()

    if (userError || !users || !users.users) {
      // Don't reveal if email exists - security best practice
      console.log(`Resend confirmation requested for non-existent email: ${sanitizedEmail}`)
      return NextResponse.json({
        success: true,
        message: 'If an unverified account exists with this email, a confirmation link has been sent.'
      }, { status: 200 })
    }

    const user = users.users.find(u => u.email === sanitizedEmail)
    
    if (!user) {
      // Don't reveal if email exists - security best practice
      console.log(`Resend confirmation requested for non-existent email: ${sanitizedEmail}`)
      return NextResponse.json({
        success: true,
        message: 'If an unverified account exists with this email, a confirmation link has been sent.'
      }, { status: 200 })
    }

    // Only resend if email is not confirmed
    if (user.email_confirmed_at) {
      // Email already confirmed - tell them to sign in
      console.log(`Resend confirmation requested for verified email: ${sanitizedEmail}`)
      return NextResponse.json({
        error: 'Email already verified',
        message: 'Your email is already verified. Please sign in.',
        redirectTo: '/auth/signin'
      }, { status: 400 })
    }

    // Resend confirmation email
    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL
    const redirectTo = `${origin}/auth/callback?next=/subscribe&action=signup`
    
    const { error: resendError } = await supabase.auth.resend({
      type: 'signup',
      email: sanitizedEmail,
      options: {
        emailRedirectTo: redirectTo
      }
    })

    if (resendError) {
      console.error(`Failed to resend confirmation for ${sanitizedEmail}:`, resendError.message)
      return NextResponse.json(
        { 
          error: 'Failed to resend confirmation email',
          details: resendError.message
        },
        { status: 500 }
      )
    }

    console.log(`Confirmation email resent successfully for: ${sanitizedEmail}`)
    return NextResponse.json({
      success: true,
      message: 'Confirmation email has been resent. Please check your inbox.'
    }, { 
      status: 200,
      headers: {
        'X-RateLimit-Limit': '3',
        'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
        'X-RateLimit-Reset': new Date(rateLimitResult.resetTime).toISOString()
      }
    })

  } catch (error) {
    console.error('Resend confirmation error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
