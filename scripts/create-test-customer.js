#!/usr/bin/env node

/**
 * Create Test Stripe Customer Script
 * Creates a real Stripe customer for the test user to enable portal access
 * 
 * Usage: node scripts/create-test-customer.js
 */

// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');
const Stripe = require('stripe');

// Configuration
const TEST_USER_EMAIL = 'test@minbarai.com';

// Initialize clients
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!supabaseUrl || !supabaseServiceKey || !stripeSecretKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL');
  console.error('   SUPABASE_SERVICE_ROLE_KEY');
  console.error('   STRIPE_SECRET_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const stripe = new Stripe(stripeSecretKey);

async function createStripeCustomer() {
  console.log('💳 Creating Stripe customer...');
  
  try {
    const customer = await stripe.customers.create({
      email: TEST_USER_EMAIL,
      name: 'Test User',
      description: 'Test customer for MinbarAI development',
      metadata: {
        test_user: 'true',
        source: 'development_setup'
      }
    });

    console.log('✅ Stripe customer created successfully');
    console.log(`   Customer ID: ${customer.id}`);
    console.log(`   Email: ${customer.email}`);
    
    return customer;
  } catch (error) {
    console.error('❌ Error creating Stripe customer:', error.message);
    throw error;
  }
}

async function updateDatabaseCustomerId(customerId) {
  console.log('📝 Updating database with real customer ID...');
  
  try {
    const { data, error } = await supabase
      .from('users')
      .update({ 
        customer_id: customerId,
        updated_at: new Date().toISOString()
      })
      .eq('email', TEST_USER_EMAIL);

    if (error) {
      console.error('❌ Error updating database:', error);
      throw error;
    }

    console.log('✅ Database updated successfully');
    console.log(`   Updated customer_id to: ${customerId}`);
  } catch (error) {
    console.error('❌ Error updating database:', error.message);
    throw error;
  }
}

async function verifyCustomer() {
  console.log('🔍 Verifying customer setup...');
  
  try {
    // Check database
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('email', TEST_USER_EMAIL)
      .single();

    if (userError) {
      console.error('❌ Error fetching user from database:', userError);
      return;
    }

    console.log('✅ Database verification:');
    console.log(`   Email: ${user.email}`);
    console.log(`   Customer ID: ${user.customer_id}`);
    console.log(`   Subscription: ${user.subscription_status}`);

    // Check Stripe customer
    const customer = await stripe.customers.retrieve(user.customer_id);
    console.log('✅ Stripe verification:');
    console.log(`   Customer ID: ${customer.id}`);
    console.log(`   Email: ${customer.email}`);
    console.log(`   Created: ${new Date(customer.created * 1000).toISOString()}`);
    
  } catch (error) {
    console.error('❌ Error verifying customer:', error.message);
  }
}

async function main() {
  console.log('🚀 Creating Test Stripe Customer');
  console.log('=================================');
  
  try {
    const customer = await createStripeCustomer();
    await updateDatabaseCustomerId(customer.id);
    await verifyCustomer();
    
    console.log('\n🎉 Test customer setup completed successfully!');
    console.log('\n📋 What was done:');
    console.log('   1. Created real Stripe customer');
    console.log('   2. Updated database with real customer ID');
    console.log('   3. Verified both database and Stripe');
    console.log('\n💡 You can now access the customer portal without errors!');
    
  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    process.exit(1);
  }
}

// Run the script
main().catch(console.error);
