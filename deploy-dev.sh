#!/bin/bash

# 🚀 MinberAI Development Deployment Script for Google Cloud Run
# Deploys to development environment with scale-to-zero optimization

set -e  # Exit on any error

# Load environment variables from .env file if it exists
if [ -f ".env" ]; then
    echo "Loading environment variables from .env file..."
    export $(grep -v '^#' .env | xargs)
fi

# Configuration - Can be overridden by .env file
PROJECT_ID=${GOOGLE_CLOUD_PROJECT_ID:-"gen-lang-client-0842740671"}
REGION=${GOOGLE_CLOUD_REGION:-"europe-west1"}
SERVICE_NAME=${CLOUD_RUN_SERVICE_DEV:-"minbarai-dev"}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    # Check if gcloud is installed
    if ! command -v gcloud &> /dev/null; then
        print_error "gcloud CLI is not installed. Please install it first."
        exit 1
    fi
    
    # Check if docker is installed
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install it first."
        exit 1
    fi
    
    # Check if service account file exists
    SERVICE_ACCOUNT_FILE=${GOOGLE_CLOUD_SERVICE_ACCOUNT_FILE:-"minberai-service-account.json"}
    if [ ! -f "$SERVICE_ACCOUNT_FILE" ]; then
        print_error "Service account file '$SERVICE_ACCOUNT_FILE' not found."
        print_status "Please ensure the service account JSON file is in the project root."
        print_status "Set GOOGLE_CLOUD_SERVICE_ACCOUNT_FILE in your .env file if using a different filename."
        exit 1
    fi
    
    print_success "All prerequisites met!"
}

# Configure gcloud
configure_gcloud() {
    print_status "Configuring gcloud..."
    
    # Set project
    gcloud config set project $PROJECT_ID
    
    # Configure docker authentication
    gcloud auth configure-docker --quiet
    
    # Enable required APIs
    gcloud services enable run.googleapis.com cloudbuild.googleapis.com secretmanager.googleapis.com --quiet
    
    print_success "gcloud configured!"
}

# Build Docker image
build_image() {
    print_status "Building Docker image for development..."
    
    # Create temporary build environment file
    cat > .env.build << EOF
# Build-time environment variables
NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=${NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY}
NEXT_PUBLIC_STRIPE_PRICE_ID=${NEXT_PUBLIC_STRIPE_PRICE_ID}
NEXT_PUBLIC_VOICEFLOW_WS_URL=${NEXT_PUBLIC_VOICEFLOW_WS_URL}
NEXT_PUBLIC_VOICEFLOW_WS_TOKEN=${NEXT_PUBLIC_VOICEFLOW_WS_TOKEN}
NEXT_PUBLIC_SITE_URL=https://$SERVICE_NAME-xxxxx.run.app
NEXTAUTH_URL=https://$SERVICE_NAME-xxxxx.run.app
EOF
    
    # Build with latest tag and build arguments
    docker build \
        --build-arg NEXT_PUBLIC_SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL}" \
        --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY="${NEXT_PUBLIC_SUPABASE_ANON_KEY}" \
        --build-arg NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="${NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY}" \
        --build-arg NEXT_PUBLIC_STRIPE_PRICE_ID="${NEXT_PUBLIC_STRIPE_PRICE_ID}" \
        --build-arg NEXT_PUBLIC_VOICEFLOW_WS_URL="${NEXT_PUBLIC_VOICEFLOW_WS_URL}" \
        --build-arg NEXT_PUBLIC_VOICEFLOW_WS_TOKEN="${NEXT_PUBLIC_VOICEFLOW_WS_TOKEN}" \
        --build-arg NEXT_PUBLIC_SITE_URL="https://$SERVICE_NAME-xxxxx.run.app" \
        --build-arg NEXTAUTH_URL="https://$SERVICE_NAME-xxxxx.run.app" \
        -t gcr.io/$PROJECT_ID/$SERVICE_NAME:latest .
    
    # Also tag with commit SHA if available
    if [ ! -z "$COMMIT_SHA" ]; then
        docker tag gcr.io/$PROJECT_ID/$SERVICE_NAME:latest gcr.io/$PROJECT_ID/$SERVICE_NAME:$COMMIT_SHA
    fi
    
    # Clean up temporary file
    rm -f .env.build
    
    print_success "Docker image built successfully!"
}

# Push image to Container Registry
push_image() {
    print_status "Pushing image to Container Registry..."
    
    docker push gcr.io/$PROJECT_ID/$SERVICE_NAME:latest
    
    if [ ! -z "$COMMIT_SHA" ]; then
        docker push gcr.io/$PROJECT_ID/$SERVICE_NAME:$COMMIT_SHA
    fi
    
    print_success "Image pushed to Container Registry!"
}

# Deploy to Cloud Run
deploy_to_cloud_run() {
    print_status "Deploying to Cloud Run with development settings..."
    
    # Use commit SHA if available, otherwise use latest
    IMAGE_TAG=${COMMIT_SHA:-latest}
    
    gcloud run deploy $SERVICE_NAME \
        --image gcr.io/$PROJECT_ID/$SERVICE_NAME:$IMAGE_TAG \
        --platform managed \
        --region $REGION \
        --allow-unauthenticated \
        --port 8080 \
        --memory 1Gi \
        --cpu 1 \
        --min-instances 0 \
        --max-instances 10 \
        --concurrency 100 \
        --timeout 300 \
        --set-env-vars NODE_ENV=development \
        --set-env-vars NEXT_PUBLIC_SITE_URL=https://$SERVICE_NAME-xxxxx.run.app \
        --set-env-vars NEXTAUTH_URL=https://$SERVICE_NAME-xxxxx.run.app \
        --set-env-vars NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL} \
        --set-env-vars NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY} \
        --set-env-vars NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=${NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY} \
        --set-env-vars NEXT_PUBLIC_STRIPE_PRICE_ID=${NEXT_PUBLIC_STRIPE_PRICE_ID} \
        --set-env-vars NEXT_PUBLIC_VOICEFLOW_WS_URL=${NEXT_PUBLIC_VOICEFLOW_WS_URL} \
        --set-env-vars NEXT_PUBLIC_VOICEFLOW_WS_URL_PROD=${NEXT_PUBLIC_VOICEFLOW_WS_URL_PROD} \
        --set-env-vars NEXT_PUBLIC_VOICEFLOW_WS_TOKEN=${NEXT_PUBLIC_VOICEFLOW_WS_TOKEN} \
        --set-secrets STRIPE_SECRET_KEY=STRIPE_SECRET_KEY:latest \
        --set-secrets STRIPE_WEBHOOK_SECRET=STRIPE_WEBHOOK_SECRET:latest \
        --set-secrets SUPABASE_SERVICE_ROLE_KEY=SUPABASE_SERVICE_ROLE_KEY:latest \
        --service-account ${SERVICE_ACCOUNT_FILE%.*}@$PROJECT_ID.iam.gserviceaccount.com \
        --quiet
    
    print_success "Deployed to Cloud Run successfully!"
}

# Register Stripe webhooks
register_stripe_webhooks() {
    print_status "Registering Stripe webhooks for development..."
    
    # Run the webhook registration script
    if [ -f "./register-stripe-webhooks.sh" ]; then
        ./register-stripe-webhooks.sh development
        print_success "Stripe webhooks registered successfully!"
    else
        print_warning "Stripe webhook registration script not found. Please run it manually."
    fi
}

# Get service information
get_service_info() {
    print_status "Retrieving service information..."
    
    # Get service URL
    SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region=$REGION --format='value(status.url)')
    
    # Get service status
    SERVICE_STATUS=$(gcloud run services describe $SERVICE_NAME --region=$REGION --format='value(status.conditions[0].status)')
    
    print_success "Development deployment completed successfully!"
    echo ""
    echo "=================================================="
    echo "🚀 DEVELOPMENT DEPLOYMENT COMPLETE!"
    echo "=================================================="
    echo ""
    echo "🌐 Service URL: $SERVICE_URL"
    echo "📍 Region: $REGION"
    echo "📊 Service Status: $SERVICE_STATUS"
    echo ""
    echo "⚙️  Configuration:"
    echo "   - Min Instances: 0 (scale-to-zero)"
    echo "   - Max Instances: 10"
    echo "   - Memory: 1Gi"
    echo "   - CPU: 1"
    echo "   - Timeout: 300s"
    echo ""
    echo "💡 Development Features:"
    echo "   - Scales to zero when idle (cost optimization)"
    echo "   - Cold start delay on first request"
    echo "   - Perfect for testing and development"
    echo ""
    echo "🔍 Monitor your deployment:"
    echo "   gcloud run services describe $SERVICE_NAME --region=$REGION"
    echo "   gcloud logs read --service=$SERVICE_NAME --region=$REGION --limit=50"
    echo ""
    echo "📈 View metrics:"
    echo "   https://console.cloud.google.com/run/detail/$REGION/$SERVICE_NAME/metrics"
    echo ""
    echo "=================================================="
    echo "⚠️  IMPORTANT NEXT STEPS:"
    echo "   1. Update Supabase OAuth redirect URLs to:"
    echo "      - $SERVICE_URL/auth/callback"
    echo "   2. Test the application thoroughly"
    echo "   3. Monitor logs for any issues"
    echo "   4. Use this environment for development and testing"
    echo "=================================================="
}

# Main deployment function
main() {
    echo "🚀 Starting MinberAI Development Deployment"
    echo "=================================================="
    echo ""
    
    # Check if PROJECT_ID is set
    if [ "$PROJECT_ID" = "your-project-id" ] || [ -z "$PROJECT_ID" ]; then
        print_error "Please set GOOGLE_CLOUD_PROJECT_ID in your .env file."
        print_status "Create .env file: cp env.example .env"
        exit 1
    fi
    
    # Get commit SHA from git if available
    if command -v git &> /dev/null && git rev-parse --git-dir > /dev/null 2>&1; then
        COMMIT_SHA=$(git rev-parse --short HEAD)
        print_status "Using commit SHA: $COMMIT_SHA"
    fi
    
    # Run deployment steps
    check_prerequisites
    configure_gcloud
    build_image
    push_image
    deploy_to_cloud_run
    register_stripe_webhooks
    get_service_info
    
    echo ""
    print_success "🎉 Development deployment completed successfully!"
    print_status "Your MinberAI development service is now running with scale-to-zero optimization."
}

# Handle script arguments
case "${1:-}" in
    --help|-h)
        echo "MinberAI Development Deployment Script"
        echo ""
        echo "Usage: $0 [OPTIONS]"
        echo ""
        echo "Options:"
        echo "  --help, -h     Show this help message"
        echo "  --dry-run      Show what would be deployed without actually deploying"
        echo "  --no-webhooks  Skip Stripe webhook registration"
        echo ""
        echo "Configuration:"
        echo "  Edit this script to set PROJECT_ID, REGION, and SERVICE_NAME"
        echo ""
        echo "Prerequisites:"
        echo "  - gcloud CLI installed and authenticated"
        echo "  - Docker installed and running"
        echo "  - Service account JSON file in project root"
        echo "  - Required Google Cloud APIs enabled"
        echo "  - Secrets set up in Secret Manager"
        exit 0
        ;;
    --dry-run)
        print_status "Dry run mode - showing configuration without deploying"
        echo ""
        echo "Project ID: $PROJECT_ID"
        echo "Region: $REGION"
        echo "Service Name: $SERVICE_NAME"
        echo "Image: gcr.io/$PROJECT_ID/$SERVICE_NAME:latest"
        echo ""
        print_status "To deploy, run: $0"
        exit 0
        ;;
    --no-webhooks)
        SKIP_WEBHOOKS=true
        main
        ;;
    *)
        main
        ;;
esac
