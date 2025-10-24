# Complete CI/CD Guide for MinberAI

## 📋 Table of Contents

1. [Overview](#overview)
2. [Quick Start (5 Minutes)](#quick-start-5-minutes)
3. [Complete Setup](#complete-setup)
4. [Pipeline Architecture](#pipeline-architecture)
5. [Configuration](#configuration)
6. [Deployment](#deployment)
7. [Monitoring & Troubleshooting](#monitoring--troubleshooting)
8. [OAuth Setup](#oauth-setup)
9. [Security](#security)
10. [Maintenance](#maintenance)

---

## Overview

This is the complete guide for MinberAI's CI/CD pipeline using Google Cloud Build with automated testing, security scanning, and branch-based deployments to Google Cloud Run.

### What This Pipeline Does

- ✅ **Automated Testing**: Jest unit tests with React Testing Library
- ✅ **Code Quality**: ESLint linting and TypeScript type checking
- ✅ **Security Scanning**: npm audit and Trivy container scanning
- ✅ **Branch-Based Deployment**: 
  - `dev` branch → Development environment
  - `main` branch → Production environment
- ✅ **Quality Gates**: Pipeline fails if tests fail or security issues found
- ✅ **Optimized Builds**: Multi-stage Docker builds with caching

### Current Script Structure

```
MinberAI/
├── setup-ci-cd.sh              # 🎯 Single CI/CD setup script
├── register-stripe-webhooks.sh  # 🔗 Webhook registration utility  
├── deploy-pro.sh               # 🚀 Production deployment
└── deploy-dev.sh               # 🚀 Development deployment
```

---

## Quick Start (5 Minutes)

### Prerequisites

- Google Cloud Project with billing enabled
- GitHub repository connected to Google Cloud
- `gcloud` CLI installed and authenticated

### Step 1: Install Dependencies

```bash
cd "/media/abi/ext_nvme/Merkyen LTD/MinberAI"
npm install
```

### Step 2: Verify Local Setup

```bash
# Run tests
npm test

# Run linting
npm run lint

# Run type checking
npm run type-check
```

All commands should pass ✅

### Step 3: One-Command CI/CD Setup

```bash
# Copy environment template
cp env.example .env

# Edit with your values
nano .env

# Run complete setup
./setup-ci-cd.sh
```

**That's it!** The script automatically:
- ✅ Enables required Google Cloud APIs
- ✅ Creates service account with CI/CD permissions
- ✅ Sets up secrets in Secret Manager
- ✅ Creates Cloud Build triggers for dev and main branches
- ✅ Verifies the complete setup

### Step 4: Test the Pipeline

```bash
# Test with a commit to dev branch
git checkout dev
git commit --allow-empty -m "test: trigger CI/CD pipeline"
git push origin dev

# Monitor the build
gcloud builds list --limit=5
```

---

## Complete Setup

### Environment Configuration

Create `.env` file with these required values:

```bash
# Google Cloud Configuration
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_CLOUD_REGION=europe-west1
GOOGLE_CLOUD_SERVICE_ACCOUNT_NAME=minberai-service-account
GOOGLE_CLOUD_SERVICE_ACCOUNT_FILE=minberai-service-account.json

# GitHub Configuration
GITHUB_OWNER=your-github-username
GITHUB_REPO=MinberAI

# Service Names
DEV_SERVICE_NAME=minbarai-dev
PROD_SERVICE_NAME=minbarai-pro
CUSTOM_DOMAIN=minbarai.com

# Stripe Configuration
STRIPE_SECRET_KEY=sk_live_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# Supabase Configuration
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key

# Stripe Public Keys
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_your_publishable_key
NEXT_PUBLIC_STRIPE_PRICE_ID=price_your_price_id

# Voiceflow Configuration
NEXT_PUBLIC_VOICEFLOW_WS_URL=wss://your-voiceflow-url
NEXT_PUBLIC_VOICEFLOW_WS_TOKEN=your_voiceflow_token

# Site URLs
NEXT_PUBLIC_SITE_URL=https://minbarai.com
NEXTAUTH_URL=https://minbarai.com
```

### Manual Setup Steps

If you prefer manual setup over the automated script:

#### 1. Create Secrets in Secret Manager

```bash
# Set your project ID
export PROJECT_ID="your-project-id"
gcloud config set project $PROJECT_ID

# Create secrets
echo -n "your_stripe_secret_key" | gcloud secrets create STRIPE_SECRET_KEY --data-file=-
echo -n "your_stripe_webhook_secret" | gcloud secrets create STRIPE_WEBHOOK_SECRET --data-file=-
echo -n "your_supabase_service_role_key" | gcloud secrets create SUPABASE_SERVICE_ROLE_KEY --data-file=-
```

#### 2. Grant Service Account Permissions

```bash
# Get the Cloud Build service account
export PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')
export CLOUD_BUILD_SA="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"

# Grant necessary permissions
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${CLOUD_BUILD_SA}" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${CLOUD_BUILD_SA}" \
  --role="roles/secretmanager.secretAccessor"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${CLOUD_BUILD_SA}" \
  --role="roles/iam.serviceAccountUser"
```

#### 3. Create Cloud Build Triggers

**Development Trigger (dev branch):**

```bash
gcloud builds triggers create github \
  --name="minbarai-dev-deploy" \
  --repo-name="MinberAI" \
  --repo-owner="your-github-username" \
  --branch-pattern="^dev$" \
  --build-config="cloudbuild.yaml" \
  --substitutions="_REGION=europe-west1,_SERVICE_NAME_DEV=minbarai-dev,_SERVICE_NAME_PROD=minbarai-pro,_CUSTOM_DOMAIN=minbarai.com,_NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co,_NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key,_NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_your-key,_NEXT_PUBLIC_STRIPE_PRICE_ID=price_your-id,_NEXT_PUBLIC_VOICEFLOW_WS_URL=wss://your-voiceflow-url,_NEXT_PUBLIC_VOICEFLOW_WS_TOKEN=your-token,_NEXT_PUBLIC_SITE_URL=https://minbarai.com,_NEXTAUTH_URL=https://minbarai.com"
```

**Production Trigger (main branch):**

```bash
gcloud builds triggers create github \
  --name="minbarai-prod-deploy" \
  --repo-name="MinberAI" \
  --repo-owner="your-github-username" \
  --branch-pattern="^main$" \
  --build-config="cloudbuild.yaml" \
  --substitutions="_REGION=europe-west1,_SERVICE_NAME_DEV=minbarai-dev,_SERVICE_NAME_PROD=minbarai-pro,_CUSTOM_DOMAIN=minbarai.com,_NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co,_NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key,_NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_your-key,_NEXT_PUBLIC_STRIPE_PRICE_ID=price_your-id,_NEXT_PUBLIC_VOICEFLOW_WS_URL=wss://your-voiceflow-url,_NEXT_PUBLIC_VOICEFLOW_WS_TOKEN=your-token,_NEXT_PUBLIC_SITE_URL=https://minbarai.com,_NEXTAUTH_URL=https://minbarai.com"
```

---

## Pipeline Architecture

### Pipeline Stages

```
1. Install Dependencies (1-2 min)
   ├── Production dependencies
   └── Development dependencies

2. Quality Checks (1-2 min) [Parallel]
   ├── Lint (ESLint)
   ├── Type Check (TypeScript)
   ├── Security Audit (npm audit)
   └── Tests (Jest)

3. Build (3-5 min)
   └── Docker image with multi-stage build

4. Security Scan (1-2 min)
   └── Trivy container vulnerability scan

5. Push Images (1 min)
   ├── Push with commit SHA
   └── Push as latest

6. Deploy (1-2 min)
   ├── Deploy to dev (always)
   └── Deploy to prod (main branch only)

Total: ~8-12 minutes
```

### Branch Strategy

**Development Branch (`dev`):**
- **Trigger:** Any commit to `dev` branch
- **Deploy to:** `minbarai-dev` service
- **Resources:** 1 CPU, 1Gi RAM, 0-10 instances
- **Environment:** Development

**Production Branch (`main`):**
- **Trigger:** Any commit to `main` branch
- **Deploy to:** Both `minbarai-dev` AND `minbarai-pro`
- **Resources:** 2 CPU, 2Gi RAM, 1-50 instances
- **Environment:** Production

### Quality Gates

The pipeline will **FAIL** and **BLOCK** deployment if:
- ❌ ESLint returns errors (warnings allowed)
- ❌ TypeScript compilation fails
- ❌ Jest tests fail
- ❌ npm audit finds HIGH/CRITICAL vulnerabilities
- ❌ Trivy finds HIGH/CRITICAL container vulnerabilities
- ❌ Docker build fails

---

## Configuration

### Script Options

```bash
# Show help
./setup-ci-cd.sh --help

# Verify existing setup
./setup-ci-cd.sh --verify

# Only setup Cloud Build triggers
./setup-ci-cd.sh --triggers

# Only setup secrets
./setup-ci-cd.sh --secrets

# Only setup service account
./setup-ci-cd.sh --service-account

# Show current status
./setup-ci-cd.sh --status

# Clean up everything (DANGEROUS)
./setup-ci-cd.sh --clean
```

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `GOOGLE_CLOUD_PROJECT_ID` | Google Cloud project ID | ✅ |
| `GITHUB_OWNER` | GitHub username/organization | ✅ |
| `GITHUB_REPO` | GitHub repository name | ✅ |
| `STRIPE_SECRET_KEY` | Stripe secret key | ✅ |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook secret | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | ✅ |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key | ✅ |

### What Gets Created

#### 1. Google Cloud APIs
- Cloud Run API
- Secret Manager API
- Cloud Build API
- Container Registry API
- IAM API
- Cloud Resource Manager API

#### 2. Service Account
- Name: `minberai-service-account`
- Roles:
  - Cloud Run Admin
  - Service Account User
  - Secret Manager Secret Accessor
  - Storage Admin
  - Cloud Build Editor
  - Container Registry Service Agent
  - Cloud Build Builder
  - Artifact Registry Admin

#### 3. Secrets in Secret Manager
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `SUPABASE_SERVICE_ROLE_KEY`

#### 4. Cloud Build Triggers
- `minbarai-dev-deploy` (dev branch)
- `minbarai-prod-deploy` (main branch)

---

## Deployment

### Manual Deployment

#### Development Deployment

```bash
./deploy-dev.sh
```

**Features:**
- Scales to zero when idle (cost optimization)
- Cold start delay on first request
- Perfect for testing and development
- Resources: 1 CPU, 1Gi RAM, 0-10 instances

#### Production Deployment

```bash
./deploy-pro.sh
```

**Features:**
- Always-on scaling (min 1 instance)
- High performance configuration
- Custom domain support
- Resources: 2 CPU, 2Gi RAM, 1-50 instances

### Deployment Options

```bash
# Dry run (show what would be deployed)
./deploy-pro.sh --dry-run
./deploy-dev.sh --dry-run

# Skip webhook registration
./deploy-pro.sh --no-webhooks
./deploy-dev.sh --no-webhooks
```

### Webhook Registration

After deployment, register Stripe webhooks:

```bash
# Production webhooks
./register-stripe-webhooks.sh production

# Development webhooks
./register-stripe-webhooks.sh development
```

---

## Monitoring & Troubleshooting

### View Build Status

```bash
# List recent builds
gcloud builds list --limit=10

# View specific build
gcloud builds describe BUILD_ID

# Stream build logs
gcloud builds log BUILD_ID --stream
```

### View Service Status

```bash
# List services
gcloud run services list --region=europe-west1

# Get service URLs
gcloud run services describe minbarai-dev --region=europe-west1 --format='value(status.url)'
gcloud run services describe minbarai-pro --region=europe-west1 --format='value(status.url)'
```

### View Service Logs

```bash
# Development service logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=minbarai-dev" --limit=50

# Production service logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=minbarai-pro" --limit=50
```

### View Secrets

```bash
# List secrets
gcloud secrets list --filter='labels.app=minberai'

# View secret value (be careful!)
gcloud secrets versions access latest --secret="STRIPE_SECRET_KEY"
```

### Common Issues

#### 1. "gcloud CLI not found"
```bash
# Install gcloud CLI
curl https://sdk.cloud.google.com | bash
exec -l $SHELL
gcloud init
```

#### 2. "No active authentication"
```bash
# Authenticate with Google Cloud
gcloud auth login
gcloud auth application-default login
```

#### 3. "Project not found"
```bash
# Check your project ID
gcloud projects list

# Set the correct project
gcloud config set project YOUR_PROJECT_ID
```

#### 4. "GitHub repository not connected"
- Go to Google Cloud Console → Cloud Build → Triggers
- Connect your GitHub repository
- Or use the manual trigger creation commands

#### 5. "Secrets not found"
```bash
# Check if secrets exist
gcloud secrets list

# Create missing secrets manually
echo -n "your_secret_value" | gcloud secrets create SECRET_NAME --data-file=-
```

#### 6. Build Fails on Tests
```bash
# Run tests locally
npm test

# Check test output
npm test -- --verbose
```

#### 7. Build Fails on Security Scan
```bash
# Check npm vulnerabilities
npm audit

# Check for high/critical issues
npm audit --audit-level=high
```

### Re-running Setup

The script is idempotent - you can run it multiple times safely:

```bash
# Update environment variables
nano .env

# Re-run setup (will update existing resources)
./setup-ci-cd.sh
```

### Cleanup

To remove all CI/CD resources:

```bash
# Clean up everything
./setup-ci-cd.sh --clean
```

**Warning:** This will delete all secrets, triggers, and service accounts!

---

## OAuth Setup

### Google Cloud Console OAuth Configuration

**Current Client ID**: `874332971589-i5fpiera82v4b69h0sk3m72n2u9tukh3`

1. **Go to**: [Google Cloud Console](https://console.cloud.google.com/)
2. **Select your project** (with the above client ID)
3. **Navigate to**: APIs & Services → Credentials
4. **Click on your OAuth 2.0 Client ID**
5. **Add these Authorized redirect URIs**:

```
# Supabase callback (required)
https://hjsifxofnqbnrgqkbomx.supabase.co/auth/v1/callback

# Development environment
https://minbarai-dev-878512438019.europe-west3.run.app/auth/callback

# Production environment (custom domain)
https://minbarai.com/auth/callback

# Local development
http://localhost:3000/auth/callback
```

### Supabase OAuth Configuration

**Current Supabase Project**: `hjsifxofnqbnrgqkbomx`

1. **Go to**: [Supabase Dashboard](https://supabase.com/dashboard)
2. **Select project**: `hjsifxofnqbnrgqkbomx`
3. **Navigate to**: Authentication → URL Configuration
4. **Update Site URL and Redirect URLs**:

**Site URL:**
```
https://minbarai.com
```

**Redirect URLs:**
```
http://localhost:3000/auth/callback
https://minbarai-dev-878512438019.europe-west3.run.app/auth/callback
https://minbarai.com/auth/callback
```

### OAuth Flow Explanation

1. **User clicks "Continue with Google"** → Frontend detects environment
2. **Environment Detection** → Uses `NEXT_PUBLIC_SITE_URL` or falls back to `window.location.origin`
3. **Redirect to Google** → Google OAuth with correct redirect URL
4. **Google authenticates** → Redirects to Supabase callback
5. **Supabase processes** → Redirects to your app callback
6. **App handles callback** → Redirects to dashboard/subscribe

### Testing OAuth Flow

```bash
# Test development environment
curl -I https://minbarai-dev-878512438019.europe-west3.run.app/auth/signin

# Test production environment
curl -I https://minbarai.com/auth/signin

# Test callback endpoints
curl -I https://minbarai-dev-878512438019.europe-west3.run.app/auth/callback
curl -I https://minbarai.com/auth/callback
```

---

## Security

### Security Scanning

**npm audit:**
- Audit level: HIGH
- Scope: Production dependencies only
- Failure: Blocks deployment

**Trivy:**
- Severity: HIGH, CRITICAL
- Exit code on findings: 1 (blocks deployment)
- Format: Table output for readability

### Security Considerations

1. **Secrets**: Never commit secrets to repository
2. **Dependencies**: Regularly update dependencies and run audits
3. **Container Images**: Scan for vulnerabilities before deployment
4. **Access Control**: Use least privilege for service accounts
5. **Network**: Cloud Run services are publicly accessible by default

### Secret Management

All sensitive data is stored in Google Secret Manager:
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `SUPABASE_SERVICE_ROLE_KEY`

### Access Control

Service account has minimal required permissions:
- Cloud Run Admin (deploy and manage services)
- Secret Manager Secret Accessor (access secrets)
- Storage Admin (push/pull container images)
- Cloud Build Editor (CI/CD builds)

---

## Maintenance

### Regular Tasks

1. **Update Dependencies**: Monthly dependency updates
2. **Security Audits**: Weekly security scans
3. **Performance Monitoring**: Monitor build times and resource usage
4. **Log Review**: Regular review of build and deployment logs

### Performance Metrics

**Expected Build Times:**
- **Full Pipeline**: 8-12 minutes
- **Docker Build**: 3-5 minutes
- **Tests**: 1-2 minutes
- **Security Scans**: 1-2 minutes

**Resource Usage:**
- **Machine Type**: E2_HIGHCPU_8 (8 vCPUs, 8 GB RAM)
- **Disk Size**: 100 GB
- **Build Timeout**: 10 minutes (default)

### Backup and Recovery

- **Code**: Git repository serves as primary backup
- **Secrets**: Backup Secret Manager secrets securely
- **Configuration**: Version control all configuration files
- **Documentation**: Keep this documentation updated

### Monitoring Commands

```bash
# Check build status
gcloud builds list --limit=10

# Check service status
gcloud run services list --region=europe-west1

# Check secrets
gcloud secrets list --filter='labels.app=minberai'

# Check triggers
gcloud builds triggers list
```

---

## Next Steps

1. **Test the Pipeline:** Make a commit to the `dev` branch
2. **Monitor Builds:** Watch the first build carefully
3. **Check Services:** Verify the deployed services are working
4. **Add More Tests:** Expand your test coverage
5. **Optimize:** Fine-tune build performance

## Support

- **Full Documentation:** This guide covers everything
- **Script Help:** Run `./setup-ci-cd.sh --help` for more options
- **Google Cloud Build Docs:** [https://cloud.google.com/build/docs](https://cloud.google.com/build/docs)
- **Jest Documentation:** [https://jestjs.io/](https://jestjs.io/)

---

**Last Updated**: October 2025  
**Version**: 1.0  
**Environment**: Google Cloud Run + Cloud Build
