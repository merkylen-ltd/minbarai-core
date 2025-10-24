#!/usr/bin/env node

/**
 * OAuth Configuration Verification Script
 * 
 * This script helps verify that the OAuth configuration is correct
 * and provides debugging information for OAuth issues.
 */

const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkEnvironmentVariables() {
  log('\n🔍 Checking Environment Variables...', 'blue');
  
  const envPath = path.join(process.cwd(), '.env.local');
  
  if (!fs.existsSync(envPath)) {
    log('❌ .env.local file not found', 'red');
    return false;
  }
  
  const envContent = fs.readFileSync(envPath, 'utf8');
  
  const requiredVars = [
    'NEXT_PUBLIC_SITE_URL',
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY'
  ];
  
  let allPresent = true;
  
  requiredVars.forEach(varName => {
    if (envContent.includes(varName)) {
      log(`✅ ${varName} is configured`, 'green');
    } else {
      log(`❌ ${varName} is missing`, 'red');
      allPresent = false;
    }
  });
  
  return allPresent;
}

function checkOAuthRoutes() {
  log('\n🔍 Checking OAuth Routes...', 'blue');
  
  const routes = [
    'app/auth/callback/route.ts',
    'app/auth/signin/page.tsx',
    'app/auth/signup/page.tsx',
    'app/auth/auth-code-error/page.tsx',
    'app/page.tsx'
  ];
  
  let allExist = true;
  
  routes.forEach(route => {
    const routePath = path.join(process.cwd(), route);
    if (fs.existsSync(routePath)) {
      log(`✅ ${route} exists`, 'green');
    } else {
      log(`❌ ${route} is missing`, 'red');
      allExist = false;
    }
  });
  
  return allExist;
}

function checkSupabaseConfig() {
  log('\n🔍 Checking Supabase Configuration...', 'blue');
  
  const supabaseClientPath = path.join(process.cwd(), 'lib/supabase/client.ts');
  const supabaseServerPath = path.join(process.cwd(), 'lib/supabase/server.ts');
  
  if (fs.existsSync(supabaseClientPath) && fs.existsSync(supabaseServerPath)) {
    log('✅ Supabase client and server files exist', 'green');
  } else {
    log('❌ Supabase configuration files missing', 'red');
    return false;
  }
  
  return true;
}

function generateTestUrls() {
  log('\n🔍 OAuth Test URLs...', 'blue');
  
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  
  log(`\n📋 Test these URLs:`, 'yellow');
  log(`   Sign In: ${siteUrl}/auth/signin`, 'blue');
  log(`   Sign Up: ${siteUrl}/auth/signup`, 'blue');
  log(`   Callback: ${siteUrl}/auth/callback`, 'blue');
  log(`   Error Page: ${siteUrl}/auth/auth-code-error`, 'blue');
}

function checkPackageJson() {
  log('\n🔍 Checking Dependencies...', 'blue');
  
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  
  if (!fs.existsSync(packageJsonPath)) {
    log('❌ package.json not found', 'red');
    return false;
  }
  
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
  
  const requiredDeps = ['@supabase/ssr', 'next'];
  
  let allPresent = true;
  
  requiredDeps.forEach(dep => {
    if (dependencies[dep]) {
      log(`✅ ${dep} is installed`, 'green');
    } else {
      log(`❌ ${dep} is missing`, 'red');
      allPresent = false;
    }
  });
  
  return allPresent;
}

function provideSupabaseInstructions() {
  log('\n📋 Supabase Configuration Instructions:', 'yellow');
  log('\n1. Go to Supabase Dashboard:', 'blue');
  log('   https://supabase.com/dashboard', 'blue');
  log('\n2. Select your project: hjsifxofnqbnrgqkbomx', 'blue');
  log('\n3. Navigate to Authentication → Providers → Google', 'blue');
  log('\n4. Add these redirect URLs:', 'blue');
  log('   Development: http://localhost:3000/auth/callback', 'green');
  log('   Production: https://yourdomain.com/auth/callback', 'green');
  log('\n5. Save the configuration', 'blue');
}

function main() {
  log('🚀 OAuth Configuration Verification Script', 'bold');
  log('==========================================', 'bold');
  
  // Load environment variables
  require('dotenv').config({ path: '.env.local' });
  
  let allChecksPass = true;
  
  // Run all checks
  allChecksPass &= checkEnvironmentVariables();
  allChecksPass &= checkOAuthRoutes();
  allChecksPass &= checkSupabaseConfig();
  allChecksPass &= checkPackageJson();
  
  // Generate test URLs
  generateTestUrls();
  
  // Provide Supabase instructions
  provideSupabaseInstructions();
  
  // Final result
  log('\n' + '='.repeat(50), 'bold');
  if (allChecksPass) {
    log('✅ All checks passed! OAuth configuration looks good.', 'green');
    log('\n📝 Next steps:', 'yellow');
    log('1. Configure Supabase redirect URLs (see instructions above)', 'blue');
    log('2. Restart your development server: npm run dev', 'blue');
    log('3. Test OAuth flow in browser', 'blue');
  } else {
    log('❌ Some checks failed. Please fix the issues above.', 'red');
    log('\n📝 Common fixes:', 'yellow');
    log('1. Create .env.local file with required variables', 'blue');
    log('2. Install missing dependencies: npm install', 'blue');
    log('3. Ensure all OAuth route files exist', 'blue');
  }
  
  log('\n🔗 For detailed instructions, see: OAUTH_FIX_GUIDE.md', 'blue');
}

// Run the script
main();
