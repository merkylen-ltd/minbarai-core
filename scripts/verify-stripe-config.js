#!/usr/bin/env node

/**
 * Stripe Configuration Verification Script
 * 
 * This script checks if your Stripe configuration is properly set up
 * Run with: node scripts/verify-stripe-config.js
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying Stripe Configuration...\n');

// Check if .env.local exists
const envPath = path.join(process.cwd(), '.env.local');
if (!fs.existsSync(envPath)) {
  console.log('❌ .env.local file not found');
  console.log('   Create a .env.local file with your Stripe configuration');
  process.exit(1);
}

// Read environment variables
require('dotenv').config({ path: envPath });

// Check required environment variables
const requiredVars = [
  'STRIPE_SECRET_KEY',
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'NEXT_PUBLIC_STRIPE_PRICE_ID'
];

const missingVars = [];
const invalidVars = [];

requiredVars.forEach(varName => {
  const value = process.env[varName];
  
  if (!value) {
    missingVars.push(varName);
  } else if (value.includes('your_') || value.includes('placeholder')) {
    invalidVars.push(varName);
  }
});

// Display results
console.log('📋 Environment Variables Check:');
console.log('================================');

if (missingVars.length === 0 && invalidVars.length === 0) {
  console.log('✅ All required environment variables are set');
} else {
  if (missingVars.length > 0) {
    console.log('❌ Missing environment variables:');
    missingVars.forEach(varName => {
      console.log(`   - ${varName}`);
    });
  }
  
  if (invalidVars.length > 0) {
    console.log('❌ Invalid environment variables (still using placeholder values):');
    invalidVars.forEach(varName => {
      console.log(`   - ${varName}`);
    });
  }
}

console.log('\n🔑 Key Format Validation:');
console.log('=========================');

// Validate key formats
const secretKey = process.env.STRIPE_SECRET_KEY;
const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
const priceId = process.env.NEXT_PUBLIC_STRIPE_PRICE_ID;

if (secretKey) {
  if (secretKey.startsWith('sk_test_') || secretKey.startsWith('sk_live_')) {
    console.log('✅ STRIPE_SECRET_KEY format is correct');
  } else {
    console.log('❌ STRIPE_SECRET_KEY format is incorrect (should start with sk_test_ or sk_live_)');
  }
}

if (publishableKey) {
  if (publishableKey.startsWith('pk_test_') || publishableKey.startsWith('pk_live_')) {
    console.log('✅ NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY format is correct');
  } else {
    console.log('❌ NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY format is incorrect (should start with pk_test_ or pk_live_)');
  }
}

if (webhookSecret) {
  if (webhookSecret.startsWith('whsec_')) {
    console.log('✅ STRIPE_WEBHOOK_SECRET format is correct');
  } else {
    console.log('❌ STRIPE_WEBHOOK_SECRET format is incorrect (should start with whsec_)');
  }
}

if (priceId) {
  if (priceId.startsWith('price_')) {
    console.log('✅ NEXT_PUBLIC_STRIPE_PRICE_ID format is correct');
  } else {
    console.log('❌ NEXT_PUBLIC_STRIPE_PRICE_ID format is incorrect (should start with price_)');
  }
}

console.log('\n📁 Configuration Files Check:');
console.log('==============================');

// Check if pricing configuration exists
const pricingConfigPath = path.join(process.cwd(), 'lib', 'pricing.ts');
if (fs.existsSync(pricingConfigPath)) {
  console.log('✅ Pricing configuration file exists (lib/pricing.ts)');
} else {
  console.log('❌ Pricing configuration file missing (lib/pricing.ts)');
}

// Check if Stripe config exists
const stripeConfigPath = path.join(process.cwd(), 'lib', 'stripe', 'config.ts');
if (fs.existsSync(stripeConfigPath)) {
  console.log('✅ Stripe configuration file exists (lib/stripe/config.ts)');
} else {
  console.log('❌ Stripe configuration file missing (lib/stripe/config.ts)');
}

console.log('\n🌐 Webhook Configuration Check:');
console.log('================================');

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
if (siteUrl) {
  console.log(`✅ Site URL configured: ${siteUrl}`);
  console.log(`   Webhook URL should be: ${siteUrl}/api/stripe/webhooks`);
} else {
  console.log('❌ NEXT_PUBLIC_SITE_URL not configured');
  console.log('   Set this to your production URL for webhooks');
}

console.log('\n📊 Summary:');
console.log('============');

const totalIssues = missingVars.length + invalidVars.length;
if (totalIssues === 0) {
  console.log('🎉 All checks passed! Your Stripe configuration looks good.');
  console.log('\nNext steps:');
  console.log('1. Test the checkout flow in your application');
  console.log('2. Verify webhook delivery in Stripe dashboard');
  console.log('3. Test a complete subscription cycle');
} else {
  console.log(`⚠️  Found ${totalIssues} configuration issues that need to be fixed.`);
  console.log('\nTo fix these issues:');
  console.log('1. Update your .env.local file with the correct values');
  console.log('2. Get your keys from the Stripe dashboard');
  console.log('3. Set up webhooks in Stripe dashboard');
  console.log('4. Run this script again to verify');
}

console.log('\n📚 For more help, see:');
console.log('   - doc/STRIPE_PRICING_CONFIGURATION.md');
console.log('   - doc/STRIPE_SETUP_GUIDE.md');
console.log('   - https://stripe.com/docs');
