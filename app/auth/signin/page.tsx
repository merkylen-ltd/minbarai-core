'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import FormInput from '@/components/forms/FormInput'
import LoadingButton from '@/components/forms/LoadingButton'
import { validateEmail, validatePassword } from '@/lib/auth/password-strength'
import { useDialog } from '@/lib/hooks/useDialog'
import { AlertDialog } from '@/components/ui/dialog'

function SignInForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [emailError, setEmailError] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [touched, setTouched] = useState({ email: false, password: false })
  
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const { alertDialog, showAlert, closeAlert } = useDialog()

  // Handle URL parameters for messages and pre-filled email
  useEffect(() => {
    const message = searchParams.get('message')
    const emailParam = searchParams.get('email')
    
    // Validate and sanitize message parameter
    if (message) {
      // Only allow specific predefined messages to prevent XSS
      const allowedMessages = [
        'No account found with this email. Please sign up first.',
        'Account already exists. Please sign in instead.',
        'Please check your email and click the verification link before signing in.',
        'You have made too many sign-in attempts. Please wait a few minutes before trying again.'
      ]
      
      const isValidMessage = allowedMessages.some(allowed => message.includes(allowed))
      
      if (isValidMessage) {
        // Show dialog for URL messages instead of inline error
        showAlert(
          'Authentication Error',
          message,
          {
            variant: message.includes('Account already exists') || message.includes('Please sign in instead') ? 'info' : 'destructive',
            buttonText: 'OK'
          }
        )
      } else {
        console.warn('Invalid message parameter detected:', message)
      }
    }
    
    // Validate and sanitize email parameter
    if (emailParam) {
      // Basic email validation to prevent injection
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      // Additional safety checks
      const hasDangerousChars = /<|>|"|'|`|\\|script|javascript|onerror|onload/i.test(emailParam)
      
      if (emailRegex.test(emailParam) && emailParam.length <= 254 && !hasDangerousChars) {
        setEmail(emailParam)
        setTouched(prev => ({ ...prev, email: true }))
      } else {
        console.warn('Invalid or potentially dangerous email parameter detected:', emailParam)
      }
    }
  }, [searchParams, showAlert])

  // Real-time email validation
  useEffect(() => {
    if (email && touched.email) {
      const emailValidation = validateEmail(email)
      if (!emailValidation.isValid) {
        setEmailError(emailValidation.errors[0])
      } else {
        setEmailError('')
      }
    }
  }, [email, touched.email])

  // Real-time password validation
  useEffect(() => {
    if (password && touched.password) {
      const passwordValidation = validatePassword(password)
      if (!passwordValidation.isValid) {
        setPasswordError(passwordValidation.errors[0])
      } else {
        setPasswordError('')
      }
    }
  }, [password, touched.password])

  // Clear auth error when form changes
  useEffect(() => {
    if (error) {
      setError('')
    }
  }, [email, password, error])

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Prevent concurrent submissions
    if (loading) {
      return
    }
    
    setLoading(true)
    setError('')

    // Validate form
    const emailValidation = validateEmail(email)
    const passwordValidation = validatePassword(password)

    if (!emailValidation.isValid) {
      setEmailError(emailValidation.errors[0])
      setLoading(false)
      return
    }

    if (!passwordValidation.isValid) {
      setPasswordError(passwordValidation.errors[0])
      setLoading(false)
      return
    }

    try {
      // Add timeout to prevent hanging requests
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout
      
      const response = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
        }),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)
      const data = await response.json()

      if (!response.ok) {
        // Handle specific authentication errors with appropriate dialogs
        let errorTitle = 'Sign In Failed'
        let errorMessage = data.message || data.error || 'An error occurred'
        let variant: 'destructive' | 'warning' | 'info' = 'destructive'

        if (response.status === 429) {
          errorTitle = 'Too Many Attempts'
          errorMessage = 'You have made too many sign-in attempts. Please wait a few minutes before trying again.'
          variant = 'warning'
        } else if (response.status === 423) {
          errorTitle = 'Account Locked'
          errorMessage = data.message || 'Your account has been temporarily locked due to too many failed sign-in attempts.'
          variant = 'warning'
        } else if (response.status === 401) {
          errorTitle = 'Invalid Credentials'
          // Show remaining attempts if provided
          if (data.remainingAttempts !== undefined && data.remainingAttempts <= 2 && data.remainingAttempts > 0) {
            errorMessage = `The email or password you entered is incorrect. ${data.remainingAttempts} attempt${data.remainingAttempts === 1 ? '' : 's'} remaining before account lockout.`
          } else {
            errorMessage = data.error || 'The email or password you entered is incorrect. Please check your credentials and try again.'
          }
          variant = 'warning'
        } else if (response.status === 403 && data.message?.includes('verification')) {
          errorTitle = 'Email Not Verified'
          errorMessage = 'Please check your email and click the verification link before signing in.'
          variant = 'info'
        } else if (response.status === 403 && data.redirectTo) {
          // Account setup incomplete - redirect to subscribe
          router.push(data.redirectTo)
          return
        }

        showAlert(errorTitle, errorMessage, {
          variant,
          buttonText: 'OK'
        })
      } else if (data.success) {
        // Successful sign-in
        router.push(data.redirectTo || '/dashboard')
      }
    } catch (err) {
      console.error('Sign-in error:', err)
      
      // Handle different types of errors
      let errorTitle = 'Unexpected Error'
      let errorMessage = 'An unexpected error occurred. Please try again.'
      
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          errorTitle = 'Request Timeout'
          errorMessage = 'The sign-in request took too long. Please check your connection and try again.'
        } else if (err.message.includes('fetch')) {
          errorTitle = 'Connection Error'
          errorMessage = 'Unable to connect to the server. Please check your internet connection.'
        }
      }
      
      showAlert(
        errorTitle,
        errorMessage,
        {
          variant: 'destructive',
          buttonText: 'OK'
        }
      )
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    // Prevent concurrent submissions
    if (loading) {
      return
    }
    
    setLoading(true)
    setError('')

    try {
      // Use environment variable for production, fallback to window.location.origin
      // Support both Cloud Run and custom domain URLs
      const isProduction = window.location.hostname === 'minbarai.com' || 
                          window.location.hostname.includes('minbarai-pro-') ||
                          window.location.hostname.includes('minbarai-dev-')
      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin
      const redirectTo = `${baseUrl}/auth/callback?next=/dashboard&action=signin`
      
      console.log('Environment check:', {
        NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
        windowOrigin: window.location.origin,
        isProduction,
        finalBaseUrl: baseUrl,
        redirectTo
      })
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      })

      if (error) {
        showAlert(
          'Google Sign In Failed',
          error.message,
          {
            variant: 'destructive',
            buttonText: 'OK'
          }
        )
        setLoading(false)
      }
    } catch (err) {
      showAlert(
        'Unexpected Error',
        'An unexpected error occurred during Google sign in. Please try again.',
        {
          variant: 'destructive',
          buttonText: 'OK'
        }
      )
      setLoading(false)
    }
  }

  const emailIcon = (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
    </svg>
  )

  const lockIcon = (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  )

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-primary-gradient">
      <div className="w-full max-w-md mx-auto">
        <div className="card">
          <div className="text-center mb-6">
            <h2 className="font-display font-heading text-fluid-2xl text-neutral-0 leading-snug tracking-tight mb-2">
              Welcome Back
            </h2>
            <p className="text-neutral-50 text-fluid-sm">
              Sign in to your MinbarAI account
            </p>
          </div>


          <form onSubmit={handleSignIn} className="space-y-4">
            <FormInput
              label="Email Address"
              type="email"
              name="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setTouched(prev => ({ ...prev, email: true }))}
              error={touched.email ? emailError : undefined}
              placeholder="Enter your email address"
              icon={emailIcon}
              required
              autoComplete="email"
            />

            <FormInput
              label="Password"
              type={showPassword ? 'text' : 'password'}
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={() => setTouched(prev => ({ ...prev, password: true }))}
              error={touched.password ? passwordError : undefined}
              placeholder="Enter your password"
              icon={lockIcon}
              showPasswordToggle
              onPasswordToggle={() => setShowPassword(!showPassword)}
              required
              autoComplete="current-password"
            />

            <div className="flex items-center justify-end">
              <Link
                href="/auth/forgot-password"
                className="text-accent-400 hover:text-accent-300 transition-colors text-fluid-xs font-body"
              >
                Forgot password?
              </Link>
            </div>

            <LoadingButton
              type="submit"
              fullWidth
              isLoading={loading}
              loadingText="Signing in..."
              disabled={loading}
            >
              Sign In
            </LoadingButton>

            {/* Recovery Link */}
            <div className="text-center text-sm text-neutral-500 mt-4">
              <Link 
                href="/auth/resend-confirmation" 
                className="text-accent-400 hover:text-accent-300 transition-colors"
              >
                Didn't receive confirmation email?
              </Link>
            </div>
          </form>

          {/* Social Login */}
          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-accent-500/20"></div>
              </div>
              <div className="relative flex justify-center text-fluid-xs">
                <span className="px-2 bg-primary-700 text-neutral-400">Or continue with</span>
              </div>
            </div>

            <div className="mt-4">
              <LoadingButton
                type="button"
                variant="outline"
                fullWidth
                onClick={handleGoogleSignIn}
                isLoading={loading}
                disabled={loading}
                icon={
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                }
              >
                Continue with Google
              </LoadingButton>
            </div>
          </div>

          {/* Sign Up Link */}
          <div className="mt-6 text-center">
            <p className="text-neutral-400 text-fluid-xs">
              Don&apos;t have an account?{' '}
              <Link
                href="/auth/signup"
                className="text-accent-400 hover:text-accent-300 transition-colors font-body"
              >
                Sign up
              </Link>
            </p>
          </div>

          {/* Legal Links */}
          <div className="mt-4 text-center">
            <p className="text-neutral-500 text-xs">
              By signing in, you agree to our{' '}
              <Link 
                href="/terms" 
                target="_blank"
                className="text-accent-400 hover:text-accent-300 transition-colors underline"
              >
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link 
                href="/privacy" 
                target="_blank"
                className="text-accent-400 hover:text-accent-300 transition-colors underline"
              >
                Privacy Policy
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* Alert Dialog */}
      <AlertDialog
        open={alertDialog.open}
        onOpenChange={closeAlert}
        title={alertDialog.title}
        description={alertDialog.description}
        buttonText={alertDialog.buttonText}
        variant={alertDialog.variant}
        onButtonClick={alertDialog.onButtonClick}
      />
    </div>
  )
}

export default function SignIn() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center px-4 bg-primary-gradient">
        <div className="w-full max-w-md mx-auto">
          <div className="card">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-400 mx-auto"></div>
              <p className="mt-4 text-neutral-400">Loading...</p>
            </div>
          </div>
        </div>
      </div>
    }>
      <SignInForm />
    </Suspense>
  )
}
