'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CreditCard, Calendar, Euro, AlertCircle, CheckCircle, XCircle, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ConfirmationDialog, AlertDialog } from '@/components/ui/dialog'
import { useDialog, dialogConfigs } from '@/lib/hooks/useDialog'
import { createClient } from '@/lib/supabase/client'
import { PRICING_CONFIG, formatPrice } from '@/lib/pricing'
import { getCancelledSubscriptionTimeRemaining, getCancelledSubscriptionEndDate, isCancelledSubscriptionActive } from '@/lib/subscription'
import UnifiedHeader from '@/components/layout/UnifiedHeader'

interface UserData {
  id: string
  email: string
  subscription_status: string
  subscription_id: string
  customer_id: string
  subscription_period_end?: string
  session_limit_minutes?: number
  created_at: string
  updated_at: string
}

interface Subscription {
  id: string
  current_period_end: number
  status: string
}

interface Invoice {
  id: string
  created: number
  description: string
  amount_paid: number
  currency: string
  status: string
  hosted_invoice_url: string
}

export default function BillingPage() {
  const [userData, setUserData] = useState<UserData | null>(null)
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const { confirmationDialog, alertDialog, showConfirmation, showAlert, closeConfirmation, closeAlert, setConfirmationLoading } = useDialog()

  useEffect(() => {
    async function fetchData() {
      try {
        const supabase = createClient()
        
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          router.push('/auth/signin')
          return
        }

        const { data: userData } = await supabase
          .from('users')
          .select('*')
          .eq('id', user.id)
          .single()

        if (!userData) {
          router.push('/auth/signin')
          return
        }

        setUserData(userData)

        // For test users, we don't fetch Stripe data
        if (userData.customer_id && !userData.customer_id.startsWith('cus_test_')) {
          try {
            const response = await fetch('/api/stripe/billing-data', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
            })
            
            if (response.ok) {
              const data = await response.json()
              setSubscription(data.subscription)
              setInvoices(data.invoices)
            }
          } catch (error) {
            console.error('Error fetching Stripe data:', error)
          }
        }
      } catch (error) {
        console.error('Error fetching user data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [router])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-800 to-primary-700 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-accent-400 mx-auto"></div>
          <p className="mt-4 text-neutral-400">Loading billing information...</p>
        </div>
      </div>
    )
  }

  if (!userData) {
    return null
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'canceled':
        return <XCircle className="h-5 w-5 text-red-500" />
      case 'past_due':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />
      default:
        return <AlertCircle className="h-5 w-5 text-gray-500" />
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active':
        return 'Active'
      case 'canceled':
        return 'Canceled'
      case 'past_due':
        return 'Past Due'
      case 'incomplete':
        return 'Incomplete'
      case 'incomplete_expired':
        return 'Expired'
      case 'unpaid':
        return 'Unpaid'
      default:
        return status
    }
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-800 to-primary-700">
      {/* Navigation */}
      <UnifiedHeader 
        variant="billing" 
        userEmail={userData.email}
        showBackButton={true}
        backButtonHref="/dashboard"
        backButtonText="Back to Dashboard"
      />

      {/* Main Content */}
      <main className="pt-24 pb-12">
        <div className="container-custom">
          <div className="max-w-4xl mx-auto space-y-8">
            {/* Beta Notice */}
            <div className="bg-accent-500/10 border border-accent-500/20 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <div className="w-6 h-6 bg-accent-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm font-display">β</span>
                  </div>
                </div>
                <div>
                  <h3 className="text-accent-300 font-heading mb-1">Beta Billing Information</h3>
                  <p className="text-accent-400 text-sm">
                    You're currently on our beta pricing plan. Features and pricing may change as we continue development. 
                    Beta subscribers will be notified of any changes before they take effect.
                  </p>
                </div>
              </div>
            </div>
            {/* Subscription Status */}
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg shadow-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-display text-white">Subscription Status</h2>
                <div className="flex items-center space-x-2">
                  {getStatusIcon(userData.subscription_status)}
                  <span className="font-heading text-white">
                    {getStatusText(userData.subscription_status)}
                  </span>
                </div>
              </div>

              {subscription ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <p className="text-sm text-neutral-400">Plan</p>
                    <div className="flex items-center space-x-2">
                      <p className="font-heading text-white">MinbarAI Pro Beta</p>
                      <span className="inline-flex items-center px-2 py-1 rounded-full bg-accent-500/20 text-accent-400 border border-accent-500/30 text-xs font-body">
                        BETA
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-neutral-400">Price</p>
                    <p className="font-heading text-white flex items-center">
                      <Euro className="h-4 w-4 mr-1" />
                      {formatPrice(PRICING_CONFIG.plans[0].price!)}/month
                    </p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-neutral-400">Next Billing Date</p>
                    <p className="font-heading text-white flex items-center">
                      <Calendar className="h-4 w-4 mr-2" />
                      {formatDate(subscription.current_period_end)}
                    </p>
                  </div>
                </div>
              ) : userData.subscription_status === 'active' && userData.subscription_id?.startsWith('sub_test_') ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <p className="text-sm text-neutral-400">Plan</p>
                    <div className="flex items-center space-x-2">
                      <p className="font-heading text-white">MinbarAI Pro Beta</p>
                      <span className="inline-flex items-center px-2 py-1 rounded-full bg-accent-500/20 text-accent-400 border border-accent-500/30 text-xs font-body">
                        BETA
                      </span>
                      <span className="inline-flex items-center px-2 py-1 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 text-xs font-body">
                        TEST
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-neutral-400">Price</p>
                    <p className="font-heading text-white flex items-center">
                      <Euro className="h-4 w-4 mr-1" />
                      {formatPrice(PRICING_CONFIG.plans[0].price!)}/month
                    </p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-neutral-400">Status</p>
                    <p className="font-heading text-white">
                      Test Environment
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-neutral-400 mb-4">No active subscription found</p>
                  <Link href="/subscribe">
                    <Button className="bg-accent-500 hover:bg-accent-400 text-white">
                      Subscribe Now
                    </Button>
                  </Link>
                </div>
              )}
            </div>

            {/* Cancelled Subscription Notice */}
            {userData.subscription_status === 'canceled' && isCancelledSubscriptionActive(userData.subscription_status, userData.subscription_period_end) && (
              <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-6">
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center">
                      <AlertCircle className="h-5 w-5 text-white" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-orange-300 font-heading text-lg mb-2">
                      Subscription Cancelled
                    </h3>
                    <p className="text-orange-200 text-sm mb-4">
                      Your subscription has been cancelled, but you still have access until your paid period ends.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div className="space-y-1">
                        <p className="text-orange-200 text-sm font-body">Access Ends:</p>
                        <p className="text-orange-100 text-sm">
                          {getCancelledSubscriptionEndDate(userData.subscription_period_end)}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-orange-200 text-sm font-body">Time Remaining:</p>
                        <p className="text-orange-100 text-sm">
                          {getCancelledSubscriptionTimeRemaining(userData.subscription_period_end)}
                        </p>
                      </div>
                    </div>
                    <div className="flex space-x-3">
                      <Link href="/subscribe">
                        <Button className="bg-orange-500 hover:bg-orange-400 text-white">
                          Resubscribe Now
                        </Button>
                      </Link>
                      <Button variant="outline" className="border-orange-500/30 text-orange-300 hover:bg-orange-500/10">
                        Learn More
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Billing Actions */}
            {subscription && userData.subscription_status === 'active' && !userData.subscription_id?.startsWith('sub_test_') && (
              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg shadow-lg p-6">
                <h3 className="text-xl font-display text-white mb-4">Manage Subscription</h3>
                <div className="flex flex-wrap gap-4">
                  <Button
                    onClick={async () => {
                      try {
                        console.log('Attempting to open customer portal for payment method update...')
                        const response = await fetch('/api/stripe/portal', {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                          },
                        })
                        
                        console.log('Portal response status:', response.status)
                        
                        if (!response.ok) {
                          const errorData = await response.json()
                          console.error('Portal API error:', errorData)
                          showAlert(
                            dialogConfigs.error.title,
                            `Unable to open customer portal: ${errorData.error || 'Unknown error'}`,
                            { variant: dialogConfigs.error.variant }
                          )
                          return
                        }
                        
                        const data = await response.json()
                        console.log('Portal response data:', data)
                        
                        if (data.url) {
                          console.log('Opening portal URL:', data.url)
                          window.location.href = data.url
                        } else {
                          console.error('No URL returned from portal API')
                          showAlert(
                            dialogConfigs.error.title,
                            'No portal URL received. Please contact support.',
                            { variant: dialogConfigs.error.variant }
                          )
                        }
                      } catch (error) {
                        console.error('Error opening customer portal:', error)
                        showAlert(
                          dialogConfigs.error.title,
                          'Unable to open customer portal. Please contact support.',
                          { variant: dialogConfigs.error.variant }
                        )
                      }
                    }}
                    className="bg-accent-500 hover:bg-accent-400 text-white border border-accent-500/20 hover:border-accent-400/40 transition-all duration-200 shadow-lg hover:shadow-accent-500/25 hover:shadow-lg"
                  >
                    Update Payment Method
                  </Button>
                  <Button
                    onClick={() => {
                      showConfirmation(
                        dialogConfigs.cancelSubscription.title,
                        dialogConfigs.cancelSubscription.description,
                        async () => {
                          setConfirmationLoading(true)
                          try {
                            const response = await fetch('/api/stripe/cancel-subscription', {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                              },
                            })

                            const data = await response.json()

                            if (response.ok) {
                              showAlert(
                                dialogConfigs.subscriptionCanceled.title,
                                dialogConfigs.subscriptionCanceled.description,
                                {
                                  variant: dialogConfigs.subscriptionCanceled.variant,
                                  onButtonClick: () => {
                                    window.location.href = '/dashboard'
                                  }
                                }
                              )
                            } else {
                              showAlert(
                                dialogConfigs.subscriptionError.title,
                                `Failed to cancel subscription: ${data.error}`,
                                { variant: dialogConfigs.subscriptionError.variant }
                              )
                            }
                          } catch (error) {
                            console.error('Error canceling subscription:', error)
                            showAlert(
                              dialogConfigs.error.title,
                              'An error occurred while canceling your subscription. Please try again.',
                              { variant: dialogConfigs.error.variant }
                            )
                          } finally {
                            setConfirmationLoading(false)
                          }
                        },
                        {
                          confirmText: dialogConfigs.cancelSubscription.confirmText,
                          cancelText: dialogConfigs.cancelSubscription.cancelText,
                          variant: dialogConfigs.cancelSubscription.variant,
                        }
                      )
                    }}
                    className="bg-red-500/20 hover:bg-red-500/30 text-red-400 hover:text-red-300 border border-red-500/30 hover:border-red-500/50 transition-all duration-200 shadow-lg hover:shadow-red-500/25 hover:shadow-lg backdrop-blur-sm"
                  >
                    Cancel Subscription
                  </Button>
                </div>
              </div>
            )}

            {/* Test Environment Notice */}
            {userData.subscription_id?.startsWith('sub_test_') && (
              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg shadow-lg p-6">
                <h3 className="text-xl font-display text-white mb-4">Test Environment</h3>
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                      <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-sm font-display">T</span>
                      </div>
                    </div>
                    <div>
                      <h4 className="text-blue-300 font-heading mb-1">Test User Account</h4>
                      <p className="text-blue-400 text-sm">
                        You're using a test account with 3-hour session limits for development and testing purposes. 
                        This account has access to all features with session duration limits.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Billing History */}
            {invoices.length > 0 && (
              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg shadow-lg p-6">
                <h3 className="text-xl font-display text-white mb-6">Billing History</h3>
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left py-3 px-4 font-heading text-neutral-300">Date</th>
                        <th className="text-left py-3 px-4 font-heading text-neutral-300">Description</th>
                        <th className="text-left py-3 px-4 font-heading text-neutral-300">Amount</th>
                        <th className="text-left py-3 px-4 font-heading text-neutral-300">Status</th>
                        <th className="text-left py-3 px-4 font-heading text-neutral-300">Invoice</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.map((invoice) => (
                        <tr key={invoice.id} className="border-b border-white/5">
                          <td className="py-3 px-4 text-white">
                            {formatDate(invoice.created)}
                          </td>
                          <td className="py-3 px-4 text-white">
                            {invoice.description || 'MinbarAI Pro Subscription'}
                          </td>
                          <td className="py-3 px-4 text-white font-heading">
                            {formatAmount(invoice.amount_paid, invoice.currency)}
                          </td>
                          <td className="py-3 px-4">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-body ${
                              invoice.status === 'paid' 
                                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                : invoice.status === 'open'
                                ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                                : 'bg-red-500/20 text-red-400 border border-red-500/30'
                            }`}>
                              {invoice.status}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            {invoice.hosted_invoice_url ? (
                              <a
                                href={invoice.hosted_invoice_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-accent-400 hover:text-accent-300 font-body"
                              >
                                View
                              </a>
                            ) : (
                              <span className="text-neutral-400">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Support */}
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg shadow-lg p-6">
              <h3 className="text-xl font-display text-white mb-4">Need Help?</h3>
              <p className="text-neutral-400 mb-4">
                If you have any questions about your billing or need assistance, please contact our support team.
              </p>
              <div className="flex flex-wrap gap-4">
                <a
                  href="mailto:support@minberai.com"
                  className="text-accent-400 hover:text-accent-300 font-body"
                >
                  support@minberai.com
                </a>
                <span className="text-neutral-500">•</span>
                <button
                  onClick={async () => {
                    try {
                      console.log('Attempting to open customer portal...')
                      const response = await fetch('/api/stripe/portal', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                        },
                      })
                      
                      console.log('Portal response status:', response.status)
                      
                      if (!response.ok) {
                        const errorData = await response.json()
                        console.error('Portal API error:', errorData)
                        showAlert(
                          dialogConfigs.error.title,
                          `Unable to open customer portal: ${errorData.error || 'Unknown error'}`,
                          { variant: dialogConfigs.error.variant }
                        )
                        return
                      }
                      
                      const data = await response.json()
                      console.log('Portal response data:', data)
                      
                      if (data.url) {
                        console.log('Opening portal URL:', data.url)
                        window.location.href = data.url
                      } else {
                        console.error('No URL returned from portal API')
                        showAlert(
                          dialogConfigs.error.title,
                          'No portal URL received. Please contact support.',
                          { variant: dialogConfigs.error.variant }
                        )
                      }
                    } catch (error) {
                      console.error('Error opening customer portal:', error)
                      showAlert(
                        dialogConfigs.error.title,
                        'Unable to open customer portal. Please contact support.',
                        { variant: dialogConfigs.error.variant }
                      )
                    }
                  }}
                  className="text-accent-400 hover:text-accent-300 font-body cursor-pointer"
                >
                  Stripe Customer Portal
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Custom Dialogs */}
      <ConfirmationDialog
        open={confirmationDialog.open}
        onOpenChange={closeConfirmation}
        title={confirmationDialog.title}
        description={confirmationDialog.description}
        confirmText={confirmationDialog.confirmText}
        cancelText={confirmationDialog.cancelText}
        variant={confirmationDialog.variant}
        onConfirm={confirmationDialog.onConfirm}
        onCancel={confirmationDialog.onCancel}
        loading={confirmationDialog.loading}
      />

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
