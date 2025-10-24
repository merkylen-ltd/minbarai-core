'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import LoadingButton from '@/components/forms/LoadingButton'
import { SupportContactDialog } from '@/components/ui/dialog'
import { PRICING_CONFIG, getAvailablePlans, formatPrice, calculateDiscountPercentage, type PricingPlan } from '@/lib/pricing'

export default function Subscribe() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null)
  const [supportDialogOpen, setSupportDialogOpen] = useState(false)
  const router = useRouter()

  // Check for canceled parameter
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    if (urlParams.get('canceled') === 'true') {
      setError('Payment was canceled. You can try again anytime.')
    }
  }, [])

  // Get plans from centralized pricing configuration
  const plans = PRICING_CONFIG.plans

  const handleSubscribe = async () => {
    if (!selectedPlan) return

    setLoading(true)
    setError('')

    const plan = plans.find(p => p.id === selectedPlan)
    if (!plan) return

    // Don't allow subscription to coming soon plans
    if (plan.isComingSoon) {
      setError('This plan is coming soon!')
      setLoading(false)
      return
    }

    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          planId: selectedPlan,
          price: plan.price,
          planName: plan.name
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Something went wrong. Please try again.')
        setLoading(false)
        return
      }

      if (data.url) {
        window.location.href = data.url
      } else {
        setError('No checkout URL received. Please try again.')
        setLoading(false)
      }
    } catch (err) {
      console.error('Subscription error:', err)
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  const selectedPlanData = plans.find(plan => plan.id === selectedPlan)

  return (
    <div className="min-h-screen bg-primary-gradient">
      
      <div className="pt-16 pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 overflow-visible">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="font-display font-display text-fluid-4xl text-neutral-0 leading-tight tracking-tight mb-4">
              Choose Your Plan
            </h1>
            <p className="text-fluid-lg text-neutral-50 max-w-2xl mx-auto leading-relaxed mb-4">
              Select the perfect plan for your organization's needs.
            </p>
            <p className="text-neutral-400 text-sm">
              By subscribing, you agree to our{' '}
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

          {/* Error Message */}
          {error && (
            <div className="mb-8 p-4 bg-red-500/10 backdrop-blur-sm border border-red-500/20 rounded-button">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-red-300">{error}</span>
                <button 
                  onClick={() => setError('')}
                  className="ml-auto text-red-400 hover:text-red-300"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* Plan Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12 max-w-6xl mx-auto overflow-visible pt-12">
            {plans.map((plan, index) => (
              <div key={plan.id} className="relative">
                {/* Badge positioned outside card */}
                {plan.isPopular && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 z-20 flex justify-center w-full">
                    <div className="bg-gradient-to-r from-accent-500 to-accent-400 text-neutral-0 px-4 py-1.5 rounded-full text-sm font-body shadow-lg border border-accent-400/20 whitespace-nowrap">
                      Most Popular
                    </div>
                  </div>
                )}

                {plan.isComingSoon && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 z-20 flex justify-center w-full">
                    <div className="bg-gradient-to-r from-neutral-600 to-neutral-500 text-neutral-0 px-4 py-1.5 rounded-full text-sm font-body shadow-lg border border-neutral-500/20 whitespace-nowrap">
                      Coming Soon
                    </div>
                  </div>
                )}

                <div
                  className={`
                    relative 
                    card
                    transition-all 
                    duration-300 
                    overflow-visible
                    ${plan.isComingSoon ? 'cursor-not-allowed' : 'cursor-pointer'}
                    ${selectedPlan === plan.id 
                      ? 'border-accent-500 bg-accent-500/10 shadow-glow' 
                      : 'hover:border-accent-500/50 hover:shadow-glow-xl hover:scale-[1.02]'
                    }
                  `}
                  onClick={() => !plan.isComingSoon && setSelectedPlan(plan.id)}
                >
                  {/* Card Content */}
                <div className={`${plan.isPopular || plan.isComingSoon ? 'pt-12' : 'pt-6'} pb-6 px-6`}>
                  {/* Plan Header */}
                  <div className="text-center mb-6">
                    <h3 className="font-display font-heading text-fluid-2xl text-neutral-0 mb-2">{plan.name}</h3>
                    <p className="text-neutral-50 text-fluid-sm mb-4">{plan.description}</p>
                    
                    {/* Price Display */}
                    <div className="mb-4">
                      {plan.isComingSoon ? (
                        <div className="text-center">
                          <div className="text-fluid-lg font-heading text-neutral-400 mb-2">Coming Soon</div>
                          <div className="text-fluid-sm text-neutral-500">Contact us for pricing</div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center">
                          {plan.originalPrice && plan.price && (
                            <div className="flex items-center space-x-2 mb-1">
                              <span className="text-fluid-sm text-neutral-500 line-through">{formatPrice(plan.originalPrice)}</span>
                              <span className="bg-red-500 text-neutral-0 text-fluid-xs px-2 py-1 rounded-full font-body">
                                {calculateDiscountPercentage(plan.originalPrice, plan.price)}% OFF
                              </span>
                            </div>
                          )}
                          <div className="flex items-baseline justify-center">
                            <span className="text-fluid-4xl font-display text-neutral-0">{formatPrice(plan.price!)}</span>
                            <span className="text-neutral-400 ml-1 text-fluid-sm">/{plan.interval}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Features List */}
                  <div className="space-y-3 mb-6">
                    {plan.features.map((feature, featureIndex) => (
                      <div key={featureIndex} className="flex items-center">
                        <div className="flex-shrink-0 w-5 h-5 bg-accent-500/20 rounded-full flex items-center justify-center mr-3">
                          <svg
                            className="w-3 h-3 text-accent-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        </div>
                        <span className="text-neutral-50 text-fluid-xs">{feature}</span>
                      </div>
                    ))}
                  </div>

                  {/* Usage Limits */}
                  <div className="border-t border-accent-500/20 pt-4 mb-6">
                    <h4 className="text-fluid-sm font-body text-neutral-50 mb-3">Usage Limits</h4>
                    <div className="space-y-2">
                      {plan.limits.minutes && (
                        <div className="flex justify-between text-fluid-xs">
                          <span className="text-neutral-400">Monthly Minutes:</span>
                          <span className="font-body text-neutral-0">{plan.limits.minutes === 999999 ? 'Unlimited' : plan.limits.minutes}</span>
                        </div>
                      )}
                      {plan.limits.languages && (
                        <div className="flex justify-between text-fluid-xs">
                          <span className="text-neutral-400">Languages:</span>
                          <span className="font-body text-neutral-0">{plan.limits.languages}</span>
                        </div>
                      )}
                      {plan.limits.sessions && (
                        <div className="flex justify-between text-fluid-xs">
                          <span className="text-neutral-400">Parallel Sessions:</span>
                          <span className="font-body text-neutral-0">{plan.limits.sessions === 999999 ? 'Unlimited' : plan.limits.sessions}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Selection Button */}
                  {plan.isComingSoon ? (
                    <button
                      disabled
                      className="w-full py-3 rounded-button font-body bg-neutral-600 text-neutral-400 cursor-not-allowed"
                    >
                      Coming Soon
                    </button>
                  ) : (
                    <LoadingButton
                      onClick={() => setSelectedPlan(plan.id)}
            disabled={loading}
                      className={`
                        w-full 
                        py-3 
                        rounded-button 
                        font-body 
                        transition-all 
                        duration-200
                        ${selectedPlan === plan.id
                          ? 'bg-accent-500 text-neutral-0 hover:bg-accent-400'
                          : 'bg-primary-700/30 text-neutral-0 hover:bg-primary-700/50 border border-accent-500/20'
                        }
                      `}
                      isLoading={false}
                    >
                      {selectedPlan === plan.id ? 'Selected' : 'Select Plan'}
                    </LoadingButton>
                  )}
                </div>

                {/* Selected Indicator */}
                {selectedPlan === plan.id && (
                  <div className="absolute top-4 right-4">
                    <div className="w-6 h-6 bg-accent-500 rounded-full flex items-center justify-center">
                      <svg
                        className="w-4 h-4 text-neutral-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </div>
                  </div>
                )}
                </div>
              </div>
            ))}
          </div>


          {/* Checkout Section */}
          {selectedPlanData && (
            <div className="card">
              <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
                <div className="flex-1">
                  <h3 className="font-display font-heading text-fluid-xl text-neutral-0 mb-2">
                    Selected Plan: {selectedPlanData.name}
                  </h3>
                  <p className="text-neutral-50 mb-4">{selectedPlanData.description}</p>
                  <div className="flex flex-col items-start">
                    {selectedPlanData.originalPrice && (
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="text-fluid-sm text-neutral-500 line-through">€{selectedPlanData.originalPrice}</span>
                        <span className="bg-red-500 text-neutral-0 text-fluid-xs px-2 py-1 rounded-full font-body">
                          {Math.round(((selectedPlanData.originalPrice - selectedPlanData.price!) / selectedPlanData.originalPrice) * 100)}% OFF
                        </span>
                      </div>
                    )}
                    <div className="flex items-baseline">
                      <span className="text-fluid-2xl font-display text-neutral-0">
                        €{selectedPlanData.price}
                      </span>
                      <span className="text-neutral-400 ml-1 text-fluid-sm">/{selectedPlanData.interval}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-col gap-3">
                  <LoadingButton
                    onClick={handleSubscribe}
                    isLoading={loading}
                    loadingText="Processing..."
                    className="btn-primary"
                  >
                    Subscribe Now
                  </LoadingButton>
                  
                  <button
                    onClick={() => setSelectedPlan(null)}
                    className="text-neutral-400 hover:text-neutral-300 text-fluid-sm transition-colors"
                  >
                    Change Plan
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Beta Benefits */}
          <div className="mt-8 card">
            <div className="text-center">
              <h4 className="font-display font-heading text-fluid-lg text-accent-400 mb-4">Beta Program Benefits</h4>
              <p className="text-neutral-50 text-fluid-sm mb-6">
                Get early access to advanced features and help shape MinbarAI's future.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-primary-700/20 border border-accent-500/20 rounded-lg p-4">
                  <div className="text-accent-400 text-fluid-sm font-body mb-2">Direct Feedback</div>
                  <div className="text-neutral-50 text-fluid-xs">Direct line to development team</div>
                </div>
                <div className="bg-primary-700/20 border border-accent-500/20 rounded-lg p-4">
                  <div className="text-accent-400 text-fluid-sm font-body mb-2">Early Access</div>
                  <div className="text-neutral-50 text-fluid-xs">First access to new features</div>
                </div>
                <div className="bg-primary-700/20 border border-accent-500/20 rounded-lg p-4">
                  <div className="text-accent-400 text-fluid-sm font-body mb-2">Special Pricing</div>
                  <div className="text-neutral-50 text-fluid-xs">Exclusive beta discounts</div>
                </div>
              </div>
            </div>
          </div>
        </div>

          {/* Support */}
          <div className="text-center mt-8">
            <p className="text-neutral-400 text-fluid-sm">
              Need help?{' '}
              <button 
                onClick={() => setSupportDialogOpen(true)}
                className="text-accent-400 hover:text-accent-300 transition-colors underline"
              >
                Contact our support team
              </button>
            </p>
          </div>
        </div>
      
      {/* Support Contact Dialog */}
      <SupportContactDialog 
        open={supportDialogOpen} 
        onOpenChange={setSupportDialogOpen} 
      />
    </div>
  )
}
