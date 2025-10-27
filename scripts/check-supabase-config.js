#!/usr/bin/env node

/**
 * Supabase Configuration Checker for MinbarAI
 * 
 * This script checks your Supabase configuration and provides
 * specific instructions for enabling email verification.
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config()

// Configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
}

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green')
}

function logError(message) {
  log(`❌ ${message}`, 'red')
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow')
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue')
}

function logStep(step, message) {
  log(`\n${step}. ${message}`, 'cyan')
}

async function checkSupabaseAuthSettings() {
  logStep('1', 'Checking Supabase Authentication Settings')
  log('===============================================', 'cyan')
  
  try {
    // Test auth configuration
    const { data: authData, error: authError } = await supabase.auth.getSession()
    
    if (authError && !authError.message.includes('No session')) {
      logError(`Auth configuration issue: ${authError.message}`)
      return false
    }
    
    logSuccess('Auth configuration accessible')
    
    // Test sign-up to see if email confirmation is enabled
    const testEmail = `config-test-${Date.now()}@example.com`
    const testPassword = 'TestPassword123!'
    
    logInfo(`Testing sign-up with email: ${testEmail}`)
    
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/callback`
      }
    })
    
    if (signUpError) {
      if (signUpError.message.includes('confirmation email')) {
        logError('Email confirmation is not properly configured')
        logInfo('This is likely because email confirmation is disabled in Supabase Dashboard')
        return false
      } else {
        logError(`Sign-up error: ${signUpError.message}`)
        return false
      }
    }
    
    if (signUpData.user) {
      if (!signUpData.user.email_confirmed_at) {
        logSuccess('Email confirmation is properly enabled')
        logInfo('✅ Users must confirm email before accessing the app')
        return true
      } else {
        logWarning('Email is immediately confirmed - email confirmation might be disabled')
        logInfo('This means users can access the app without email verification')
        return false
      }
    }
    
    return false
    
  } catch (error) {
    logError(`Supabase auth check failed: ${error.message}`)
    return false
  }
}

function provideConfigurationInstructions() {
  logStep('2', 'Supabase Dashboard Configuration Required')
  log('===============================================', 'cyan')
  
  logInfo('Your Supabase project: hjsifxofnqbnrgqkbomx')
  logInfo('Dashboard URL: https://supabase.com/dashboard/project/hjsifxofnqbnrgqkbomx')
  
  log('\n🔧 Required Configuration Steps:', 'yellow')
  
  log('\n1. Enable Email Confirmation:', 'bright')
  log('   • Go to Authentication → Settings', 'blue')
  log('   • Under "User Signups", check:', 'blue')
  log('     ✅ Enable email confirmations', 'green')
  log('     ✅ Enable email change confirmations', 'green')
  log('     ✅ Enable password recovery', 'green')
  
  log('\n2. Configure URL Settings:', 'bright')
  log('   • Go to Authentication → URL Configuration', 'blue')
  log('   • Set Site URL:', 'blue')
  log('     http://localhost:3000', 'green')
  log('   • Add Redirect URLs:', 'blue')
  log('     http://localhost:3000/auth/callback', 'green')
  log('     https://minbarai.com/auth/callback', 'green')
  
  log('\n3. Configure Email Templates:', 'bright')
  log('   • Go to Authentication → Email Templates', 'blue')
  log('   • For each template, click "Edit" and:', 'blue')
  log('     • Copy content from public/email-templates/', 'green')
  log('     • Paste into template editor', 'green')
  log('     • Save template', 'green')
  
  log('\n4. Test Email Delivery:', 'bright')
  log('   • Go to Authentication → Settings', 'blue')
  log('   • Check "SMTP Settings" section', 'blue')
  log('   • Ensure email delivery is configured', 'green')
  
  log('\n📧 Available Email Templates:', 'yellow')
  log('   • confirm-signup-email.html', 'blue')
  log('   • reset-password-email.html', 'blue')
  log('   • magic-link-email.html', 'blue')
  log('   • change-email-address-email.html', 'blue')
  log('   • invite-user-email.html', 'blue')
  log('   • reauthentication-email.html', 'blue')
}

function provideTestingInstructions() {
  logStep('3', 'Testing Instructions')
  log('=========================', 'cyan')
  
  log('\n🧪 After configuring Supabase:', 'yellow')
  
  log('\n1. Run the end-to-end test again:', 'bright')
  log('   node scripts/test-e2e-email-verification.js', 'green')
  
  log('\n2. Test manually:', 'bright')
  log('   • Start your dev server: npm run dev', 'green')
  log('   • Go to http://localhost:3000/auth/signup', 'green')
  log('   • Sign up with a real email address', 'green')
  log('   • Check your email for confirmation message', 'green')
  log('   • Click the confirmation link', 'green')
  log('   • Verify you\'re redirected to the app', 'green')
  
  log('\n3. Test error scenarios:', 'bright')
  log('   • Try to sign in with unconfirmed email', 'green')
  log('   • Verify proper error message is shown', 'green')
  log('   • Test password reset flow', 'green')
}

async function main() {
  log('🔍 MinbarAI Supabase Configuration Checker', 'bright')
  log('==========================================', 'bright')
  
  const authConfigured = await checkSupabaseAuthSettings()
  
  if (authConfigured) {
    logSuccess('\n🎉 Email verification is properly configured!')
    logInfo('Your Supabase authentication is working correctly.')
    logInfo('You can proceed with testing the complete email verification flow.')
  } else {
    logError('\n⚠️  Email verification needs to be configured in Supabase Dashboard')
    provideConfigurationInstructions()
    provideTestingInstructions()
  }
  
  log('\n📋 Next Steps:', 'magenta')
  log('==============', 'magenta')
  
  if (!authConfigured) {
    logInfo('1. Configure Supabase Dashboard (follow instructions above)')
    logInfo('2. Run end-to-end test again')
    logInfo('3. Test with real email addresses')
  } else {
    logInfo('1. Test with real email addresses')
    logInfo('2. Deploy to production')
    logInfo('3. Monitor email delivery')
  }
}

// Run the check
main().catch(error => {
  logError(`Configuration check failed: ${error.message}`)
  process.exit(1)
})

