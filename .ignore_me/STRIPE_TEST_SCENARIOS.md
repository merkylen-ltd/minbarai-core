# Stripe Integration - Test Scenarios Quick Reference

## Quick Setup

```bash
# 1. Install Stripe CLI
stripe login

# 2. Forward webhooks to local
stripe listen --forward-to localhost:3000/api/stripe/webhooks

# 3. Copy webhook secret to .env.local
STRIPE_WEBHOOK_SECRET=whsec_xxx  # from stripe listen output
```

## Test Scenarios Checklist

### ✅ 1. Happy Path - Complete Subscription

**Steps:**
1. Navigate to `/subscribe`
2. Select "MinbarAI Pro Beta" plan
3. Click "Subscribe Now"
4. Complete Stripe Checkout with test card: `4242 4242 4242 4242`
5. Redirected to `/dashboard/success`
6. After 2-10 seconds, redirected to `/dashboard`

**Expected Results:**
- ✅ Webhook received: `checkout.session.completed`
- ✅ Webhook received: `customer.subscription.created`  
- ✅ Database: `subscription_status = 'active'`
- ✅ Dashboard access granted
- ✅ Billing page shows active subscription

**SQL Verification:**
```sql
SELECT email, subscription_status, subscription_id, customer_id 
FROM users 
WHERE email = 'your-test-email@example.com';

SELECT id, event_type, status 
FROM stripe_webhook_events 
ORDER BY created_at DESC 
LIMIT 5;
```

---

### ✅ 2. Duplicate Subscription Prevention

**Steps:**
1. Complete Test #1 (have active subscription)
2. Navigate to `/subscribe` again
3. Try to subscribe to any plan

**Expected Results:**
- ✅ Error message: "You already have an active subscription"
- ✅ Redirected or blocked from creating checkout
- ✅ No duplicate subscription created

---

### ✅ 3. Subscription Cancellation (Cancel at Period End)

**Steps:**
1. Navigate to `/dashboard/billing`
2. Click "Cancel Subscription"
3. Confirm cancellation

**Expected Results:**
- ✅ Success message: "Subscription will be canceled at end of billing period"
- ✅ Dashboard access still works
- ✅ Billing page shows cancellation notice with date
- ✅ Webhook received: `customer.subscription.updated` (cancel_at_period_end=true)
- ✅ User retains access until subscription_period_end

**Stripe Dashboard Check:**
- Go to Customers → Find your customer
- Subscription should show "Cancels on [date]"

---

### ✅ 4. Failed Payment

**Test Card:** `4000 0000 0000 9995` (always declines)

**Steps:**
1. Create subscription with failing test card
2. OR use Stripe CLI: `stripe trigger invoice.payment_failed`

**Expected Results:**
- ✅ Webhook received: `invoice.payment_failed`
- ✅ Database: `subscription_status = 'past_due'`
- ✅ Dashboard access blocked
- ✅ Redirected to `/subscribe`
- ✅ Event logged in `stripe_webhook_events`

**SQL Verification:**
```sql
SELECT * FROM stripe_webhook_events 
WHERE event_type = 'invoice.payment_failed' 
ORDER BY created_at DESC LIMIT 1;
```

---

### ✅ 5. Expired Card

**Test Card:** `4000 0000 0000 0069` (expired card)

**Steps:**
1. Try to subscribe with expired card
2. OR trigger: `stripe trigger payment_intent.payment_failed`

**Expected Results:**
- ✅ Payment fails at checkout
- ✅ Webhook received: `payment_intent.payment_failed`
- ✅ Event logged in database
- ✅ User can retry with valid card

---

### ✅ 6. Webhook Idempotency

**Steps:**
1. Complete any webhook event
2. Resend same event: `stripe events resend evt_xxx`

**Expected Results:**
- ✅ First event: Processed successfully
- ✅ Second event: Marked as duplicate
- ✅ Database has only ONE entry for that event ID
- ✅ Webhook returns: `{"received":true,"idempotent":true}`

**SQL Verification:**
```sql
SELECT id, event_type, status, created_at 
FROM stripe_webhook_events 
WHERE id = 'evt_xxx';
-- Should return only ONE row
```

---

### ✅ 7. Database Out of Sync

**Steps:**
1. Manually change subscription status in Stripe Dashboard
   - Go to Subscriptions → Cancel subscription
2. Try to create new checkout session (without refresh)

**Expected Results:**
- ✅ System detects discrepancy
- ✅ Database synced with Stripe
- ✅ User sees error with actual status
- ✅ No duplicate subscription created

---

### ✅ 8. Plan Upgrade/Downgrade

**Setup:**
- Create two price IDs in Stripe Dashboard (e.g., $99/month and $199/month)

**Steps:**
```bash
# 1. Preview the change
curl -X GET "http://localhost:3000/api/stripe/change-subscription?new_price_id=price_xxx" \
  -H "Cookie: your-session-cookie"

# 2. Execute the change
curl -X POST http://localhost:3000/api/stripe/change-subscription \
  -H "Cookie: your-session-cookie" \
  -H "Content-Type: application/json" \
  -d '{"new_price_id":"price_xxx","proration_behavior":"create_prorations"}'
```

**Expected Results:**
- ✅ Preview shows proration amount
- ✅ Subscription updated immediately
- ✅ Webhook received: `customer.subscription.updated`
- ✅ Database updated with new details
- ✅ Proration applied to next invoice

**Stripe Dashboard Check:**
- Subscription should show new price
- Upcoming invoice should show proration

---

### ✅ 9. Customer Portal

**Steps:**
1. Navigate to `/dashboard/billing`
2. Click "Update Payment Method" or "Stripe Customer Portal"

**Expected Results:**
- ✅ Redirected to Stripe-hosted portal
- ✅ Can update payment method
- ✅ Can view invoices
- ✅ Changes synced via webhooks:
  - `payment_method.attached`
  - `payment_method.detached`
  - `customer.updated`

---

### ✅ 10. Checkout Session Expiration

**Steps:**
1. Create checkout session
2. Copy URL but DON'T complete it
3. Wait 30 minutes

**Expected Results:**
- ✅ Checkout session expires
- ✅ Webhook received: `checkout.session.expired`
- ✅ Event logged in database
- ✅ Can create new session

---

## Stripe CLI Test Commands

```bash
# Trigger various events
stripe trigger checkout.session.completed
stripe trigger customer.subscription.created
stripe trigger customer.subscription.updated
stripe trigger customer.subscription.deleted
stripe trigger invoice.payment_succeeded
stripe trigger invoice.payment_failed
stripe trigger payment_intent.payment_failed
stripe trigger charge.dispute.created

# Resend an event (for idempotency testing)
stripe events resend evt_xxx

# List recent events
stripe events list --limit 10

# View event details
stripe events retrieve evt_xxx
```

---

## Test Cards Reference

```
# Success
4242 4242 4242 4242  - Success (any CVC, future date)

# Failures
4000 0000 0000 9995  - Always declines
4000 0000 0000 0069  - Expired card
4000 0000 0000 0341  - Charge succeeds but customer.source.expiring_soon
4000 0000 0000 9987  - Charge succeeds but insufficient_funds on withdrawal

# 3D Secure
4000 0025 0000 3155  - 3D Secure required
4000 0027 6000 3184  - 3D Secure required (frictionless)

# More: https://stripe.com/docs/testing#cards
```

---

## Database Health Checks

```sql
-- Webhook statistics (last 24 hours)
SELECT * FROM get_webhook_statistics(24);

-- Failed webhooks
SELECT id, event_type, processing_error, retry_count 
FROM stripe_webhook_events 
WHERE status = 'failed' 
ORDER BY created_at DESC;

-- Recent subscriptions
SELECT email, subscription_status, subscription_period_end 
FROM users 
WHERE subscription_status IS NOT NULL 
ORDER BY updated_at DESC;

-- Canceled subscriptions with access remaining
SELECT 
  email,
  subscription_period_end,
  EXTRACT(EPOCH FROM (subscription_period_end - NOW())) / 86400 as days_remaining
FROM users
WHERE subscription_status = 'canceled'
  AND subscription_period_end > NOW()
ORDER BY subscription_period_end ASC;
```

---

## Production Pre-Launch Checklist

### Configuration ✅
- [ ] Production Stripe keys in environment variables
- [ ] Webhook endpoint added in Stripe Dashboard
- [ ] Webhook secret configured
- [ ] Database migration applied
- [ ] SSL/HTTPS enabled

### Testing ✅  
- [ ] All 10 test scenarios passed
- [ ] Webhook idempotency verified
- [ ] Failed payment handling tested
- [ ] Cancellation flow tested
- [ ] Customer portal tested

### Monitoring ✅
- [ ] Webhook statistics query working
- [ ] Failed webhook alerts configured
- [ ] Log aggregation set up (Datadog/Sentry)
- [ ] Database cleanup scheduled

### Documentation ✅
- [ ] Team trained on Stripe Dashboard
- [ ] Support docs for common issues
- [ ] Runbook for webhook failures
- [ ] Contact info for Stripe support

---

## Quick Troubleshooting

**Webhook not received?**
1. Check Stripe CLI is running: `stripe listen`
2. Verify webhook secret in `.env.local`
3. Check Stripe Dashboard → Developers → Webhooks → Events
4. Look for signature verification errors in logs

**Database not updated?**
1. Check webhook succeeded: `SELECT * FROM stripe_webhook_events WHERE status='completed'`
2. Verify user exists: `SELECT * FROM users WHERE email='...'`
3. Check RLS policies: Ensure service_role has permissions
4. Look for errors in webhook handler logs

**Subscription not showing?**
1. Wait 2-5 seconds (webhook processing)
2. Check Stripe Dashboard for subscription
3. Query database directly: `SELECT * FROM users WHERE id='...'`
4. Verify webhook was processed: `SELECT * FROM stripe_webhook_events WHERE event_type LIKE '%subscription%'`

**Can't create new subscription?**
1. Check existing status: `SELECT subscription_status FROM users WHERE id='...'`
2. Check Stripe Dashboard for active subscriptions
3. Cancel existing subscription first
4. System auto-syncs if out of sync

---

**Need More Help?**
- Full documentation: `STRIPE_INTEGRATION_FIXES.md`
- Stripe API Docs: https://stripe.com/docs/api
- Stripe Testing: https://stripe.com/docs/testing
- Stripe Support: https://support.stripe.com

