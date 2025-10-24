'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { isValidSubscriptionStatus } from '@/lib/subscription'
import UnifiedHeader from '@/components/layout/UnifiedHeader'

function SuccessPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'checking' | 'success' | 'error'>('checking')
  const [message, setMessage] = useState('Processing your payment...')
  const [retryCount, setRetryCount] = useState(0)
  const [userEmail, setUserEmail] = useState<string>('')
  const maxRetries = 10

  console.log('Success page loaded')

  useEffect(() => {
    const checkSubscriptionStatus = async () => {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        
        if (!user) {
          setStatus('error')
          setMessage('Authentication error. Please sign in again.')
          return
        }

        setUserEmail(user.email || '')

        console.log(`Checking subscription status for user ${user.id}, attempt ${retryCount + 1}`)

        const { data: userData, error } = await supabase
          .from('users')
          .select('subscription_status, subscription_id, customer_id')
          .eq('id', user.id)
          .single()

        if (error) {
          console.error('Error fetching user data:', error)
          if (retryCount < maxRetries) {
            setRetryCount(prev => prev + 1)
            setMessage(`Error checking status, retrying... (${retryCount + 1}/${maxRetries})`)
            setTimeout(() => {
              checkSubscriptionStatus()
            }, 2000)
            return
          }
          setStatus('error')
          setMessage('Error checking subscription status.')
          return
        }

        if (!userData) {
          console.log('User data not found, retrying...')
          if (retryCount < maxRetries) {
            setRetryCount(prev => prev + 1)
            setMessage(`User data not found, retrying... (${retryCount + 1}/${maxRetries})`)
            setTimeout(() => {
              checkSubscriptionStatus()
            }, 2000)
            return
          }
          setStatus('error')
          setMessage('User data not found.')
          return
        }

        console.log('Current subscription status:', userData.subscription_status)
        console.log('Subscription ID:', userData.subscription_id)
        console.log('Customer ID:', userData.customer_id)

        if (isValidSubscriptionStatus(userData.subscription_status)) {
          setStatus('success')
          if (userData.subscription_status === 'active') {
            setMessage('Payment successful! Your subscription is now active. Redirecting to dashboard...')
          } else if (userData.subscription_status === 'incomplete') {
            setMessage('Payment processing complete! Redirecting to dashboard...')
          } else {
            setMessage('Payment successful! Redirecting to dashboard...')
          }
          
          // Redirect to dashboard after a short delay
          setTimeout(() => {
            console.log('Redirecting to dashboard...')
            router.push('/dashboard')
          }, 2000)
        } else if (retryCount < maxRetries) {
          // Still processing, retry after a delay
          setRetryCount(prev => prev + 1)
          setMessage(`Payment processing... (${retryCount + 1}/${maxRetries})`)
          
          setTimeout(() => {
            checkSubscriptionStatus()
          }, 2000)
        } else {
          setStatus('error')
          setMessage('Payment processing is taking longer than expected. Please check your subscription status or contact support.')
        }
      } catch (error) {
        console.error('Error checking subscription:', error)
        if (retryCount < maxRetries) {
          setRetryCount(prev => prev + 1)
          setMessage(`Error occurred, retrying... (${retryCount + 1}/${maxRetries})`)
          setTimeout(() => {
            checkSubscriptionStatus()
          }, 2000)
        } else {
          setStatus('error')
          setMessage('An error occurred while checking your payment status.')
        }
      }
    }

    checkSubscriptionStatus()
  }, [retryCount, router])

  const handleRetry = () => {
    setRetryCount(0)
    setStatus('checking')
    setMessage('Processing your payment...')
  }

  const handleGoToDashboard = () => {
    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-800 to-primary-700">
      {/* Navigation */}
      <UnifiedHeader variant="dashboard" userEmail={userEmail} />

      {/* Main Content */}
      <main className="pt-24 pb-12">
        <div className="flex items-center justify-center min-h-screen">
          <div className="max-w-md w-full mx-4">
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg shadow-lg p-8 text-center">
          {/* Success Icon */}
          <div className="mb-6">
            {status === 'checking' && (
              <div className="w-16 h-16 mx-auto mb-4">
                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-green-500"></div>
              </div>
            )}
            {status === 'success' && (
              <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
            {status === 'error' && (
              <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            )}
          </div>

              {/* Status Message */}
              <h1 className="text-2xl font-display text-white mb-4">
                {status === 'checking' && 'Processing Payment'}
                {status === 'success' && 'Payment Successful!'}
                {status === 'error' && 'Payment Processing Issue'}
              </h1>

              <p className="text-neutral-300 mb-6">
                {message}
              </p>

              {/* Action Buttons */}
              {status === 'success' && (
                <div className="space-y-3">
                  <button
                    onClick={handleGoToDashboard}
                    className="w-full bg-accent-500 hover:bg-accent-400 text-white py-2 px-4 rounded-lg transition-colors"
                  >
                    Go to Dashboard
                  </button>
                </div>
              )}

              {status === 'error' && (
                <div className="space-y-3">
                  <button
                    onClick={handleRetry}
                    className="w-full bg-blue-500 hover:bg-blue-400 text-white py-2 px-4 rounded-lg transition-colors"
                  >
                    Retry Check
                  </button>
                  <button
                    onClick={handleGoToDashboard}
                    className="w-full bg-neutral-600 hover:bg-neutral-500 text-white py-2 px-4 rounded-lg transition-colors"
                  >
                    Go to Dashboard
                  </button>
                </div>
              )}

              {status === 'checking' && (
                <div className="text-sm text-neutral-400">
                  <p>This may take a few moments...</p>
                  <p className="mt-2">Please don't close this window.</p>
                </div>
              )}
            </div>

            {/* Additional Info */}
            <div className="mt-6 text-center">
              <p className="text-sm text-neutral-400">
                Need help?{' '}
                <a href="mailto:support@minberai.com" className="text-accent-400 hover:text-accent-300">
                  Contact Support
                </a>
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default function SuccessPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
      <SuccessPageContent />
    </Suspense>
  )
}
