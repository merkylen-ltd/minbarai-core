# MinbarAI Running Cost Estimation (Excluding Voiceflow API)

## Executive Summary

This document provides detailed cost estimates for running MinbarAI across three user scale tiers: Basic (1-50 users), Medium (51-500 users), and Scaling (501-5000+ users). All costs are in USD/month and exclude Voiceflow API costs.

---

## Infrastructure Components

### 1. Google Cloud Run (Production)
- **Configuration**: 2 CPU, 2Gi RAM
- **Scaling**: 1-50 instances (min-instances: 1 for low latency)
- **Region**: europe-west1
- **Concurrency**: 100 requests per instance

### 2. Google Cloud Run (Development)
- **Configuration**: 1 CPU, 1Gi RAM
- **Scaling**: 0-10 instances (scale-to-zero)
- **Region**: europe-west1

### 3. Google Cloud Build (CI/CD)
- **Machine Type**: E2_HIGHCPU_8
- **Disk Size**: 100GB
- **Frequency**: Automated on commits

### 4. Google Secret Manager
- Stores: Stripe keys, Supabase service role key

### 5. Google Container Registry
- Docker image storage

### 6. Supabase (Database + Auth + Storage)
- PostgreSQL database
- Authentication service
- File storage (for transcripts)

### 7. Stripe
- Payment processing (transaction fees only)

---

## Cost Assumptions

### User Behavior Patterns
- **Active Users**: Users with active subscriptions
- **Session Duration**: Average 2 hours per session (users have 3-hour limit)
- **Sessions per User**: 10 sessions/month average
- **Request Frequency**: 
  - Ping API: Every 10 seconds during active session = 360 requests/hour
  - Session data API: Every 30 seconds = 120 requests/hour
  - Other API calls: ~50 requests/session
- **Database Operations**: ~500 queries/user/month
- **Storage**: ~1MB transcript/user/session = ~10MB/user/month

### Traffic Patterns
- **Concurrent Sessions**: 30% of active users
- **Peak Hours**: 8 hours/day (business hours)
- **Off-Peak**: 16 hours/day

---

## Cost Breakdown by Scale

### 📊 Basic Tier: 1-50 Active Users

#### Google Cloud Run (Production)
- **Always-on Instance**: 1 instance × 730 hours/month (2,628,000 seconds)
  - CPU: 2 vCPU × 2,628,000 seconds × $0.00002400/vCPU-second = **$126.14**
  - Memory: 2 Gi × 2,628,000 seconds × $0.00000250/Gi-second = **$13.14**
- **Request Cost**: 
  - Estimated requests/month: 50 users × 10 sessions × 50 requests = 25,000 requests
  - 25,000 requests × $0.0000004/request = **$0.01**
- **Total Cloud Run Production**: **$139.29/month**

#### Google Cloud Run (Development)
- **Scale-to-zero**: Assume 10% usage (testing/debugging)
  - 10% × 2,628,000 seconds × (1 CPU × $0.00002400 + 1Gi × $0.00000250) = **$6.96**
- **Total Cloud Run Development**: **$6.96/month**

#### Google Cloud Build
- **Build Time**: 12 minutes average per build
- **Builds**: 20 builds/month (assumes active development)
  - E2_HIGHCPU_8: 8 vCPU × 0.2 hours × 20 × $0.003/vCPU-hour = **$0.96**
  - Storage: 100GB × $0.026/GB/month = **$2.60**
- **Total Cloud Build**: **$3.56/month**

#### Google Secret Manager
- **Secrets**: 3 secrets × $0.06/secret/month = **$0.18/month**

#### Google Container Registry
- **Storage**: 5GB images × $0.026/GB/month = **$0.13/month**
- **Transfer**: Minimal (internal to GCP) = **$0/month**

#### Supabase
- **Database** (PostgreSQL):
  - Queries: 50 users × 500 queries = 25,000 queries/month
  - Bandwidth: ~2GB/month
  - Base plan: **$25/month** (includes 500MB database, 2GB bandwidth)
  - Additional storage: If needed, **$0.125/GB** = ~$0.10/month
- **Authentication**: Included in base plan
- **File Storage**: 50 users × 10MB = 500MB = **Included** (free tier up to 1GB)
- **Total Supabase**: **$25.10/month**

#### Stripe
- **Transaction Fees**: 2.9% + $0.30 per transaction (not infrastructure cost)
- **Infrastructure Cost**: **$0/month** (no monthly fees)

#### **Total Basic Tier: ~$181.13/month**

---

### 📊 Medium Tier: 51-500 Active Users

#### Google Cloud Run (Production)
- **Base Instances**: 2 instances (for redundancy) × 2,628,000 seconds
  - CPU: 4 vCPU × 2,628,000 seconds × $0.00002400 = **$252.29**
  - Memory: 4 Gi × 2,628,000 seconds × $0.00000250 = **$26.28**
- **Scaling Instances**: Peak usage = 5 instances average
  - Additional: 3 instances × 2,628,000 seconds × (2 CPU × $0.00002400 + 2Gi × $0.00000250) = **$417.85**
- **Request Cost**:
  - Requests: 500 users × 10 sessions × 50 requests = 250,000 requests
  - 250,000 × $0.0000004 = **$0.10**
- **Total Cloud Run Production**: **$696.52/month**

#### Google Cloud Run (Development)
- **Development Usage**: 20% usage
  - 20% × 2,628,000 seconds × (1 CPU × $0.00002400 + 1Gi × $0.00000250) = **$13.92**
- **Total Cloud Run Development**: **$13.92/month**

#### Google Cloud Build
- **Build Time**: 12 minutes per build
- **Builds**: 30 builds/month
  - E2_HIGHCPU_8: 8 vCPU × 0.2 hours × 30 × $0.003 = **$1.44**
  - Storage: 100GB × $0.026 = **$2.60**
- **Total Cloud Build**: **$4.04/month**

#### Google Secret Manager
- **Secrets**: 3 secrets × $0.06 = **$0.18/month**

#### Google Container Registry
- **Storage**: 10GB images × $0.026 = **$0.26/month**

#### Supabase
- **Database** (PostgreSQL):
  - Queries: 500 users × 500 queries = 250,000 queries/month
  - Bandwidth: ~20GB/month
  - Pro Plan: **$25/month** base
  - Additional storage: 2GB × $0.125 = **$0.25/month**
  - Additional bandwidth: 18GB × $0.09 = **$1.62/month**
- **File Storage**: 500 users × 10MB = 5GB
  - Storage: 4GB additional × $0.021/GB = **$0.08/month**
- **Total Supabase**: **$26.95/month**

#### Stripe
- **Infrastructure Cost**: **$0/month**

#### **Total Medium Tier: ~$731.59/month**

---

### 📊 Scaling Tier: 501-5000+ Active Users

#### Google Cloud Run (Production)
- **Base Instances**: 3 instances (always-on for low latency) × 2,628,000 seconds
  - CPU: 6 vCPU × 2,628,000 seconds × $0.00002400 = **$378.43**
  - Memory: 6 Gi × 2,628,000 seconds × $0.00000250 = **$39.42**
- **Average Scaling**: 15 instances
  - Additional: 12 instances × 2,628,000 seconds × (2 CPU × $0.00002400 + 2Gi × $0.00000250) = **$1,671.41**
- **Peak Scaling**: Up to 50 instances (during peak hours)
  - Peak hours: 200 hours/month = 720,000 seconds
  - Additional peak: 35 instances × 720,000 seconds × (2 CPU × $0.00002400 + 2Gi × $0.00000250) = **$1,360.08**
- **Request Cost**:
  - Requests: 5,000 users × 10 sessions × 50 requests = 2,500,000 requests
  - 2,500,000 × $0.0000004 = **$1.00**
- **Total Cloud Run Production**: **$3,450.34/month**

#### Google Cloud Run (Development)
- **Development Usage**: 30% usage
  - 30% × 2,628,000 seconds × (1 CPU × $0.00002400 + 1Gi × $0.00000250) = **$20.88**
- **Total Cloud Run Development**: **$20.88/month**

#### Google Cloud Build
- **Build Time**: 15 minutes average (larger codebase)
- **Builds**: 40 builds/month
  - E2_HIGHCPU_8: 8 vCPU × 0.25 hours × 40 × $0.003 = **$2.40**
  - Storage: 100GB × $0.026 = **$2.60**
- **Total Cloud Build**: **$5.00/month**

#### Google Secret Manager
- **Secrets**: 3 secrets × $0.06 = **$0.18/month**

#### Google Container Registry
- **Storage**: 20GB images × $0.026 = **$0.52/month**

#### Supabase
- **Database** (PostgreSQL):
  - Queries: 5,000 users × 500 queries = 2,500,000 queries/month
  - Bandwidth: ~200GB/month
  - Pro Plan: **$25/month** base
  - Database size: 10GB × $0.125 = **$1.25/month**
  - Additional bandwidth: 198GB × $0.09 = **$17.82/month**
- **File Storage**: 5,000 users × 10MB = 50GB
  - Storage: 49GB additional × $0.021/GB = **$1.03/month**
- **Total Supabase**: **$45.10/month**

#### Stripe
- **Infrastructure Cost**: **$0/month**

#### **Total Scaling Tier: ~$3,506.92/month**

---

## Cost Optimization Recommendations

### For Basic Tier (1-50 users)
1. ✅ Current setup is already optimized
2. Development environment scale-to-zero saves costs
3. Consider Supabase free tier if database usage is low

### For Medium Tier (51-500 users)
1. **Cloud Run Optimization**:
   - Use request-based autoscaling (already configured)
   - Consider reducing min-instances to 1 during off-peak
   - Implement request caching to reduce API calls

2. **Supabase Optimization**:
   - Enable connection pooling
   - Add database indexes for frequently queried tables
   - Implement query result caching

3. **CI/CD Optimization**:
   - Reduce build frequency (only on main branch for production)
   - Use build caching
   - Clean up old container images

### For Scaling Tier (501-5000+ users)
1. **Cloud Run Optimization**:
   - Implement Cloud CDN for static assets
   - Use regional load balancing
   - Consider Cloud Run Jobs for batch operations

2. **Supabase Optimization**:
   - Move to dedicated database instance if needed
   - Implement read replicas for analytics
   - Archive old session data to cheaper storage

3. **Monitoring & Alerts**:
   - Set up billing alerts
   - Monitor instance scaling patterns
   - Optimize concurrency settings

---

## Additional Cost Considerations

### Data Transfer
- **Ingress**: Free
- **Egress**: 
  - First 10GB/month: Free
  - Next 10TB: $0.12/GB
  - Estimated for scaling tier: ~50GB/month = **~$4.80/month**

### Logging & Monitoring
- **Cloud Logging**: First 50GB/month free, then $0.50/GB
- **Cloud Monitoring**: Free tier includes 150MB metrics/month
- **Estimated**: **~$5-10/month** for scaling tier

### Domain & SSL
- **Custom Domain**: Managed by Cloud Run (included)
- **SSL Certificate**: Free (managed by Google)

---

## Monthly Cost Summary

| Tier | Active Users | Estimated Monthly Cost |
|------|--------------|----------------------|
| **Basic** | 1-50 | **~$181** |
| **Medium** | 51-500 | **~$732** |
| **Scaling** | 501-5000+ | **~$3,507** |

### Cost per User Breakdown

| Tier | Cost per Active User |
|------|---------------------|
| **Basic** | ~$3.62/user |
| **Medium** | ~$1.46/user |
| **Scaling** | ~$0.70/user |

---

## Notes

1. **All prices in USD** (as of 2024). Google Cloud prices may vary by region.
2. **Voiceflow API costs excluded** as requested.
3. **Stripe transaction fees** (2.9% + $0.30) are payment processing costs, not infrastructure.
4. **Development environment costs** included but can be reduced further by using scale-to-zero more aggressively.
5. **Peak usage assumptions** are conservative. Actual costs may be lower if traffic is more distributed.
6. **Supabase pricing** based on Pro plan. Free tier available but limited for production use.

---

## Cost Monitoring Setup

### Recommended Billing Alerts

1. **Basic Tier**: Set alert at $200/month
2. **Medium Tier**: Set alert at $800/month
3. **Scaling Tier**: Set alert at $4,000/month

### Budget Configuration

```bash
# Example: Create budget for scaling tier
gcloud billing budgets create \
  --billing-account=BILLING_ACCOUNT_ID \
  --display-name="MinbarAI Production Budget" \
  --budget-amount=4000USD \
  --threshold-rule=percent=50 \
  --threshold-rule=percent=90 \
  --threshold-rule=percent=100
```

---

## Future Cost Projections

### At 10,000 Active Users
- **Cloud Run**: ~$6,500/month
- **Supabase**: ~$200/month
- **Other Services**: ~$30/month
- **Total**: ~$6,730/month

### At 50,000 Active Users
- **Cloud Run**: ~$30,000/month (with optimized scaling)
- **Supabase**: ~$800/month (likely need dedicated instance)
- **CDN & Optimization**: ~$300/month
- **Total**: ~$31,100/month

---

## Conclusion

The infrastructure is well-optimized with:
- ✅ Scale-to-zero for development
- ✅ Efficient Cloud Run autoscaling
- ✅ Cost-effective Supabase database
- ✅ Minimal overhead services

**Key Insight**: Cost per user decreases significantly as you scale, making the infrastructure highly efficient for growth. The main cost driver is Cloud Run compute time due to the always-on minimum instances requirement for low-latency real-time translation.

