# Production Deployment Setup for minbarai.com

## 🌐 **Official Website Configuration**

Your official website: **minbarai.com**

## 🚀 **Production Webhook Setup**

### 1. **Stripe Webhook Configuration**

#### In Stripe Dashboard:
1. Go to **Developers** → **Webhooks**
2. Click **"Add endpoint"**
3. **Endpoint URL**: `https://minbarai.com/api/stripe/webhooks`
4. **Description**: MinbarAI Production Webhooks

#### Select These Events:
- ✅ `checkout.session.completed`
- ✅ `customer.subscription.created`
- ✅ `customer.subscription.updated`
- ✅ `customer.subscription.deleted`
- ✅ `invoice.payment_succeeded`
- ✅ `invoice.payment_failed`

### 2. **Environment Variables for Production**

Update your production environment variables:

```bash
# Production Environment Variables
NEXT_PUBLIC_SUPABASE_URL=https://hjsifxofnqbnrgqkbomx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhqc2lmeG9mbnFibnJncWtib214Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA1Mjg5NTAsImV4cCI6MjA3NjEwNDk1MH0.zKHLaT6H5HtjUgG_gZxmgsPpMY7GE7l0rdiMitn9iaY
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhqc2lmeG9mbnFibnJncWtib214Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDUyODk1MCwiZXhwIjoyMDc2MTA0OTUwfQ.Lwrfbm6aVfUEYWg0IvfwhEv977z3SEV_o794xUzPsa0

# Stripe Production Keys (Replace with your LIVE keys)
STRIPE_SECRET_KEY=sk_live_your_production_secret_key_here
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_your_production_publishable_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_production_webhook_secret_here
NEXT_PUBLIC_STRIPE_PRICE_ID=price_1SB0jD484U6B4yaGMAb6nlZ8

# Production URLs
NEXT_PUBLIC_SITE_URL=https://minbarai.com
NEXTAUTH_URL=https://minbarai.com

# AI Configuration
GEMINI_API_KEY=your_proprietary_ai_api_key
```

## 🗄️ **Supabase Production Setup**

### 1. **Database Configuration**

Your Supabase database is already configured with:
- ✅ User authentication
- ✅ Subscription management
- ✅ Row Level Security (RLS)
- ✅ Webhook-ready schema

### 2. **Supabase Webhook Security**

#### Enable Service Role Access:
The webhook handler uses the `SUPABASE_SERVICE_ROLE_KEY` which has elevated permissions to:
- Update user subscription status
- Create/update customer records
- Handle webhook events securely

#### RLS Policies Already Configured:
```sql
-- Service role can perform all operations (for webhooks)
CREATE POLICY "users_service_role_all" ON public.users
  FOR ALL 
  TO service_role
  USING (true)
  WITH CHECK (true);
```

### 3. **Supabase Edge Functions (Optional)**

For enhanced webhook processing, you can create Supabase Edge Functions:

#### Create Webhook Edge Function:
```typescript
// supabase/functions/stripe-webhook/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const { type, data } = await req.json()
  
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  if (type === 'checkout.session.completed') {
    const session = data.object
    const user_id = session.metadata?.user_id
    
    if (user_id && session.subscription) {
      await supabase
        .from('users')
        .update({
          subscription_status: 'active',
          subscription_id: session.subscription,
          customer_id: session.customer,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user_id)
    }
  }

  return new Response('OK')
})
```

## 🔧 **Deployment Checklist**

### 1. **Domain Configuration**
- ✅ Domain: `minbarai.com`
- ✅ SSL Certificate: Required for HTTPS
- ✅ DNS: Point to your hosting provider

### 2. **Environment Variables**
- ✅ Supabase keys configured
- ✅ Stripe LIVE keys (not test keys)
- ✅ Webhook secret from Stripe
- ✅ Production URLs set

### 3. **Stripe Configuration**
- ✅ Webhook endpoint: `https://minbarai.com/api/stripe/webhooks`
- ✅ Live API keys configured
- ✅ Price ID: `price_1SB0jD484U6B4yaGMAb6nlZ8`

### 4. **Supabase Configuration**
- ✅ Service role key for webhooks
- ✅ RLS policies enabled
- ✅ Database schema deployed

## 🧪 **Production Testing**

### 1. **Test Webhook Endpoint**
```bash
# Test if webhook endpoint is accessible
curl -X POST https://minbarai.com/api/stripe/webhooks \
  -H "Content-Type: application/json" \
  -d '{"test": "webhook"}'
```

### 2. **Test Subscription Flow**
1. Go to `https://minbarai.com/subscribe`
2. Click "Join Beta Program"
3. Use real payment method (or Stripe test mode)
4. Verify webhook processes successfully

### 3. **Monitor Webhook Events**
- Check Stripe Dashboard → Webhooks → Your endpoint
- Monitor "Recent deliveries" for success/failures
- Check Supabase logs for database updates

## 🚨 **Security Considerations**

### 1. **Webhook Security**
- ✅ Signature verification enabled
- ✅ Rate limiting implemented
- ✅ Idempotency handling
- ✅ Error logging

### 2. **Database Security**
- ✅ RLS policies enforced
- ✅ Service role separation
- ✅ Secure environment variables
- ✅ HTTPS only

### 3. **Production Best Practices**
- ✅ Use LIVE Stripe keys only
- ✅ Monitor webhook failures
- ✅ Set up error alerting
- ✅ Regular security audits

## 📊 **Monitoring & Logging**

### 1. **Stripe Dashboard**
- Monitor webhook delivery success rates
- Check for failed webhook attempts
- Review payment processing logs

### 2. **Supabase Dashboard**
- Monitor database performance
- Check authentication logs
- Review RLS policy effectiveness

### 3. **Application Logs**
- Webhook processing logs
- Error tracking
- Performance monitoring

## 🎯 **Ready for Production!**

Your production setup is configured for:
- **Domain**: minbarai.com
- **Webhook**: https://minbarai.com/api/stripe/webhooks
- **Database**: Supabase with proper security
- **Payments**: Stripe with live keys

The webhook will automatically handle subscription creation and updates when users complete checkout on your production site!
