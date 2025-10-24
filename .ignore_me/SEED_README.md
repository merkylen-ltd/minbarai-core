# Database Seed Scripts

This directory contains scripts to seed the MinbarAI database with test data for development and testing purposes.

## Overview

The seed scripts create a test user with a 3-hour session limit plan and sample translation sessions to help with development and testing.

## Test User Credentials

- **Email**: `test@minbarai.com`
- **Password**: `M4qR$tY8uI1oP6sA`
- **Plan**: Unlimited (Active subscription)
- **User ID**: `550e8400-e29b-41d4-a716-446655440000`

## Files

### 1. `seed-database.sql`
Pure SQL script that can be run directly in the Supabase SQL Editor.

**Usage:**
1. Open your Supabase project dashboard
2. Go to SQL Editor
3. Copy and paste the contents of `seed-database.sql`
4. Click "Run"

### 2. `scripts/seed-database.js`
Node.js script for easier execution with better error handling and verification.

**Usage:**
```bash
# Seed the database
npm run seed

# Cleanup test data
npm run seed:cleanup
```

## Prerequisites

### For SQL Script (`seed-database.sql`)
- Access to Supabase SQL Editor
- Admin privileges to insert into `auth.users` table

### For Node.js Script (`scripts/seed-database.js`)
- Node.js environment
- Environment variables set in `.env.local`:
  ```env
  NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
  SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
  ```

## What Gets Created

### 1. Test User
- **Auth User**: Entry in `auth.users` table with encrypted password
- **Public User**: Entry in `public.users` table with:
  - Active subscription status
  - Test subscription ID: `sub_test_unlimited_plan`
  - Test customer ID: `cus_test_customer`

### 2. Clean Test Environment
No sample sessions are created by default. This provides a clean test environment where:
- Users can create their own translation sessions through the live interface
- Sessions are created when users start/stop recording
- The dashboard starts empty, allowing for realistic testing

## Features

### 3-Hour Session Limit Plan Access
The test user has an active subscription with 3-hour session limits:
- ✅ 3-hour live translation sessions
- ✅ Real-time Arabic speech recognition
- ✅ AI-powered German translations
- ✅ Professional viewer interface
- ✅ Session recordings & transcripts
- ✅ Priority customer support
- ✅ Mobile and desktop access
- ✅ Custom branding options

### Clean Test Environment
- No pre-populated sessions
- Users create sessions through the live interface
- Realistic testing workflow
- Dashboard starts empty for proper testing

## Verification

After running the seed script, you can verify the data by:

1. **Logging in** with the test credentials
2. **Checking the dashboard** - it should be empty initially
3. **Starting a live translation session** to test the functionality
4. **Running the verification query** in Supabase SQL Editor:
   ```sql
   SELECT 
     u.email,
     u.subscription_status,
     u.subscription_id,
     u.customer_id
   FROM public.users u
   WHERE u.email = 'test@minbarai.com';
   ```

## Cleanup

To remove all test data:

### Using Node.js Script
```bash
npm run seed:cleanup
```

### Using SQL
```sql
-- Delete sessions first (due to foreign key constraint)
DELETE FROM public.sessions WHERE user_id = '550e8400-e29b-41d4-a716-446655440000';

-- Delete user
DELETE FROM public.users WHERE id = '550e8400-e29b-41d4-a716-446655440000';

-- Note: You may also need to delete from auth.users if you have admin access
DELETE FROM auth.users WHERE id = '550e8400-e29b-41d4-a716-446655440000';
```

## Troubleshooting

### Common Issues

1. **"Missing environment variables"**
   - Ensure `.env.local` is properly configured
   - Check that `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set

2. **"Auth user creation failed"**
   - This is normal if you don't have admin privileges
   - The script will continue and create the public user
   - You may need to manually create the auth user through Supabase dashboard

3. **"Foreign key constraint violation"**
   - Ensure the user exists before creating sessions
   - Check that the user ID matches exactly

4. **"RLS policy violation"**
   - The service role key should bypass RLS policies
   - Ensure you're using the service role key, not the anon key

### Manual Auth User Creation

If the Node.js script can't create the auth user, you can create it manually:

1. Go to Supabase Dashboard → Authentication → Users
2. Click "Add user"
3. Enter email: `test@minbarai.com`
4. Enter password: `M4qR$tY8uI1oP6sA`
5. Check "Email Confirmed"
6. Click "Create user"

## Security Notes

⚠️ **Important**: These scripts are for development and testing only!

- The test user has a simple password for easy testing
- Test subscription and customer IDs are clearly marked
- Never use these credentials in production
- Always clean up test data before deploying to production

## Support

If you encounter issues with the seed scripts:

1. Check the console output for detailed error messages
2. Verify your environment variables are correct
3. Ensure your Supabase project is properly configured
4. Check that the database schema matches the expected structure

For more help, refer to the main [README.md](README.md) or the Supabase documentation.
