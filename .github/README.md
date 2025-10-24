# CI/CD Setup Guide

This repository uses GitHub Actions for continuous integration and deployment to Vercel.

## Workflows

### 1. Production Deployment (`deploy.yml`)
- **Triggers**: Push to `main` branch
- **Purpose**: Automatically deploy to Vercel production
- **Features**: Security audit, build check, production deployment

### 2. Development Deployment (`dev-deploy.yml`)
- **Triggers**: Push to `dev` branch, Pull requests to `dev`
- **Purpose**: Deploy development builds to Vercel preview
- **Features**: Linting, type checking, preview deployment

### 3. Full CI/CD Pipeline (`ci-cd.yml`)
- **Triggers**: Push to `main` or `dev`, Pull requests
- **Purpose**: Comprehensive quality checks and deployments
- **Features**: Quality checks, security audit, build test, conditional deployments

## Required Secrets

To enable automatic deployment, you need to add these secrets to your GitHub repository:

### 1. Go to GitHub Repository Settings
- Navigate to your repository on GitHub
- Click on "Settings" tab
- Click on "Secrets and variables" → "Actions"

### 2. Add Required Secrets

#### VERCEL_TOKEN
- Go to [Vercel Dashboard](https://vercel.com/account/tokens)
- Create a new token with appropriate permissions
- Copy the token and add it as `VERCEL_TOKEN`

#### VERCEL_ORG_ID
- Go to [Vercel Dashboard](https://vercel.com/account)
- Copy your Organization ID
- Add it as `VERCEL_ORG_ID`

#### VERCEL_PROJECT_ID
- Go to your project in Vercel Dashboard
- Go to Settings → General
- Copy the Project ID
- Add it as `VERCEL_PROJECT_ID`

## Branch Strategy

- **`main`**: Production branch - automatically deploys to Vercel production
- **`dev`**: Development branch - deploys to Vercel preview for testing

## Manual Deployment

You can also trigger deployments manually:
1. Go to "Actions" tab in GitHub
2. Select the desired workflow
3. Click "Run workflow"

## Monitoring

- Check the "Actions" tab to monitor workflow runs
- View deployment status in Vercel Dashboard
- Review build logs for any issues

## Troubleshooting

### Common Issues:
1. **Missing Secrets**: Ensure all required secrets are added
2. **Build Failures**: Check the build logs in GitHub Actions
3. **Deployment Issues**: Verify Vercel project settings

### Getting Help:
- Check GitHub Actions logs
- Review Vercel deployment logs
- Consult the workflow files for configuration details
