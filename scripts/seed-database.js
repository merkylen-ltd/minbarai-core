#!/usr/bin/env node

/**
 * MinbarAI Database Seed Script
 * Creates users with 3-hour session limit plan for development/testing
 * 
 * Usage: 
 *   node scripts/seed-database.js <email> [password]
 *   node scripts/seed-database.js cleanup <email>
 *   node scripts/seed-database.js list
 * 
 * Make sure to set up your environment variables first:
 * - NEXT_PUBLIC_SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 */

// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

// Initialize Supabase client with service role key for admin operations
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL');
  console.error('   SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Validate URL format
if (!supabaseUrl.startsWith('http://') && !supabaseUrl.startsWith('https://')) {
  console.error('❌ Invalid SUPABASE_URL format. Must start with http:// or https://');
  console.error(`   Current value: ${supabaseUrl}`);
  process.exit(1);
}

// Validate service role key format (should be a JWT)
if (!supabaseServiceKey.startsWith('eyJ')) {
  console.error('❌ Invalid SUPABASE_SERVICE_ROLE_KEY format. Should be a JWT token starting with "eyJ"');
  console.error('   Please check your .env.local file');
  process.exit(1);
}

// Create Supabase client with proper admin configuration
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

function generateSecurePassword() {
  // Generate a secure random password that meets all requirements
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  const special = '@$!%*?&'; // Only allowed special characters
  const allChars = lowercase + uppercase + numbers + special;
  
  let password = '';
  
  // Ensure at least one character from each category
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += special[Math.floor(Math.random() * special.length)];
  
  // Fill the rest randomly (to reach 12 characters total)
  for (let i = 4; i < 12; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }
  
  // Shuffle the password to randomize character positions
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

async function testSupabaseConnection() {
  try {
    // Test connection by trying to list users (this requires admin privileges)
    const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 });
    
    if (error) {
      // Check if we got an HTML response
      if (error.message && (error.message.includes('<!DOCTYPE') || error.message.includes('Unexpected token'))) {
        console.error('❌ Configuration Error: Cannot connect to Supabase Admin API');
        console.error('   Received HTML response instead of JSON');
        console.error('');
        console.error('   Possible causes:');
        console.error('   1. NEXT_PUBLIC_SUPABASE_URL is incorrect');
        console.error('   2. SUPABASE_SERVICE_ROLE_KEY is invalid or expired');
        console.error('   3. Service role key does not have admin permissions');
        console.error('');
        console.error('   Please verify your .env.local file:');
        console.error(`   NEXT_PUBLIC_SUPABASE_URL: ${supabaseUrl}`);
        console.error(`   SUPABASE_SERVICE_ROLE_KEY: ${supabaseServiceKey ? 'Set (length: ' + supabaseServiceKey.length + ')' : 'Missing'}`);
        console.error('');
        console.error('   Get these values from:');
        console.error('   https://supabase.com/dashboard → Your Project → Settings → API');
        return false;
      }
      console.error('⚠️  Connection test failed:', error.message);
      return false;
    }
    
    return true;
  } catch (error) {
    const errorMessage = error?.message || String(error);
    if (errorMessage.includes('<!DOCTYPE') || errorMessage.includes('Unexpected token')) {
      console.error('❌ Configuration Error: Cannot connect to Supabase Admin API');
      console.error('   Received HTML response instead of JSON');
      console.error('');
      console.error('   Please verify your .env.local file:');
      console.error(`   NEXT_PUBLIC_SUPABASE_URL: ${supabaseUrl}`);
      console.error(`   SUPABASE_SERVICE_ROLE_KEY: ${supabaseServiceKey ? 'Set (length: ' + supabaseServiceKey.length + ')' : 'Missing'}`);
      return false;
    }
    console.error('⚠️  Connection test error:', errorMessage);
    return false;
  }
}

async function createUser(email, password) {
  console.log(`🔐 Creating user: ${email}...`);
  
  // Test connection first
  const connectionOk = await testSupabaseConnection();
  if (!connectionOk) {
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${password}`);
    return null;
  }
  
  try {
    // First, try to create the user in auth.users using Supabase Admin API
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
      user_metadata: {
        seeded_user: true,
        created_by: 'seed-script'
      }
    });

    if (authError) {
      // Check if error message contains HTML (indicates wrong endpoint or config issue)
      if (authError.message && authError.message.includes('<!DOCTYPE')) {
        console.error('❌ Configuration Error: Received HTML response instead of JSON');
        console.error('   This usually means:');
        console.error('   1. NEXT_PUBLIC_SUPABASE_URL is incorrect');
        console.error('   2. SUPABASE_SERVICE_ROLE_KEY is invalid or expired');
        console.error('   3. Supabase project may not be accessible');
        console.error('');
        console.error('   Please verify your .env.local file:');
        console.error(`   NEXT_PUBLIC_SUPABASE_URL: ${supabaseUrl ? '✓ Set' : '✗ Missing'}`);
        console.error(`   SUPABASE_SERVICE_ROLE_KEY: ${supabaseServiceKey ? '✓ Set (length: ' + supabaseServiceKey.length + ')' : '✗ Missing'}`);
        console.error('');
        console.error('   Get these values from:');
        console.error('   https://supabase.com/dashboard → Your Project → Settings → API');
        return null;
      }
      
      if (authError.message && authError.message.includes('already been registered')) {
        console.log('⚠️  Auth user already exists, fetching user ID...');
        
        // Try to get the existing user by email
        const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers({
          page: 1,
          perPage: 1000
        });
        
        if (listError) {
          console.log('⚠️  Could not fetch existing users:', listError.message);
          console.log('   Note: You may need to manually create the auth user in Supabase dashboard');
          console.log(`   Email: ${email}`);
          console.log(`   Password: ${password}`);
          return null;
        }
        
        // Find the user by email
        const existingUser = existingUsers.users.find(user => user.email === email);
        if (existingUser) {
          console.log('✅ Found existing auth user');
          console.log(`   User ID: ${existingUser.id}`);
          // Attempt to update the user's password so the provided password takes effect
          try {
            const { data: updatedUser, error: updateError } = await supabase.auth.admin.updateUserById(existingUser.id, {
              password,
              email_confirm: true
            });
            if (updateError) {
              console.log('⚠️  Failed to update existing user password:', updateError.message);
            } else if (updatedUser) {
              console.log('✅ Existing user password updated');
            }
          } catch (e) {
            console.log('⚠️  Exception while updating existing user password:', e?.message || e);
          }
          return existingUser.id;
        } else {
          console.log('⚠️  User not found in auth.users, continuing...');
          console.log('   Note: You may need to manually create the auth user in Supabase dashboard');
          console.log(`   Email: ${email}`);
          console.log(`   Password: ${password}`);
          return null;
        }
      } else {
        console.log('⚠️  Auth user creation failed:', authError.message);
        console.log('   Note: You may need to manually create the auth user in Supabase dashboard');
        console.log(`   Email: ${email}`);
        console.log(`   Password: ${password}`);
        return null;
      }
    } else {
      console.log('✅ Auth user created successfully');
      if (authUser?.user?.id) {
        console.log(`   User ID: ${authUser.user.id}`);
        return authUser.user.id;
      }
    }
  } catch (error) {
    // Enhanced error handling for various error types
    const errorMessage = error?.message || String(error);
    
    if (errorMessage.includes('<!DOCTYPE') || errorMessage.includes('Unexpected token')) {
      console.error('❌ Configuration Error: Received HTML response instead of JSON');
      console.error('   This usually means:');
      console.error('   1. NEXT_PUBLIC_SUPABASE_URL is incorrect');
      console.error('   2. SUPABASE_SERVICE_ROLE_KEY is invalid or expired');
      console.error('   3. Supabase project may not be accessible');
      console.error('');
      console.error('   Please verify your .env.local file:');
      console.error(`   NEXT_PUBLIC_SUPABASE_URL: ${supabaseUrl ? '✓ Set (' + supabaseUrl + ')' : '✗ Missing'}`);
      console.error(`   SUPABASE_SERVICE_ROLE_KEY: ${supabaseServiceKey ? '✓ Set (length: ' + supabaseServiceKey.length + ')' : '✗ Missing'}`);
      console.error('');
      console.error('   Get these values from:');
      console.error('   https://supabase.com/dashboard → Your Project → Settings → API');
    } else {
      console.log('⚠️  Could not create auth user (might need admin privileges)');
      console.log('   Error:', errorMessage);
      console.log('   Note: You may need to manually create the auth user in Supabase dashboard');
      console.log(`   Email: ${email}`);
      console.log(`   Password: ${password}`);
    }
    return null;
  }
}

async function createPublicUser(userId, email) {
  console.log('👤 Creating user in public.users...');
  
  if (!userId) {
    console.log('⚠️  No valid auth user ID found. Please create the auth user manually:');
    console.log('   1. Go to Supabase Dashboard → Authentication → Users');
    console.log('   2. Click "Add user"');
    console.log(`   3. Email: ${email}`);
    console.log('   4. Password: [use the password shown above]');
    console.log('   5. Check "Email Confirmed"');
    console.log('   6. Click "Create user"');
    console.log('   7. Copy the user ID and run this script again');
    console.log('');
    console.log('   Or run the SQL script directly in Supabase SQL Editor instead.');
    return false;
  }
  
  const { data, error } = await supabase
    .from('users')
    .upsert({
      id: userId,
      email: email,
      subscription_status: 'active',
      subscription_id: `sub_${email.replace('@', '_').replace('.', '_')}_plan`,
      customer_id: `cus_${email.replace('@', '_').replace('.', '_')}`,
      session_limit_minutes: 180,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'email'
    });

  if (error) {
    console.error('❌ Error creating public user:', error);
    throw error;
  }

  console.log('✅ Public user created/updated successfully');
  return true;
}

async function verifyUser(email) {
  console.log('🔍 Verifying seeded data...');
  
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .single();

  if (userError) {
    console.error('❌ Error verifying user:', userError);
    return false;
  }

  console.log('✅ User verification:');
  console.log(`   Email: ${user.email}`);
  console.log(`   Subscription: ${user.subscription_status}`);
  console.log(`   Customer ID: ${user.customer_id}`);
  console.log(`   Session Limit: ${user.session_limit_minutes} minutes`);
  console.log('   Sessions: Will be created when user starts live translation');
  return true;
}

async function listUsers() {
  console.log('📋 Listing all seeded users...');
  
  const { data: users, error } = await supabase
    .from('users')
    .select('id, email, subscription_status, subscription_id, customer_id, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Error listing users:', error);
    return;
  }

  if (users.length === 0) {
    console.log('   No users found');
    return;
  }

  console.log(`   Found ${users.length} user(s):`);
  users.forEach((user, index) => {
    console.log(`   ${index + 1}. ${user.email}`);
    console.log(`      ID: ${user.id}`);
    console.log(`      Status: ${user.subscription_status}`);
    console.log(`      Created: ${new Date(user.created_at).toLocaleString()}`);
    console.log('');
  });
}

async function cleanupUser(email) {
  console.log(`🧹 Cleaning up user: ${email}...`);
  
  // First, get the user ID
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .single();

  if (userError) {
    console.error('❌ Error finding user:', userError);
    return;
  }

  if (!user) {
    console.log('   User not found');
    return;
  }

  // Delete sessions first (due to foreign key constraint)
  const { error: sessionsError } = await supabase
    .from('usage_sessions')
    .delete()
    .eq('user_id', user.id);

  if (sessionsError) {
    console.error('❌ Error deleting sessions:', sessionsError);
  } else {
    console.log('✅ Sessions deleted (if any existed)');
  }

  // Delete user from public.users
  const { error: userDeleteError } = await supabase
    .from('users')
    .delete()
    .eq('id', user.id);

  if (userDeleteError) {
    console.error('❌ Error deleting user:', userDeleteError);
  } else {
    console.log('✅ User deleted from public.users');
  }

  // Note: We don't delete from auth.users as that requires admin privileges
  console.log('   Note: Auth user still exists in auth.users (requires manual deletion)');
}

async function main() {
  const args = process.argv.slice(2);
  
  console.log('🌱 MinbarAI Database Seed Script');
  console.log('================================');
  
  if (args.length === 0) {
    console.log('❌ Missing arguments');
    console.log('');
    console.log('Usage:');
    console.log('  node scripts/seed-database.js <email> [password]');
    console.log('  node scripts/seed-database.js cleanup <email>');
    console.log('  node scripts/seed-database.js list');
    console.log('');
    console.log('Examples:');
    console.log('  node scripts/seed-database.js test@example.com');
    console.log('  node scripts/seed-database.js test@example.com MyPassword123');
    console.log('  node scripts/seed-database.js cleanup test@example.com');
    console.log('  node scripts/seed-database.js list');
    process.exit(1);
  }

  const command = args[0];

  if (command === 'list') {
    await listUsers();
    return;
  }

  if (command === 'cleanup') {
    if (args.length < 2) {
      console.error('❌ Missing email for cleanup');
      console.log('Usage: node scripts/seed-database.js cleanup <email>');
      process.exit(1);
    }
    
    const email = args[1];
    if (!validateEmail(email)) {
      console.error('❌ Invalid email format');
      process.exit(1);
    }
    
    await cleanupUser(email);
    return;
  }

  // Create user command
  const email = args[0];
  const password = args[1] || generateSecurePassword();

  if (!validateEmail(email)) {
    console.error('❌ Invalid email format');
    process.exit(1);
  }

  try {
    const userId = await createUser(email, password);
    const success = await createPublicUser(userId, email);
    
    if (success) {
      await verifyUser(email);
      
      console.log('\n🎉 Database seeding completed successfully!');
      console.log('\n📋 User Credentials:');
      console.log(`   Email: ${email}`);
      console.log(`   Password: ${password}`);
      console.log('   Plan: 3-hour sessions (Active)');
      console.log('\n💡 You can now log in to test the application');
      console.log('\n🧹 To cleanup this user, run: node scripts/seed-database.js cleanup ' + email);
    } else {
      console.log('\n⚠️  Partial success - check the instructions above');
    }
    
  } catch (error) {
    console.error('\n❌ Seeding failed:', error.message);
    process.exit(1);
  }
}

// Run the script
main().catch(console.error);