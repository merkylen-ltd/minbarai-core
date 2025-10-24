================================================================================
                    MINBERAI ENVIRONMENT VARIABLES DOCUMENTATION
================================================================================

This document contains all environment variables used in the MinberAI project,
organized by category with their purposes, origins, and usage contexts.

================================================================================
                                TABLE OF CONTENTS
================================================================================

1. SUPABASE DATABASE VARIABLES
2. STRIPE PAYMENT VARIABLES  
3. AI SERVICE VARIABLES
4. APPLICATION URL VARIABLES
5. NEXT.JS FRAMEWORK VARIABLES
6. VERCEL DEPLOYMENT VARIABLES
7. DEVELOPMENT/DEBUGGING VARIABLES

================================================================================
                        1. SUPABASE DATABASE VARIABLES
================================================================================

NEXT_PUBLIC_SUPABASE_URL
├── Value: https://hjsifxofnqbnrgqkbomx.supabase.co
├── Purpose: Public URL for Supabase database connection
├── Origin: Supabase project dashboard → Settings → API
├── Usage: 
│   ├── Client-side Supabase initialization (lib/supabase/client.ts)
│   ├── Server-side Supabase initialization (lib/supabase/server.ts)
│   ├── API routes for database operations (app/api/stripe/webhooks/route.ts)
│   └── Scripts for database seeding (scripts/seed-database.js, scripts/create-test-customer.js)
├── Security: Public (safe to expose in frontend)
└── Required: YES

NEXT_PUBLIC_SUPABASE_ANON_KEY
├── Value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhqc2lmeG9mbnFibnJncWtib214Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA1Mjg5NTAsImV4cCI6MjA3NjEwNDk1MH0.zKHLaT6H5HtjUgG_gZxmgsPpMY7GE7l0rdiMitn9iaY
├── Purpose: Anonymous/public key for Supabase authentication
├── Origin: Supabase project dashboard → Settings → API → Project API keys
├── Usage:
│   ├── Client-side authentication (lib/supabase/client.ts)
│   ├── Server-side authentication (lib/supabase/server.ts)
│   └── Public database queries
├── Security: Public (safe to expose in frontend)
└── Required: YES

SUPABASE_SERVICE_ROLE_KEY
├── Value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhqc2lmeG9mbnFibnJncWtib214Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDUyODk1MCwiZXhwIjoyMDc2MTA0OTUwfQ.Lwrfbm6aVfUEYWg0IvfwhEv977z3SEV_o794xUzPsa0
├── Purpose: Service role key for administrative database operations
├── Origin: Supabase project dashboard → Settings → API → Service Role key
├── Usage:
│   ├── Server-side admin operations (lib/supabase/server.ts)
│   ├── Webhook processing (app/api/stripe/webhooks/route.ts)
│   ├── Database seeding scripts (scripts/seed-database.js, scripts/create-test-customer.js)
│   └── Bypasses Row Level Security (RLS) policies
├── Security: PRIVATE (never expose in frontend)
└── Required: YES

================================================================================
                          2. STRIPE PAYMENT VARIABLES
================================================================================

STRIPE_SECRET_KEY
├── Value: sk_test_... (placeholder in env.example)
├── Purpose: Secret API key for Stripe server-side operations
├── Origin: Stripe Dashboard → Developers → API Keys → Secret key
├── Usage:
│   ├── Stripe client initialization (lib/stripe/config.ts)
│   ├── Creating checkout sessions (app/api/stripe/checkout/route.ts)
│   ├── Creating customer portal sessions (app/api/stripe/portal/route.ts)
│   ├── Processing webhooks (app/api/stripe/webhooks/route.ts)
│   ├── Subscription management (app/api/stripe/cancel-subscription/route.ts)
│   └── Configuration verification (scripts/verify-stripe-config.js)
├── Security: PRIVATE (never expose in frontend)
└── Required: YES

NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
├── Value: pk_test_... (placeholder in env.example)
├── Purpose: Publishable API key for Stripe client-side operations
├── Origin: Stripe Dashboard → Developers → API Keys → Publishable key
├── Usage:
│   ├── Frontend Stripe integration
│   ├── Payment form initialization
│   └── Configuration verification (scripts/verify-stripe-config.js)
├── Security: Public (safe to expose in frontend)
└── Required: YES

STRIPE_WEBHOOK_SECRET
├── Value: whsec_... (placeholder in env.example)
├── Purpose: Webhook endpoint secret for verifying Stripe webhook signatures
├── Origin: Stripe Dashboard → Developers → Webhooks → Endpoint secret
├── Usage:
│   ├── Webhook signature verification (app/api/stripe/webhooks/route.ts)
│   ├── Ensuring webhook authenticity
│   └── Configuration verification (scripts/verify-stripe-config.js)
├── Security: PRIVATE (never expose in frontend)
└── Required: YES

NEXT_PUBLIC_STRIPE_PRICE_ID
├── Value: price_1SB0jD484U6B4yaGMAb6nlZ8 (example in env.example)
├── Purpose: Stripe Price ID for the €99/month subscription product
├── Origin: Stripe Dashboard → Products → Create Price → Price ID
├── Usage:
│   ├── Pricing configuration (lib/pricing.ts)
│   ├── Checkout session creation
│   ├── Subscription management
│   └── Configuration verification (scripts/verify-stripe-config.js)
├── Security: Public (safe to expose in frontend)
└── Required: YES

================================================================================
                           3. AI SERVICE VARIABLES
================================================================================

GEMINI_API_KEY
├── Value: your_proprietary_ai_api_key (placeholder in env.example)
├── Purpose: API key for Google Gemini AI translation service
├── Origin: Google AI Studio → Get API Key
├── Usage:
│   ├── AI translation service (app/api/ai/translate/route.ts)
│   ├── Real-time speech translation
│   └── Multi-language support
├── Security: PRIVATE (never expose in frontend)
└── Required: YES

================================================================================
                         4. APPLICATION URL VARIABLES
================================================================================

NEXT_PUBLIC_SITE_URL
├── Value: http://localhost:3000 (development) / https://minbarai.com (production)
├── Purpose: Base URL for the application
├── Origin: Application configuration
├── Usage:
│   ├── Stripe redirect URLs (app/api/stripe/checkout/route.ts)
│   ├── Customer portal return URLs (app/api/stripe/portal/route.ts)
│   ├── Configuration verification (scripts/verify-stripe-config.js)
│   └── Environment-specific URL generation
├── Security: Public (safe to expose in frontend)
└── Required: YES

NEXTAUTH_URL
├── Value: http://localhost:3000 (development) / https://minbarai.com (production)
├── Purpose: Base URL for NextAuth.js authentication
├── Origin: NextAuth.js configuration requirement
├── Usage:
│   ├── Authentication callback URLs
│   ├── OAuth provider redirects
│   └── Session management
├── Security: Public (safe to expose in frontend)
└── Required: YES (if using NextAuth.js)

================================================================================
                       5. NEXT.JS FRAMEWORK VARIABLES
================================================================================

NODE_ENV
├── Value: development | production | test
├── Purpose: Node.js environment identifier
├── Origin: Automatically set by Node.js runtime
├── Usage:
│   ├── Environment-specific URL generation (app/api/stripe/checkout/route.ts)
│   ├── Error handling (components/dashboard/ErrorBoundary.tsx)
│   ├── Development vs production behavior
│   └── Conditional logic throughout the application
├── Security: Public (automatically set)
└── Required: Automatically set

================================================================================
                       6. VERCEL DEPLOYMENT VARIABLES
================================================================================

NEXT_TELEMETRY_DISABLED
├── Value: 1
├── Purpose: Disables Next.js telemetry data collection
├── Origin: Vercel configuration (vercel.json)
├── Usage:
│   ├── Privacy compliance
│   ├── Reduced data collection
│   └── Deployment optimization
├── Security: Public (safe to expose)
└── Required: NO (optional)

================================================================================
                      7. DEVELOPMENT/DEBUGGING VARIABLES
================================================================================

DATABASE_URL
├── Value: your_database_url (placeholder in env.example)
├── Purpose: External database connection URL (if not using Supabase)
├── Origin: Database provider connection string
├── Usage:
│   ├── Alternative database connection
│   ├── Migration scripts
│   └── Development database setup
├── Security: PRIVATE (never expose in frontend)
└── Required: NO (Supabase is primary database)

================================================================================
                              SECURITY CLASSIFICATION
================================================================================

PUBLIC VARIABLES (Safe to expose in frontend):
├── NEXT_PUBLIC_SUPABASE_URL
├── NEXT_PUBLIC_SUPABASE_ANON_KEY
├── NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
├── NEXT_PUBLIC_STRIPE_PRICE_ID
├── NEXT_PUBLIC_SITE_URL
├── NEXTAUTH_URL
├── NODE_ENV
└── NEXT_TELEMETRY_DISABLED

PRIVATE VARIABLES (Never expose in frontend):
├── SUPABASE_SERVICE_ROLE_KEY
├── STRIPE_SECRET_KEY
├── STRIPE_WEBHOOK_SECRET
├── GEMINI_API_KEY
└── DATABASE_URL

================================================================================
                              REQUIRED VS OPTIONAL
================================================================================

REQUIRED VARIABLES (Application won't work without these):
├── NEXT_PUBLIC_SUPABASE_URL
├── NEXT_PUBLIC_SUPABASE_ANON_KEY
├── SUPABASE_SERVICE_ROLE_KEY
├── STRIPE_SECRET_KEY
├── NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
├── STRIPE_WEBHOOK_SECRET
├── NEXT_PUBLIC_STRIPE_PRICE_ID
├── GEMINI_API_KEY
└── NEXT_PUBLIC_SITE_URL

OPTIONAL VARIABLES (Application can work without these):
├── NEXTAUTH_URL (if not using NextAuth.js)
├── NEXT_TELEMETRY_DISABLED
├── DATABASE_URL (if using Supabase)
└── NODE_ENV (automatically set)

================================================================================
                              USAGE CONTEXTS
================================================================================

AUTHENTICATION & USER MANAGEMENT:
├── NEXT_PUBLIC_SUPABASE_URL
├── NEXT_PUBLIC_SUPABASE_ANON_KEY
├── SUPABASE_SERVICE_ROLE_KEY
└── NEXTAUTH_URL

PAYMENT PROCESSING:
├── STRIPE_SECRET_KEY
├── NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
├── STRIPE_WEBHOOK_SECRET
├── NEXT_PUBLIC_STRIPE_PRICE_ID
└── NEXT_PUBLIC_SITE_URL

AI TRANSLATION:
└── GEMINI_API_KEY

DATABASE OPERATIONS:
├── NEXT_PUBLIC_SUPABASE_URL
├── NEXT_PUBLIC_SUPABASE_ANON_KEY
├── SUPABASE_SERVICE_ROLE_KEY
└── DATABASE_URL

DEPLOYMENT & CONFIGURATION:
├── NEXT_PUBLIC_SITE_URL
├── NODE_ENV
├── NEXT_TELEMETRY_DISABLED
└── NEXTAUTH_URL

================================================================================
                              SETUP INSTRUCTIONS
================================================================================

1. COPY ENVIRONMENT FILE:
   cp env.example .env.local

2. SUPABASE SETUP:
   - Go to https://supabase.com/dashboard
   - Create new project
   - Copy URL and keys from Settings → API

3. STRIPE SETUP:
   - Go to https://dashboard.stripe.com/
   - Get API keys from Developers → API Keys
   - Create product with €99/month pricing
   - Set up webhook endpoint: https://minbarai.com/api/stripe/webhooks

4. AI SERVICE SETUP:
   - Go to https://aistudio.google.com/
   - Create API key for Gemini service

5. URL CONFIGURATION:
   - Development: http://localhost:3000
   - Production: https://minbarai.com

================================================================================
                              TROUBLESHOOTING
================================================================================

COMMON ISSUES:
├── 500 errors: Check if Stripe keys are real (not placeholders)
├── Database errors: Verify Supabase URL and keys
├── Translation errors: Verify GEMINI_API_KEY is valid
├── Webhook errors: Check STRIPE_WEBHOOK_SECRET matches endpoint
└── Redirect errors: Verify NEXT_PUBLIC_SITE_URL is correct

VERIFICATION COMMANDS:
├── node -e "console.log(process.env.STRIPE_SECRET_KEY ? '✅ Secret key set' : '❌ Secret key missing')"
├── node -e "console.log(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ? '✅ Publishable key set' : '❌ Publishable key missing')"
└── node -e "console.log(process.env.STRIPE_WEBHOOK_SECRET ? '✅ Webhook secret set' : '❌ Webhook secret missing')"

================================================================================
                                END OF DOCUMENT
================================================================================

Generated on: $(date)
Project: MinberAI - Live Multi-Language Translation SaaS
Version: Production Ready
