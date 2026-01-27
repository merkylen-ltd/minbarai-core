'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import FormInput from '@/components/forms/FormInput'
import LoadingButton from '@/components/forms/LoadingButton'
import { validateEmail } from '@/lib/auth/password-strength'
import LogoBrand from '@/components/ui/logo-brand'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [emailError, setEmailError] = useState('')
  const [touched, setTouched] = useState(false)
  const [success, setSuccess] = useState(false)
  const supabase = createClient()

  // Real-time email validation
  useEffect(() => {
    if (email && touched) {
      const emailValidation = validateEmail(email)
      if (!emailValidation.isValid) {
        setEmailError(emailValidation.errors[0])
      } else {
        setEmailError('')
      }
    }
  }, [email, touched])

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (loading) return
    
    setLoading(true)
    setError('')
    setSuccess(false)

    // Validate email
    const emailValidation = validateEmail(email)
    if (!emailValidation.isValid) {
      setEmailError(emailValidation.errors[0])
      setLoading(false)
      return
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      })

      if (error) {
        setError(error.message)
      } else {
        setSuccess(true)
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const emailIcon = (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
    </svg>
  )

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-primary-gradient">
        <div className="w-full max-w-md mx-auto">
          <div className="card">
            <div className="text-center">
              <div className="mb-6">
                <LogoBrand size="md" className="mx-auto mb-6" />
              </div>
              
              <div className="mb-6">
                {/* Success Icon */}
                <div className="mx-auto w-16 h-16 rounded-full bg-accent-500/20 flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-accent-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                
                <h2 className="font-display font-heading text-fluid-2xl text-neutral-0 leading-snug tracking-tight mb-2">
                  Check your email
                </h2>
                <p className="text-neutral-50 text-fluid-sm">
                  We've sent a password reset link to
                </p>
                <p className="text-accent-400 text-fluid-sm font-body mt-1">
                  {email}
                </p>
              </div>

              <div className="space-y-3">
                <p className="text-neutral-400 text-fluid-xs">
                  Didn't receive the email? Check your spam folder or try again.
                </p>
                
                <LoadingButton
                  type="button"
                  variant="outline"
                  fullWidth
                  onClick={() => {
                    setSuccess(false)
                    setEmail('')
                    setTouched(false)
                  }}
                >
                  Send another email
                </LoadingButton>
                
                <Link href="/auth/signin" className="block">
                  <button
                    type="button"
                    className="w-full inline-flex items-center justify-center font-body rounded-button transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-primary-900 px-4 py-3 text-fluid-sm text-neutral-400 hover:text-accent-400 hover:bg-primary-700/30"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    Back to sign in
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-primary-gradient">
      <div className="w-full max-w-md mx-auto">
        <div className="card">
          <div className="text-center mb-6">
            <LogoBrand size="md" className="mx-auto mb-6" />
            
            <h2 className="font-display font-heading text-fluid-2xl text-neutral-0 leading-snug tracking-tight mb-2">
              Reset your password
            </h2>
            <p className="text-neutral-50 text-fluid-sm">
              Enter your email address and we'll send you a link to reset your password.
            </p>
          </div>

          <form onSubmit={handleResetPassword} className="space-y-4">
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-button text-fluid-xs">
                {error}
              </div>
            )}

            <FormInput
              label="Email address"
              type="email"
              name="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setTouched(true)}
              error={touched ? emailError : undefined}
              placeholder="you@example.com"
              icon={emailIcon}
              required
              autoComplete="email"
            />

            <LoadingButton
              type="submit"
              fullWidth
              isLoading={loading}
              loadingText="Sending..."
              disabled={loading || !!emailError}
            >
              Send reset link
            </LoadingButton>
          </form>

          <div className="mt-6 text-center space-y-4">
            <Link
              href="/auth/signin"
              className="inline-flex items-center justify-center space-x-2 text-accent-400 hover:text-accent-300 transition-colors text-fluid-xs font-body"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span>Back to sign in</span>
            </Link>
            
            <p className="text-neutral-500 text-xs">
              By using our service, you agree to our{' '}
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
    </div>
  )
}
