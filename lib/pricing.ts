/**
 * Centralized Pricing Configuration
 * 
 * This file contains all pricing information for the application.
 * Update prices here to affect the entire application.
 */

export interface PricingPlan {
  id: string
  name: string
  description: string
  price: number | null // null for coming soon plans
  originalPrice?: number
  interval: 'month' | 'year'
  features: string[]
  limits: {
    minutes: number
    languages: number
    sessions: number
  }
  isPopular?: boolean
  isComingSoon?: boolean
  stripePriceId?: string // Optional Stripe price ID for this plan
}

export interface PricingConfig {
  currency: string
  currencySymbol: string
  plans: PricingPlan[]
  defaultPriceId: string // Default Stripe price ID
}

// Main pricing configuration
export const PRICING_CONFIG: PricingConfig = {
  currency: 'EUR',
  currencySymbol: '€',
  defaultPriceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID || 'price_placeholder_50_euro_monthly',
  plans: [
    {
      id: 'professional',
      name: 'MinbarAI Pro Beta',
      description: 'Professional live translation for organizations',
      price: 99,
      originalPrice: 200,
      interval: 'month',
      features: [
        '3-hour live sessions',
        'AI-powered speech recognition',
        '130+ language translations',
        'Professional viewer interface',
        'Email support',
        'Basic security',
        'Download transcripts (TXT)',
        'Early access to features',
        'Community access and support',
        'GDPR compliance',
        'Onboarding session'
      ],
      limits: {
        minutes: 180,
        languages: 130,
        sessions: 1
      },
      isPopular: true
    },
    {
      id: 'business',
      name: 'MinbarAI Business Beta',
      description: 'Enhanced solution for growing businesses',
      price: null, // Coming soon
      interval: 'month',
      features: [
        '6-hour live sessions',
        'AI-powered speech recognition',
        '150+ language translations',
        'Custom branding options',
        'Priority support',
        'Advanced security features',
        'Download transcripts (TXT & PDF)',
        'Beta feature priority access',
        'Dedicated support channel',
        'Usage analytics dashboard',
        'Team collaboration tools',
        'Community access and support',
        'GDPR compliance',
        'Onboarding session',
        'Custom setup support'
      ],
      limits: {
        minutes: 360,
        languages: 150,
        sessions: 5
      },
      isComingSoon: true
    },
    {
      id: 'enterprise',
      name: 'MinbarAI Enterprise Beta',
      description: 'Advanced solution for large organizations',
      price: null, // Coming soon
      interval: 'month',
      features: [
        'Unlimited live sessions',
        'AI-powered speech recognition',
        '200+ global languages',
        'Complete white-labeling',
        '24/7 dedicated support',
        'Military-grade security',
        'Custom format exports',
        'Exclusive feature access',
        'Dedicated account manager',
        'Advanced analytics & reporting',
        'Multi-team management',
        'API integrations',
        'Custom deployment options',
        'SLA guarantees',
        'Community access and support',
        'GDPR compliance',
        'Onboarding session'
      ],
      limits: {
        minutes: 999999,
        languages: 200,
        sessions: 500
      },
      isComingSoon: true
    }
  ]
}

// Helper functions
export const getPlanById = (planId: string): PricingPlan | undefined => {
  return PRICING_CONFIG.plans.find(plan => plan.id === planId)
}

export const getPopularPlan = (): PricingPlan | undefined => {
  return PRICING_CONFIG.plans.find(plan => plan.isPopular)
}

export const getAvailablePlans = (): PricingPlan[] => {
  return PRICING_CONFIG.plans.filter(plan => !plan.isComingSoon)
}

export const formatPrice = (price: number): string => {
  return `${PRICING_CONFIG.currencySymbol}${price}`
}

export const calculateDiscountPercentage = (originalPrice: number, currentPrice: number): number => {
  return Math.round(((originalPrice - currentPrice) / originalPrice) * 100)
}

// Environment-based configuration overrides
export const getEffectivePricingConfig = (): PricingConfig => {
  // You can add environment-based overrides here
  // For example, different pricing for different environments
  const config = { ...PRICING_CONFIG }
  
  // Override default price ID from environment
  if (process.env.NEXT_PUBLIC_STRIPE_PRICE_ID) {
    config.defaultPriceId = process.env.NEXT_PUBLIC_STRIPE_PRICE_ID
  }
  
  return config
}
