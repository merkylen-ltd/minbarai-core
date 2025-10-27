'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { AlertCircle, ArrowLeft, Shield, Clock, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Suspense } from 'react'

function AuthCodeErrorContent() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error')
  const description = searchParams.get('description')

  const getErrorInfo = () => {
    switch (error) {
      case 'oauth_error':
        return {
          icon: <XCircle className="h-6 w-6" />,
          title: 'OAuth Authentication Error',
          message: description || 'There was an error with Google authentication.',
          suggestions: [
            'Try signing in again',
            'Check your internet connection',
            'Clear your browser cache and cookies'
          ]
        }
      case 'rate_limit_exceeded':
        return {
          icon: <Clock className="h-6 w-6" />,
          title: 'Too Many Attempts',
          message: 'You have made too many authentication attempts. Please wait a few minutes before trying again.',
          suggestions: [
            'Wait 15 minutes before trying again',
            'Check your internet connection',
            'Contact support if the issue persists'
          ]
        }
      case 'invalid_action':
      case 'invalid_redirect':
        return {
          icon: <Shield className="h-6 w-6" />,
          title: 'Security Error',
          message: 'Invalid authentication parameters detected.',
          suggestions: [
            'Try signing in from the main page',
            'Clear your browser cache',
            'Contact support if the issue persists'
          ]
        }
      case 'session_exchange_failed':
      case 'session_exception':
        return {
          icon: <AlertCircle className="h-6 w-6" />,
          title: 'Session Error',
          message: 'Failed to establish your session. This could be due to network issues or expired tokens.',
          suggestions: [
            'Try signing in again',
            'Check your internet connection',
            'Clear your browser cache and cookies'
          ]
        }
      case 'no_user_data':
        return {
          icon: <AlertCircle className="h-6 w-6" />,
          title: 'User Data Error',
          message: 'Unable to retrieve your user information after authentication.',
          suggestions: [
            'Try signing in again',
            'Contact support if the issue persists'
          ]
        }
      case 'user_creation_failed':
        return {
          icon: <AlertCircle className="h-6 w-6" />,
          title: 'Account Creation Failed',
          message: description || 'Failed to create your user account. This may be due to a temporary issue.',
          suggestions: [
            'Try signing up again',
            'Contact support if the issue persists',
            'Check your internet connection'
          ]
        }
      case 'email_not_confirmed':
        return {
          icon: <AlertCircle className="h-6 w-6" />,
          title: 'Email Not Confirmed',
          message: description || 'Your email address has not been confirmed yet. Please check your email and click the confirmation link.',
          suggestions: [
            'Check your email inbox and spam folder',
            'Click the confirmation link in the email',
            'Request a new confirmation email if the link expired',
            'Contact support if you need help'
          ]
        }
      default:
        return {
          icon: <AlertCircle className="h-6 w-6" />,
          title: 'Authentication Error',
          message: 'There was an error processing your authentication. This could be due to:',
          suggestions: [
            'Expired or invalid confirmation link',
            'Network connectivity issues',
            'Email confirmation already used'
          ]
        }
    }
  }

  const errorInfo = getErrorInfo()

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-primary-gradient">
      <div className="max-w-md w-full">
        <div className="card">
          <div className="flex items-center justify-center mb-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-red-500/10 text-red-500">
              {errorInfo.icon}
            </div>
          </div>
          
          <h1 className="text-2xl font-display text-neutral-0 mb-4 text-center">
            {errorInfo.title}
          </h1>
          
          <p className="text-neutral-50 mb-6 text-center">
            {errorInfo.message}
          </p>
          
          <ul className="text-left text-neutral-50 mb-6 space-y-2">
            {errorInfo.suggestions.map((suggestion, index) => (
              <li key={index}>• {suggestion}</li>
            ))}
          </ul>
          
          <div className="space-y-4">
            <Button asChild className="w-full">
              <Link href="/auth/signin">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Sign In
              </Link>
            </Button>
            
            <Button variant="outline" asChild className="hidden w-full">
              <Link href="/auth/signup">
                Try Signing Up Again
              </Link>
            </Button>
          </div>
          
          <div className="mt-6 text-sm text-neutral-400 text-center">
            <p>
              Need help?{' '}
              <a href="mailto:support@minberai.com" className="text-accent-400 hover:text-accent-300">
                Contact support
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AuthCodeError() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center px-4 bg-primary-gradient">
        <div className="max-w-md w-full">
          <div className="card">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-400 mx-auto"></div>
              <p className="mt-4 text-neutral-400">Loading...</p>
            </div>
          </div>
        </div>
      </div>
    }>
      <AuthCodeErrorContent />
    </Suspense>
  )
}
