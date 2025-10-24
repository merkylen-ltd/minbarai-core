import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import LiveCaptioning from '@/components/dashboard/live-captioning'
import DateTimeDisplay from '@/components/dashboard/DateTimeDisplay'
import UnifiedHeader from '@/components/layout/UnifiedHeader'
import LogoBrand from '@/components/ui/logo-brand'
import Link from 'next/link'
import { isValidSubscriptionStatus, getSubscriptionStatusMessage, getCancelledSubscriptionTimeRemaining, getCancelledSubscriptionEndDate, isCancelledSubscriptionActive } from '@/lib/subscription'

export default async function Dashboard() {
  const cookieStore = cookies()
  const supabase = createClient(cookieStore)

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Enforce authentication - redirect if no user
  if (!user) {
    console.log('Dashboard - No authenticated user, redirecting to signin')
    redirect('/auth/signin')
  }

  // Get user data from database
  const { data: userData } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single()

  console.log('Dashboard - User data:', userData)
  console.log('Dashboard - Subscription status:', userData?.subscription_status)

  // Check subscription status
  if (!userData) {
    console.log('Dashboard - User not found, redirecting to subscribe')
    redirect('/subscribe')
  }

  // Check if cancelled subscription period has expired
  if (userData.subscription_status === 'canceled' && !isCancelledSubscriptionActive(userData.subscription_status, userData.subscription_period_end)) {
    console.log('Dashboard - Cancelled subscription period expired, redirecting to subscribe')
    redirect('/subscribe')
  }

  // Allow access for incomplete status (payment processing) with a warning
  if (userData.subscription_status === 'incomplete') {
    console.log('Dashboard - Payment processing, allowing access with warning')
    // Continue to render dashboard but show processing status
  } else if (!isValidSubscriptionStatus(userData.subscription_status)) {
    console.log('Dashboard - Subscription not valid, redirecting to subscribe')
    redirect('/subscribe')
  }


  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-800 to-primary-700">
      {/* Navigation */}
      <UnifiedHeader variant="dashboard" userEmail={user?.email} />

      {/* Main Content */}
      <main className="pt-24 pb-12">
        <div className="container-custom">
          <div className="mt-8 mb-8">
            {/* Main Title */}
            <div className="mb-8">
              <h1 className="text-4xl lg:text-5xl font-display text-white font-display leading-tight">
                Khutba Live Captioning and Translation
              </h1>
              <p className="text-base text-neutral-400 mt-2 font-body">
                Powered by <span className="text-accent-400 font-heading">MinbarAI.com</span>
              </p>
            </div>
            
            {/* Status and Time Row */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
              {/* Status Indicators */}
              <div className="flex items-center space-x-3">
                <div className={`flex items-center space-x-2 px-3 py-2 rounded-lg ${
                  userData.subscription_status === 'incomplete'
                    ? 'bg-yellow-500/10 border border-yellow-500/20'
                    : userData.subscription_status === 'canceled'
                    ? 'bg-orange-500/10 border border-orange-500/20'
                    : 'bg-green-500/10 border border-green-500/20'
                }`}>
                  <div className={`w-2 h-2 rounded-full ${
                    userData.subscription_status === 'incomplete'
                      ? 'bg-yellow-400'
                      : userData.subscription_status === 'canceled'
                      ? 'bg-orange-400'
                      : 'bg-green-400'
                  }`}></div>
                  <span className={`text-sm font-body ${
                    userData.subscription_status === 'incomplete'
                      ? 'text-yellow-300'
                      : userData.subscription_status === 'canceled'
                      ? 'text-orange-300'
                      : 'text-green-300'
                  }`}>
                    {userData.subscription_status === 'incomplete' ? 'Processing' : 
                     userData.subscription_status === 'canceled' ? 'Subscription Cancelled' : 'Active Subscription'}
                  </span>
                </div>
              </div>
              
              {/* Date and Time Display */}
              <DateTimeDisplay />
            </div>
            
            {/* Beta Notice */}
            <div className="bg-accent-500/10 border border-accent-500/20 rounded-lg p-3 mb-4">
              <p className="text-accent-300 text-sm">
                <strong>Beta Notice:</strong> You're using the beta version of MinbarAI. Some features may be experimental or limited. We appreciate your feedback as we continue to improve the service.
              </p>
            </div>

            {/* Cancelled Subscription Info - Only show if cancelled */}
            {userData.subscription_status === 'canceled' && isCancelledSubscriptionActive(userData.subscription_status, userData.subscription_period_end) && (
              <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-4 mb-4">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0">
                    <svg className="w-5 h-5 text-orange-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-orange-300 font-body text-sm mb-1">
                      Subscription Cancelled
                    </h3>
                    <p className="text-orange-200 text-sm mb-2">
                      Your subscription has been cancelled, but you still have access until your paid period ends.
                    </p>
                    <div className="space-y-1">
                      <p className="text-orange-200 text-sm">
                        <strong>Access ends:</strong> {getCancelledSubscriptionEndDate(userData.subscription_period_end)}
                      </p>
                      <p className="text-orange-200 text-sm">
                        <strong>Time remaining:</strong> {getCancelledSubscriptionTimeRemaining(userData.subscription_period_end)}
                      </p>
                    </div>
                    <div className="mt-3">
                      <Link
                        href="/subscribe"
                        className="inline-flex items-center px-3 py-2 bg-orange-500 hover:bg-orange-400 text-white text-sm font-body rounded-lg transition-colors"
                      >
                        Resubscribe Now
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <LiveCaptioning userId={user?.id || ''} />
        </div>
      </main>
    </div>
  )
}
