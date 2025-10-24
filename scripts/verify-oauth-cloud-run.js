#!/usr/bin/env node

/**
 * OAuth Configuration Verification Script for Cloud Run
 * Verifies that OAuth is properly configured for Cloud Run deployment
 */

const https = require('https');
const http = require('http');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function makeRequest(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https:') ? https : http;
    
    const req = client.request(url, { method: 'HEAD' }, (res) => {
      resolve({
        statusCode: res.statusCode,
        headers: res.headers,
        url: url
      });
    });
    
    req.on('error', (err) => {
      reject(err);
    });
    
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    req.end();
  });
}

async function checkOAuthEndpoints() {
  log('\n🔍 Checking OAuth Endpoints...', 'cyan');
  
  const endpoints = [
    {
      name: 'Development Sign-in',
      url: 'https://minbarai-dev-878512438019.europe-west3.run.app/auth/signin',
      expected: [200, 302]
    },
    {
      name: 'Development Callback',
      url: 'https://minbarai-dev-878512438019.europe-west3.run.app/auth/callback',
      expected: [200, 400, 405] // 400/405 are expected for GET without params
    },
    {
      name: 'Development Sign-up',
      url: 'https://minbarai-dev-878512438019.europe-west3.run.app/auth/signup',
      expected: [200, 302]
    }
  ];
  
  for (const endpoint of endpoints) {
    try {
      const response = await makeRequest(endpoint.url);
      const isExpected = endpoint.expected.includes(response.statusCode);
      
      if (isExpected) {
        log(`✅ ${endpoint.name}: ${response.statusCode}`, 'green');
      } else {
        log(`⚠️  ${endpoint.name}: ${response.statusCode} (unexpected)`, 'yellow');
      }
    } catch (error) {
      log(`❌ ${endpoint.name}: ${error.message}`, 'red');
    }
  }
}

async function checkEnvironmentVariables() {
  log('\n🔧 Checking Environment Variables...', 'cyan');
  
  const requiredVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'NEXT_PUBLIC_SITE_URL',
    'NEXTAUTH_URL'
  ];
  
  for (const varName of requiredVars) {
    const value = process.env[varName];
    if (value) {
      const displayValue = varName.includes('KEY') ? 
        `${value.substring(0, 20)}...` : value;
      log(`✅ ${varName}: ${displayValue}`, 'green');
    } else {
      log(`❌ ${varName}: Not set`, 'red');
    }
  }
}

async function checkSupabaseConnection() {
  log('\n🔗 Checking Supabase Connection...', 'cyan');
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    log('❌ NEXT_PUBLIC_SUPABASE_URL not set', 'red');
    return;
  }
  
  try {
    const response = await makeRequest(`${supabaseUrl}/rest/v1/`);
    if (response.statusCode === 200) {
      log('✅ Supabase connection: OK', 'green');
    } else {
      log(`⚠️  Supabase connection: ${response.statusCode}`, 'yellow');
    }
  } catch (error) {
    log(`❌ Supabase connection: ${error.message}`, 'red');
  }
}

function printConfigurationGuide() {
  log('\n📋 OAuth Configuration Checklist:', 'magenta');
  log('=====================================', 'magenta');
  
  log('\n1. Google Cloud Console:', 'blue');
  log('   - Go to: https://console.cloud.google.com/');
  log('   - Navigate to: APIs & Services → Credentials');
  log('   - Add redirect URIs:', 'yellow');
  log('     • https://hjsifxofnqbnrgqkbomx.supabase.co/auth/v1/callback');
  log('     • https://minbarai-dev-878512438019.europe-west3.run.app/auth/callback');
  log('     • https://minbarai.com/auth/callback');
  log('     • http://localhost:3000/auth/callback');
  
  log('\n2. Supabase Dashboard:', 'blue');
  log('   - Go to: https://supabase.com/dashboard');
  log('   - Select project: hjsifxofnqbnrgqkbomx');
  log('   - Navigate to: Authentication → URL Configuration');
  log('   - Set Site URL: https://minbarai.com', 'yellow');
  log('   - Add Redirect URLs:', 'yellow');
  log('     • http://localhost:3000/auth/callback');
  log('     • https://minbarai-dev-878512438019.europe-west3.run.app/auth/callback');
  log('     • https://minbarai.com/auth/callback');
  
  log('\n3. Environment Variables:', 'blue');
  log('   - NEXT_PUBLIC_SITE_URL: https://minbarai-dev-878512438019.europe-west3.run.app');
  log('   - NEXTAUTH_URL: https://minbarai-dev-878512438019.europe-west3.run.app');
  
  log('\n4. Test OAuth Flow:', 'blue');
  log('   - Visit: https://minbarai-dev-878512438019.europe-west3.run.app/auth/signin');
  log('   - Click "Continue with Google"');
  log('   - Verify redirect works correctly');
}

async function main() {
  log('🔐 MinberAI OAuth Configuration Verification', 'bright');
  log('=============================================', 'bright');
  
  await checkEnvironmentVariables();
  await checkSupabaseConnection();
  await checkOAuthEndpoints();
  printConfigurationGuide();
  
  log('\n✨ Verification complete!', 'green');
  log('If you see any ❌ errors above, please fix them before testing OAuth.', 'yellow');
}

// Load environment variables from .env file if it exists
if (require('fs').existsSync('.env')) {
  require('dotenv').config();
}

main().catch(console.error);
