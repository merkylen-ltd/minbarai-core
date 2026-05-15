'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { validatePassword } from '@/lib/auth/password-strength'
import Link from 'next/link'
import LogoBrand from '@/components/ui/logo-brand'

// Next.js static generation requires useSearchParams to be inside a Suspense
// boundary. Split the component so the outer default-export can wrap it.
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<ResetPasswordLoading />}>
      <ResetPasswordInner />
    </Suspense>
  )
}

function ResetPasswordLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-800 to-primary-700 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-primary-800/30 border border-accent-500/10 rounded-2xl p-8 space-y-6 animate-pulse">
          <div className="h-8 w-40 bg-primary-700/50 rounded mx-auto" />
          <div className="h-4 w-3/4 bg-primary-700/40 rounded mx-auto" />
          <div className="h-12 bg-primary-700/50 rounded" />
          <div className="h-12 bg-primary-700/50 rounded" />
        </div>
      </div>
    </div>
  )
}

function ResetPasswordInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [confirmError, setConfirmError] = useState('')
  const [isValidating, setIsValidating] = useState(true)
  const [validationError, setValidationError] = useState('')

  // Validate that user is in recovery mode (has valid session from recovery link)
  useEffect(() => {
    const validateRecoverySession = async () => {
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser()

        if (userError || !user) {
          setValidationError('Invalid or expired password reset link. Please request a new one.')
          setIsValidating(false)
          return
        }

        const type = searchParams.get('type')
        if (type !== 'recovery') {
          setValidationError('Invalid password reset request.')
          setIsValidating(false)
          return
        }

        setIsValidating(false)
      } catch (err) {
        console.error('Recovery validation error:', err)
        setValidationError('An error occurred. Please try again.')
        setIsValidating(false)
      }
    }

    validateRecoverySession()
  }, [supabase, searchParams])

  // Real-time password validation
  useEffect(() => {
    if (password) {
      const validation = validatePassword(password)
      if (!validation.isValid) {
        setPasswordError(validation.errors[0] || 'Password does not meet requirements')
      } else {
        setPasswordError('')
      }
    } else {
      setPasswordError('')
    }
  }, [password])

  // Real-time confirm password validation
  useEffect(() => {
    if (confirmPassword) {
      if (password !== confirmPassword) {
        setConfirmError('Passwords do not match')
      } else {
        setConfirmError('')
      }
    } else {
      setConfirmError('')
    }
  }, [password, confirmPassword])

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()

    if (loading) return

    const passwordValidation = validatePassword(password)
    if (!passwordValidation.isValid) {
      setPasswordError(passwordValidation.errors[0] || 'Password does not meet requirements')
      return
    }

    if (password !== confirmPassword) {
      setConfirmError('Passwords do not match')
      return
    }

    setLoading(true)
    setError('')
    setSuccess(false)

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: password
      })

      if (updateError) {
        console.error('Password update error:', updateError)
        setError(updateError.message || 'Failed to reset password. Please try again.')
        return
      }

      setSuccess(true)
      setPassword('')
      setConfirmPassword('')

      setTimeout(() => {
        router.push('/dashboard')
      }, 3000)
    } catch (err) {
      console.error('Password reset exception:', err)
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (isValidating) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-primary-gradient">
        <div className="w-full max-w-md mx-auto">
          <div className="card">
            <div className="text-center">
              <div className="mb-6">
                <LogoBrand size="md" className="mx-auto mb-6" />
              </div>
              <p className="text-neutral-300">Validating reset link...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (validationError) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-primary-gradient">
        <div className="w-full max-w-md mx-auto">
          <div className="card">
            <div className="text-center">
              <div className="mb-6">
                <LogoBrand size="md" className="mx-auto mb-6" />
              </div>

              <div className="mb-6">
                <div className="mx-auto w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4v2m0 4v2m0 0H9m3 0h3m0-11a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>

                <h2 className="font-display font-heading text-fluid-2xl text-neutral-0 leading-snug tracking-tight mb-2">
                  Reset Link Expired
                </h2>
                <p className="text-neutral-300 text-fluid-sm">
                  {validationError}
                </p>
              </div>

              <Link
                href="/auth/forgot-password"
                className="inline-block px-6 py-3 bg-accent-500 text-neutral-0 font-semibold rounded-lg hover:bg-accent-400 transition-colors mt-6"
              >
                Request New Reset Link
              </Link>

              <div className="mt-8 pt-6 border-t border-neutral-700">
                <Link href="/auth/signin" className="text-accent-400 hover:text-accent-300 text-sm">
                  Back to sign in
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

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
                <div className="mx-auto w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                </div>

                <h2 className="font-display font-heading text-fluid-2xl text-neutral-0 leading-snug tracking-tight mb-2">
                  Password Reset
                </h2>
                <p className="text-neutral-300 text-fluid-sm">
                  Your password has been successfully reset. Redirecting to your dashboard...
                </p>
              </div>

              <div className="mt-8">
                <button
                  onClick={() => router.push('/dashboard')}
                  className="w-full px-6 py-3 bg-accent-500 text-neutral-0 font-semibold rounded-lg hover:bg-accent-400 transition-colors"
                >
                  Go to Dashboard
                </button>
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
          <div className="text-center mb-8">
            <LogoBrand size="md" className="mx-auto mb-6" />
            <h1 className="font-display font-heading text-fluid-2xl text-neutral-0 leading-snug tracking-tight">
              Reset Password
            </h1>
            <p className="text-neutral-400 text-fluid-sm mt-2">
              Create a new password for your account
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleResetPassword} className="space-y-5">
            <div>
              <label htmlFor="password" className="block text-neutral-300 text-sm font-semibold mb-2">
                New Password
              </label>
              <input
                id="password"
                type="password"
                placeholder="Enter new password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`w-full px-4 py-3 bg-primary-800/50 border rounded-lg text-neutral-0 placeholder-neutral-600 focus:outline-none transition-all ${
                  passwordError
                    ? 'border-red-500/50 focus:border-red-500 focus:ring-2 focus:ring-red-500/20'
                    : 'border-accent-500/20 focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20'
                }`}
              />
              {passwordError && (
                <p className="text-red-400 text-xs mt-1">{passwordError}</p>
              )}
              <ul className="text-neutral-400 text-xs mt-3 space-y-1">
                <li className="flex items-center gap-2">
                  <span className={password.length >= 8 ? 'text-green-400' : 'text-neutral-600'}>✓</span>
                  At least 8 characters
                </li>
                <li className="flex items-center gap-2">
                  <span className={/[A-Z]/.test(password) ? 'text-green-400' : 'text-neutral-600'}>✓</span>
                  One uppercase letter
                </li>
                <li className="flex items-center gap-2">
                  <span className={/[a-z]/.test(password) ? 'text-green-400' : 'text-neutral-600'}>✓</span>
                  One lowercase letter
                </li>
                <li className="flex items-center gap-2">
                  <span className={/[0-9]/.test(password) ? 'text-green-400' : 'text-neutral-600'}>✓</span>
                  One number
                </li>
              </ul>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-neutral-300 text-sm font-semibold mb-2">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={`w-full px-4 py-3 bg-primary-800/50 border rounded-lg text-neutral-0 placeholder-neutral-600 focus:outline-none transition-all ${
                  confirmError
                    ? 'border-red-500/50 focus:border-red-500 focus:ring-2 focus:ring-red-500/20'
                    : 'border-accent-500/20 focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20'
                }`}
              />
              {confirmError && (
                <p className="text-red-400 text-xs mt-1">{confirmError}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || !password || !confirmPassword || !!passwordError || !!confirmError}
              className="w-full px-6 py-3 bg-accent-500 text-neutral-0 font-semibold rounded-lg hover:bg-accent-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors mt-6"
            >
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-neutral-700 text-center">
            <Link href="/auth/signin" className="text-accent-400 hover:text-accent-300 text-sm">
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
