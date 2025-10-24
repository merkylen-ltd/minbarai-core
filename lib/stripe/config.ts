import Stripe from 'stripe'
import { PRICING_CONFIG } from '@/lib/pricing'

// Validate required environment variables
if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === 'your_stripe_secret_key') {
  console.warn('STRIPE_SECRET_KEY is not set or is using placeholder value. Stripe functionality will be limited.')
}

// Note: Price ID validation is handled in the checkout route
// This allows for dynamic price creation or flexible pricing

export const stripe = process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY !== 'your_stripe_secret_key'
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16',
      typescript: true,
    })
  : null

// Use pricing config for default price ID
export const PRICE_ID = PRICING_CONFIG.defaultPriceId

export const getURL = () => {
  let url =
    process?.env?.NEXT_PUBLIC_SITE_URL ?? // Set this to your site URL in production env.
    process?.env?.NEXT_PUBLIC_VERCEL_URL ?? // Automatically set by Vercel.
    'http://localhost:3000/'
  // Make sure to include `https://` when not localhost.
  url = url.includes('http') ? url : `https://${url}`
  // Make sure to include a trailing `/`.
  url = url.charAt(url.length - 1) === '/' ? url : `${url}/`
  return url
}
