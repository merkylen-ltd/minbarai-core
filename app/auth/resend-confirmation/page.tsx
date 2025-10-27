'use client'

import { useState, Suspense } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import FormInput from '@/components/forms/FormInput'
import LoadingButton from '@/components/forms/LoadingButton'
import { validateEmail } from '@/lib/auth/password-strength'
import { useDialog } from '@/lib/hooks/useDialog'
import { AlertDialog } from '@/components/ui/dialog'

function ResendConfirmationForm() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [emailError, setEmailError] = useState('')
  const [touched, setTouched] = useState(false)
  
  const router = useRouter()
  const { alertDialog, showAlert, closeAlert } = useDialog()

  // Real-time email validation
  const handleEmailChange = (value: string) => {
    setEmail(value)
    setTouched(true)
    
    if (value && touched) {
      const emailValidation = validateEmail(value)
      if (!emailValidation.isValid) {
        setEmailError(emailValidation.errors[0])
      } else {
        setEmailError('')
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (loading) return
    
    setLoading(true)
    setEmailError('')

    // Validate email
    const emailValidation = validateEmail(email)
    if (!emailValidation.isValid) {
      setEmailError(emailValidation.errors[0])
      setLoading(false)
      return
    }

    try {
      const response = await fetch('/api/auth/resend-confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })

      const data = await response.json()

      if (response.ok) {
        showAlert('Email Sent', data.message, {
          variant: 'info',
          buttonText: 'OK',
          onConfirm: () => router.push('/auth/signin')
        })
      } else {
        if (response.status === 400 && data.redirectTo) {
          // Email already verified - redirect to sign in
          showAlert('Email Already Verified', data.message, {
            variant: 'info',
            buttonText: 'Go to Sign In',
            onConfirm: () => router.push(data.redirectTo)
          })
        } else {
          showAlert('Error', data.error || 'Failed to resend email', {
            variant: 'destructive',
            buttonText: 'OK'
          })
        }
      }
    } catch (error) {
      showAlert('Error', 'Failed to resend confirmation email', {
        variant: 'destructive',
        buttonText: 'OK'
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-800 via-primary-900 to-primary-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <svg className="w-12 h-12 text-accent-400" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="faceFront" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#26a69a" stop-opacity="1"/>
                  <stop offset="100%" stop-color="#55a39a" stop-opacity="0.8"/>
                </linearGradient>
                <linearGradient id="faceSide" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#55a39a" stop-opacity="0.7"/>
                  <stop offset="100%" stop-color="#70b3aa" stop-opacity="0.5"/>
                </linearGradient>
                <linearGradient id="faceTop" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#70b3aa" stop-opacity="0.6"/>
                  <stop offset="100%" stop-color="#8BC3BA" stop-opacity="0.4"/>
                </linearGradient>
              </defs>
              <polygon points="128,160 128,384 256,448 256,224" fill="url(#faceFront)"/>
              <polygon points="256,224 256,448 384,384 384,160" fill="url(#faceSide)"/>
              <polygon points="128,160 256,224 384,160 256,96" fill="url(#faceTop)"/>
            </svg>
            <span className="ml-3 text-2xl font-bold text-accent-400">MinbarAI</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Resend Confirmation Email</h1>
          <p className="text-neutral-400 text-sm">
            Enter your email address and we'll send you a new confirmation link.
          </p>
        </div>

        {/* Form */}
        <div className="bg-primary-800/50 backdrop-blur-sm border border-accent-500/20 rounded-lg p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormInput
              label="Email Address"
              type="email"
              value={email}
              onChange={handleEmailChange}
              placeholder="Enter your email address"
              error={emailError}
              required
              disabled={loading}
            />

            <LoadingButton
              type="submit"
              fullWidth
              isLoading={loading}
              loadingText="Sending..."
              disabled={loading || !!emailError || !email}
            >
              Resend Confirmation Email
            </LoadingButton>
          </form>

          {/* Back to Sign In */}
          <div className="mt-6 text-center">
            <p className="text-neutral-400 text-sm">
              Remember your password?{' '}
              <Link
                href="/auth/signin"
                className="text-accent-400 hover:text-accent-300 transition-colors font-body"
              >
                Sign in
              </Link>
            </p>
          </div>

          {/* Sign Up Link */}
          <div className="mt-4 text-center">
            <p className="text-neutral-400 text-sm">
              Don't have an account?{' '}
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
              By using this service, you agree to our{' '}
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

export default function ResendConfirmation() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-primary-800 via-primary-900 to-primary-950 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    }>
      <ResendConfirmationForm />
    </Suspense>
  )
}
