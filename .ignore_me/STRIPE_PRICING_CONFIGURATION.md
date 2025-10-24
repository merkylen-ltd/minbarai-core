# Stripe Pricing Configuration Guide

## How Stripe Handles Pricing

### 1. **Dynamic Price Creation**
Your application creates Stripe prices dynamically based on your pricing configuration:

```typescript
// When a user subscribes, the system:
1. Gets plan data from lib/pricing.ts
2. Creates a Stripe product (if needed)
3. Creates a Stripe price with the current amount
4. Uses that price for the subscription
```

### 2. **Price Storage in Stripe**
- **Products**: Store plan information (name, description)
- **Prices**: Store actual pricing (amount, currency, interval)
- **Subscriptions**: Link customers to specific prices

### 3. **Database Integration**
- Your database stores subscription **status**, not prices
- Stripe handles all pricing logic and billing
- Webhooks update your database when subscriptions change

## Configuration Checklist

### ✅ **Environment Variables Setup**

Create a `.env.local` file with these variables:

```bash
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_...                    # Your Stripe secret key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...   # Your Stripe publishable key
STRIPE_WEBHOOK_SECRET=whsec_...                  # Your webhook secret
NEXT_PUBLIC_STRIPE_PRICE_ID=price_...            # Default price ID (optional)
```

### ✅ **Stripe Dashboard Setup**

#### Step 1: Create Products and Prices
1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Navigate to **Products** → **Add product**
3. Create products for each plan:

**Professional Beta Product:**
- Name: `Professional Beta`
- Description: `Early access to professional features`
- Pricing: `€99.00/month` (recurring)

**Enterprise Beta Product:**
- Name: `Enterprise Beta` 
- Description: `For large organizations and masjids`
- Pricing: `Coming Soon` (or set a price)

#### Step 2: Get Price IDs
1. After creating products, copy the **Price ID** (starts with `price_`)
2. Update your environment variables:

```bash
NEXT_PUBLIC_STRIPE_PRICE_ID=price_1234567890abcdef
```

#### Step 3: Set Up Webhooks
1. Go to **Developers** → **Webhooks**
2. Click **Add endpoint**
3. **Endpoint URL**: `https://minbarai.com/api/stripe/webhooks`
4. Select these events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. Copy the **Webhook signing secret**

### ✅ **Application Configuration**

#### Update Pricing Configuration
Edit `lib/pricing.ts` to match your Stripe products:

```typescript
export const PRICING_CONFIG: PricingConfig = {
  currency: 'EUR',
  currencySymbol: '€',
  defaultPriceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID || 'price_placeholder_50_euro_monthly',
  plans: [
    {
      id: 'professional',
      name: 'Professional Beta',
      description: 'Early access to professional features',
      price: 50,
      originalPrice: 120,
      interval: 'month',
      stripePriceId: 'price_1234567890abcdef', // ← Your actual Stripe price ID
      // ... rest of configuration
    }
  ]
}
```

## Verification Steps

### 1. **Test Environment Setup**

Run this command to verify your Stripe configuration:

```bash
# Check if environment variables are set
echo $STRIPE_SECRET_KEY
echo $NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
echo $STRIPE_WEBHOOK_SECRET
```

### 2. **Test Checkout Flow**

1. Start your development server: `npm run dev`
2. Navigate to `/subscribe`
3. Select a plan and click "Subscribe"
4. Check browser console for errors
5. Verify Stripe checkout page loads correctly

### 3. **Test Webhook Integration**

1. Complete a test subscription
2. Check your Stripe dashboard for the subscription
3. Verify your database is updated with subscription status
4. Check webhook logs in Stripe dashboard

### 4. **Test Price Updates**

1. Change a price in `lib/pricing.ts`
2. Restart your development server
3. Verify the new price appears on the subscribe page
4. Test a new subscription with the updated price

## Common Configuration Issues

### ❌ **Issue: "Stripe is not properly configured"**

**Solution:**
```bash
# Check your .env.local file
STRIPE_SECRET_KEY=sk_test_...  # Must start with sk_test_ or sk_live_
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...  # Must start with pk_test_ or pk_live_
```

### ❌ **Issue: "Price ID not configured"**

**Solution:**
1. Create a product in Stripe dashboard
2. Copy the price ID (starts with `price_`)
3. Update your environment variable:
```bash
NEXT_PUBLIC_STRIPE_PRICE_ID=price_1234567890abcdef
```

### ❌ **Issue: "Webhook signature verification failed"**

**Solution:**
1. Check your webhook secret in `.env.local`
2. Verify webhook URL is correct
3. Ensure webhook events are selected
4. Test webhook endpoint manually

### ❌ **Issue: "Subscription not updating in database"**

**Solution:**
1. Check webhook endpoint is accessible
2. Verify webhook secret is correct
3. Check webhook logs in Stripe dashboard
4. Ensure database connection is working

## Production vs Development

### **Development Setup**
```bash
# Use test keys
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Use localhost URLs
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### **Production Setup**
```bash
# Use live keys (after testing)
STRIPE_SECRET_KEY=sk_live_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Use production URLs
NEXT_PUBLIC_SITE_URL=https://minbarai.com
```

## Monitoring and Maintenance

### **Regular Checks**

1. **Monitor Stripe Dashboard**
   - Check for failed payments
   - Monitor webhook delivery
   - Review subscription metrics

2. **Check Application Logs**
   - Monitor webhook processing
   - Check for Stripe API errors
   - Verify subscription updates

3. **Test Price Changes**
   - Always test price updates in development
   - Verify new prices work correctly
   - Check existing subscriptions remain unchanged

### **Security Best Practices**

1. **Never expose secret keys**
   - Keep `STRIPE_SECRET_KEY` server-side only
   - Use environment variables
   - Don't commit keys to version control

2. **Validate webhook signatures**
   - Always verify webhook authenticity
   - Use HTTPS for webhook endpoints
   - Implement rate limiting

3. **Handle errors gracefully**
   - Provide user-friendly error messages
   - Log detailed errors server-side
   - Implement retry logic for failed operations

## Troubleshooting Commands

### **Check Stripe Configuration**
```bash
# Test Stripe API connection
curl -u sk_test_...: https://api.stripe.com/v1/products
```

### **Test Webhook Endpoint**
```bash
# Test webhook URL accessibility
curl -X POST https://minbarai.com/api/stripe/webhooks
```

### **Check Environment Variables**
```bash
# Verify all required variables are set
node -e "console.log(process.env.STRIPE_SECRET_KEY ? '✅ Secret key set' : '❌ Secret key missing')"
node -e "console.log(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ? '✅ Publishable key set' : '❌ Publishable key missing')"
node -e "console.log(process.env.STRIPE_WEBHOOK_SECRET ? '✅ Webhook secret set' : '❌ Webhook secret missing')"
```

## Summary

Your Stripe pricing system works by:

1. **Configuration**: Prices defined in `lib/pricing.ts`
2. **Dynamic Creation**: Stripe products/prices created on-demand
3. **Subscription**: Users subscribe through Stripe checkout
4. **Webhooks**: Stripe updates your database via webhooks
5. **Management**: All billing handled by Stripe

The key is ensuring all environment variables are correctly set and your Stripe dashboard is properly configured with the right products, prices, and webhooks.
