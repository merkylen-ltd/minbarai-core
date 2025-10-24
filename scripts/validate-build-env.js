#!/usr/bin/env node

/**
 * Build Environment Validation Script
 * Validates that required environment variables are available during build
 */

const requiredEnvVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  'NEXT_PUBLIC_STRIPE_PRICE_ID',
  'NEXT_PUBLIC_VOICEFLOW_WS_URL',
  'NEXT_PUBLIC_VOICEFLOW_WS_TOKEN',
  'NEXT_PUBLIC_SITE_URL',
  'NEXTAUTH_URL'
]

const optionalEnvVars = [
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'SUPABASE_SERVICE_ROLE_KEY'
]

function validateEnvironment() {
  console.log('🔍 Validating build environment variables...')
  
  let hasErrors = false
  
  // Check required variables
  for (const envVar of requiredEnvVars) {
    const value = process.env[envVar]
    if (!value || value.includes('your_') || value.includes('placeholder')) {
      console.error(`❌ Missing or placeholder value for required variable: ${envVar}`)
      hasErrors = true
    } else {
      console.log(`✅ ${envVar}: ${value.substring(0, 20)}...`)
    }
  }
  
  // Check optional variables (warn but don't fail)
  for (const envVar of optionalEnvVars) {
    const value = process.env[envVar]
    if (!value || value.includes('your_') || value.includes('placeholder')) {
      console.warn(`⚠️  Missing or placeholder value for optional variable: ${envVar}`)
    } else {
      console.log(`✅ ${envVar}: ${value.substring(0, 20)}...`)
    }
  }
  
  if (hasErrors) {
    console.error('\n❌ Build validation failed!')
    console.error('Please set the required environment variables before building.')
    console.error('Create a .env file with the required values:')
    console.error('  cp env.example .env')
    console.error('  # Edit .env with your actual values')
    process.exit(1)
  }
  
  console.log('\n✅ Build environment validation passed!')
}

// Run validation
validateEnvironment()
