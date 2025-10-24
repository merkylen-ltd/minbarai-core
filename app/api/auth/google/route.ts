import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const { email, action } = await request.json()
    
    if (!email || !action) {
      return NextResponse.json(
        { error: 'Email and action are required' },
        { status: 400 }
      )
    }

    const cookieStore = cookies()
    const supabase = createClient(cookieStore)

    // Check if user exists in our users table
    const { data: existingUser, error: userError } = await supabase
      .from('users')
      .select('id, email, subscription_status')
      .eq('email', email)
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
