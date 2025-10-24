# MinbarAI Production Checklist

## 🌐 **Your Official Website: minbarai.com**

## ✅ **What's Already Configured:**

1. **Environment Variables**: Updated to use `https://minbarai.com`
2. **Stripe Price ID**: `price_1SB0jD484U6B4yaGMAb6nlZ8`
3. **Supabase Database**: Ready with proper schema and RLS
4. **Webhook Handler**: Production-ready with security features

## 🚀 **What You Need to Do:**

### 1. **Set Up Stripe Webhook (Production)**

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

### 2. **Get Production Webhook Secret**

1. After creating the webhook, click on it
2. Click **"Reveal"** next to "Signing secret"
3. Copy the secret (starts with `whsec_`)

### 3. **Update Production Environment**

Add this to your production environment variables:
```bash
STRIPE_WEBHOOK_SECRET=whsec_your_production_webhook_secret_here
```

### 4. **Switch to LIVE Stripe Keys**

For production, you'll need LIVE Stripe keys (not test keys):
```bash
# Replace with your LIVE keys from Stripe Dashboard
STRIPE_SECRET_KEY=sk_live_your_production_secret_key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_your_production_publishable_key
```

## 🗄️ **Supabase Configuration**

### **Already Ready:**
- ✅ Database schema deployed
- ✅ User authentication configured
- ✅ Subscription management tables
- ✅ Row Level Security (RLS) enabled
- ✅ Service role permissions for webhooks

### **No Additional Setup Needed:**
Your Supabase is already configured to handle webhooks securely with the service role key.

## 🧪 **Testing Your Production Setup**

### **Local Testing (Current):**
- **URL**: https://minberai-test.loca.lt
- **Webhook**: https://minberai-test.loca.lt/api/stripe/webhooks
- **Status**: ✅ Working with LocalTunnel

### **Production Testing:**
- **URL**: https://minbarai.com
- **Webhook**: https://minbarai.com/api/stripe/webhooks
- **Status**: ⏳ Ready after webhook setup

## 📋 **Deployment Steps**

1. **Deploy your app** to minbarai.com
2. **Set up Stripe webhook** with production URL
3. **Configure environment variables** with LIVE keys
4. **Test subscription flow** on production
5. **Monitor webhook events** in Stripe dashboard

## 🎯 **Current Status**

- ✅ **Local development**: Working with LocalTunnel
- ✅ **Production code**: Ready for deployment
- ✅ **Database**: Supabase configured
- ✅ **Webhook handler**: Production-ready
- ⏳ **Production webhook**: Needs Stripe configuration
- ⏳ **Live Stripe keys**: Need to be set up

## 🚨 **Important Notes**

1. **Use LIVE Stripe keys** for production (not test keys)
2. **Webhook URL must be HTTPS** (minbarai.com)
3. **Test thoroughly** before going live
4. **Monitor webhook events** for failures
5. **Keep webhook secret secure**

## 🎉 **Ready for Production!**

Your MinbarAI application is ready for production deployment at minbarai.com. Just set up the Stripe webhook and you're good to go!
