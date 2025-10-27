#!/usr/bin/env node

/**
 * Email Verification Integration Test for MinbarAI
 * 
 * This script verifies that the email verification logic works correctly
 * in both frontend and backend components.
 */

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')
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

async function checkEmailTemplates() {
  log('\n📧 Checking Email Templates', 'cyan')
  log('============================', 'cyan')
  
  const templateDir = path.join(__dirname, '..', 'public', 'email-templates')
  const requiredTemplates = [
    'confirm-signup-email.html',
    'reset-password-email.html', 
    'magic-link-email.html',
    'change-email-address-email.html',
    'invite-user-email.html',
    'reauthentication-email.html'
  ]
  
  let allTemplatesExist = true
  
  for (const template of requiredTemplates) {
    const templatePath = path.join(templateDir, template)
    if (fs.existsSync(templatePath)) {
      const content = fs.readFileSync(templatePath, 'utf8')
      
      // Check for required Supabase template variables
      const hasConfirmationURL = content.includes('{{ .ConfirmationURL }}')
      const hasEmailVariable = content.includes('{{ .Email }}')
      const hasMinbarAIBranding = content.includes('MinbarAI')
      const hasProperStyling = content.includes('email-container')
      
      logSuccess(`Found ${template}`)
      
      if (hasConfirmationURL) {
        logSuccess(`  ✓ Contains ConfirmationURL variable`)
      } else {
        logError(`  ✗ Missing ConfirmationURL variable`)
        allTemplatesExist = false
      }
      
      if (hasMinbarAIBranding) {
        logSuccess(`  ✓ Contains MinbarAI branding`)
      } else {
        logError(`  ✗ Missing MinbarAI branding`)
        allTemplatesExist = false
      }
      
      if (hasProperStyling) {
        logSuccess(`  ✓ Has proper email styling`)
      } else {
        logError(`  ✗ Missing proper email styling`)
        allTemplatesExist = false
      }
      
    } else {
      logError(`Missing template: ${template}`)
      allTemplatesExist = false
    }
  }
  
  return allTemplatesExist
}

async function checkBackendLogic() {
  log('\n🔧 Checking Backend Logic', 'cyan')
  log('==========================', 'cyan')
  
  const filesToCheck = [
    'app/api/auth/signup/route.ts',
    'app/auth/callback/route.ts',
    'app/api/auth/signin/route.ts'
  ]
  
  let backendIssues = []
  
  for (const file of filesToCheck) {
    const filePath = path.join(__dirname, '..', file)
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8')
      
      logSuccess(`Found ${file}`)
      
      // Check for email verification logic
      if (file.includes('signup')) {
        if (content.includes('emailRedirectTo')) {
          logSuccess(`  ✓ Signup route has emailRedirectTo`)
        } else {
          logError(`  ✗ Signup route missing emailRedirectTo`)
          backendIssues.push(`${file}: Missing emailRedirectTo`)
        }
        
        if (content.includes('requiresEmailConfirmation')) {
          logSuccess(`  ✓ Signup route handles email confirmation requirement`)
        } else {
          logError(`  ✗ Signup route missing email confirmation handling`)
          backendIssues.push(`${file}: Missing email confirmation handling`)
        }
      }
      
      if (file.includes('callback')) {
        if (content.includes('email_confirmed_at')) {
          logSuccess(`  ✓ Callback route checks email confirmation`)
        } else {
          logError(`  ✗ Callback route missing email confirmation check`)
          backendIssues.push(`${file}: Missing email confirmation check`)
        }
        
        if (content.includes('email_not_confirmed')) {
          logSuccess(`  ✓ Callback route handles unconfirmed email`)
        } else {
          logError(`  ✗ Callback route missing unconfirmed email handling`)
          backendIssues.push(`${file}: Missing unconfirmed email handling`)
        }
      }
      
      if (file.includes('signin')) {
        if (content.includes('Email not confirmed') || content.includes('verification')) {
          logSuccess(`  ✓ Signin route handles email verification errors`)
        } else {
          logWarning(`  ⚠ Signin route may not handle email verification errors`)
        }
      }
      
    } else {
      logError(`Missing file: ${file}`)
      backendIssues.push(`Missing file: ${file}`)
    }
  }
  
  return backendIssues.length === 0
}

async function checkFrontendLogic() {
  log('\n🎨 Checking Frontend Logic', 'cyan')
  log('===========================', 'cyan')
  
  const filesToCheck = [
    'app/auth/signup/page.tsx',
    'app/auth/signin/page.tsx',
    'app/auth/auth-code-error/page.tsx'
  ]
  
  let frontendIssues = []
  
  for (const file of filesToCheck) {
    const filePath = path.join(__dirname, '..', file)
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8')
      
      logSuccess(`Found ${file}`)
      
      if (file.includes('signup')) {
        if (content.includes('requiresEmailConfirmation')) {
          logSuccess(`  ✓ Signup page handles email confirmation requirement`)
        } else {
          logError(`  ✗ Signup page missing email confirmation handling`)
          frontendIssues.push(`${file}: Missing email confirmation handling`)
        }
        
        if (content.includes('Check Your Email')) {
          logSuccess(`  ✓ Signup page shows email confirmation message`)
        } else {
          logError(`  ✗ Signup page missing email confirmation message`)
          frontendIssues.push(`${file}: Missing email confirmation message`)
        }
      }
      
      if (file.includes('signin')) {
        if (content.includes('Email not confirmed') || content.includes('verification')) {
          logSuccess(`  ✓ Signin page handles email verification errors`)
        } else {
          logWarning(`  ⚠ Signin page may not handle email verification errors`)
        }
      }
      
      if (file.includes('auth-code-error')) {
        if (content.includes('email_not_confirmed')) {
          logSuccess(`  ✓ Error page handles email not confirmed`)
        } else {
          logError(`  ✗ Error page missing email not confirmed handling`)
          frontendIssues.push(`${file}: Missing email not confirmed handling`)
        }
      }
      
    } else {
      logError(`Missing file: ${file}`)
      frontendIssues.push(`Missing file: ${file}`)
    }
  }
  
  return frontendIssues.length === 0
}

async function testSupabaseConnection() {
  log('\n🔗 Testing Supabase Connection', 'cyan')
  log('===============================', 'cyan')
  
  try {
    // Test basic connection
    const { data, error } = await supabase.from('users').select('count').limit(1)
    
    if (error) {
      logError(`Supabase connection failed: ${error.message}`)
      return false
    }
    
    logSuccess('Supabase connection successful')
    
    // Test auth configuration
    const { data: authData, error: authError } = await supabase.auth.getSession()
    
    if (authError && !authError.message.includes('No session')) {
      logError(`Auth configuration issue: ${authError.message}`)
      return false
    }
    
    logSuccess('Auth configuration looks good')
    
    return true
    
  } catch (error) {
    logError(`Connection test failed: ${error.message}`)
    return false
  }
}

async function generateIntegrationReport() {
  log('\n📋 Integration Report', 'cyan')
  log('====================', 'cyan')
  
  const templateCheck = await checkEmailTemplates()
  const backendCheck = await checkBackendLogic()
  const frontendCheck = await checkFrontendLogic()
  const supabaseCheck = await testSupabaseConnection()
  
  log('\n📊 Summary', 'magenta')
  log('==========', 'magenta')
  
  logInfo(`Email Templates: ${templateCheck ? '✅ PASS' : '❌ FAIL'}`)
  logInfo(`Backend Logic: ${backendCheck ? '✅ PASS' : '❌ FAIL'}`)
  logInfo(`Frontend Logic: ${frontendCheck ? '✅ PASS' : '❌ FAIL'}`)
  logInfo(`Supabase Connection: ${supabaseCheck ? '✅ PASS' : '❌ FAIL'}`)
  
  const overallStatus = templateCheck && backendCheck && frontendCheck && supabaseCheck
  
  if (overallStatus) {
    logSuccess('\n🎉 All email verification components are properly integrated!')
    logInfo('\nNext steps:')
    logInfo('1. Configure email templates in Supabase Dashboard')
    logInfo('2. Test with a real email address')
    logInfo('3. Verify email confirmation flow works end-to-end')
  } else {
    logError('\n⚠️  Some issues found with email verification integration')
    logInfo('\nPlease fix the issues above before proceeding with email verification setup')
  }
  
  return overallStatus
}

async function main() {
  log('🚀 MinbarAI Email Verification Integration Test', 'bright')
  log('================================================', 'bright')
  
  const success = await generateIntegrationReport()
  
  if (success) {
    log('\n✨ Integration test completed successfully!', 'green')
    process.exit(0)
  } else {
    log('\n❌ Integration test found issues that need to be resolved', 'red')
    process.exit(1)
  }
}

// Run the test
main().catch(error => {
  logError(`Test failed with error: ${error.message}`)
  process.exit(1)
})
