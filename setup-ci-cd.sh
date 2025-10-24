#!/bin/bash

# 🚀 MinberAI CI/CD Setup Script
# Automatically configures Google Cloud for CI/CD pipeline
# Loads from .env and applies all necessary setup

set -e  # Exit on any error

# Load environment variables from .env file if it exists
if [ -f ".env" ]; then
    echo "Loading environment variables from .env file..."
    export $(grep -v '^#' .env | xargs)
fi

# Configuration - Can be overridden by .env file
PROJECT_ID=${GOOGLE_CLOUD_PROJECT_ID:-"gen-lang-client-0842740671"}
REGION=${GOOGLE_CLOUD_REGION:-"europe-west1"}
SERVICE_ACCOUNT_NAME=${GOOGLE_CLOUD_SERVICE_ACCOUNT_NAME:-"minberai-service-account"}
SERVICE_ACCOUNT_FILE=${GOOGLE_CLOUD_SERVICE_ACCOUNT_FILE:-"minberai-service-account.json"}
GITHUB_OWNER=${GITHUB_OWNER:-"your-github-username"}
GITHUB_REPO=${GITHUB_REPO:-"MinberAI"}

# CI/CD specific configuration
DEV_SERVICE_NAME=${DEV_SERVICE_NAME:-"minbarai-dev"}
PROD_SERVICE_NAME=${PROD_SERVICE_NAME:-"minbarai-pro"}
CUSTOM_DOMAIN=${CUSTOM_DOMAIN:-"minbarai.com"}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
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

print_ci() {
    echo -e "${PURPLE}[CI/CD]${NC} $1"
}

print_step() {
    echo -e "${CYAN}[STEP]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    print_step "Checking prerequisites..."
    
    # Check if gcloud is installed
    if ! command -v gcloud &> /dev/null; then
        print_error "gcloud CLI is not installed. Please install it first."
        print_status "Install instructions: https://cloud.google.com/sdk/docs/install"
        exit 1
    fi
    
    # Check if user is authenticated
    if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
        print_error "No active gcloud authentication found."
        print_status "Please run: gcloud auth login"
        exit 1
    fi
    
    # Check if project is set
    if [ "$PROJECT_ID" = "your-project-id" ] || [ -z "$PROJECT_ID" ]; then
        print_error "Please set GOOGLE_CLOUD_PROJECT_ID in your .env file."
        print_status "Create .env file: cp env.example .env"
        exit 1
    fi
    
    # GitHub info is optional - we'll detect it from the connection
    print_status "GitHub repository will be detected from Cloud Build connection."
    
    print_success "Prerequisites met!"
}

# Configure gcloud and enable APIs
configure_gcloud() {
    print_step "Configuring gcloud and enabling APIs..."
    
    # Set project
    gcloud config set project $PROJECT_ID
    
    # Enable required APIs
    print_status "Enabling required Google Cloud APIs..."
    local apis=(
        "run.googleapis.com"
        "secretmanager.googleapis.com"
        "cloudbuild.googleapis.com"
        "containerregistry.googleapis.com"
        "iam.googleapis.com"
        "cloudresourcemanager.googleapis.com"
    )
    
    for api in "${apis[@]}"; do
        print_status "Enabling $api..."
        gcloud services enable $api --quiet
    done
    
    print_success "gcloud configured and APIs enabled!"
}

# Create service account with CI/CD permissions
setup_service_account() {
    print_step "Setting up service account for CI/CD..."
    
    local service_account_email="$SERVICE_ACCOUNT_NAME@$PROJECT_ID.iam.gserviceaccount.com"
    
    # Check if service account already exists
    if gcloud iam service-accounts describe $service_account_email --quiet &> /dev/null; then
        print_warning "Service account $SERVICE_ACCOUNT_NAME already exists."
        read -p "Do you want to continue and update permissions? (y/n): " continue_setup
        if [ "$continue_setup" != "y" ] && [ "$continue_setup" != "Y" ]; then
            print_status "Skipping service account setup."
            return 0
        fi
    else
        # Create service account
        gcloud iam service-accounts create $SERVICE_ACCOUNT_NAME \
            --display-name="MinberAI CI/CD Service Account" \
            --description="Service account for MinberAI CI/CD pipeline with Cloud Build and Cloud Run access" \
            --quiet
        
        print_success "Service account created successfully!"
    fi
    
    # Grant IAM roles for CI/CD
    print_status "Granting IAM roles for CI/CD..."
    local service_account_email="$SERVICE_ACCOUNT_NAME@$PROJECT_ID.iam.gserviceaccount.com"
    
    # Define roles for CI/CD
    local roles=(
        "roles/run.admin"
        "roles/iam.serviceAccountUser"
        "roles/secretmanager.secretAccessor"
        "roles/storage.admin"
        "roles/cloudbuild.builds.editor"
        "roles/containerregistry.ServiceAgent"
        "roles/cloudbuild.builds.builder"
        "roles/artifactregistry.admin"
    )
    
    # Grant each role
    for role in "${roles[@]}"; do
        print_status "Granting role: $role"
        gcloud projects add-iam-policy-binding $PROJECT_ID \
            --member="serviceAccount:$service_account_email" \
            --role="$role" \
            --quiet
    done
    
    # Create and download service account key if needed
    if [ ! -f "$SERVICE_ACCOUNT_FILE" ]; then
        print_status "Creating service account key..."
        gcloud iam service-accounts keys create $SERVICE_ACCOUNT_FILE \
            --iam-account=$service_account_email \
            --quiet
        print_success "Service account key downloaded to: $SERVICE_ACCOUNT_FILE"
    else
        print_warning "Service account key file already exists: $SERVICE_ACCOUNT_FILE"
    fi
    
    print_success "Service account setup complete!"
}

# Set up secrets in Secret Manager
setup_secrets() {
    print_step "Setting up secrets in Secret Manager..."
    
    # Check if secrets already exist
    local existing_secrets=$(gcloud secrets list --filter="name:STRIPE_SECRET_KEY OR name:STRIPE_WEBHOOK_SECRET OR name:SUPABASE_SERVICE_ROLE_KEY" --format="value(name)" 2>/dev/null || echo "")
    
    if [ ! -z "$existing_secrets" ]; then
        print_warning "Some secrets already exist in Secret Manager."
        read -p "Do you want to update existing secrets? (y/n): " update_secrets
        if [ "$update_secrets" != "y" ] && [ "$update_secrets" != "Y" ]; then
            print_status "Skipping secret setup."
            return 0
        fi
    fi
    
    # Get current values from environment if available
    local stripe_secret_key=${STRIPE_SECRET_KEY:-""}
    local stripe_webhook_secret=${STRIPE_WEBHOOK_SECRET:-""}
    local supabase_service_role_key=${SUPABASE_SERVICE_ROLE_KEY:-""}
    
    # Create secrets if values are provided
    if [ ! -z "$stripe_secret_key" ]; then
        print_status "Creating/updating STRIPE_SECRET_KEY..."
        echo -n "$stripe_secret_key" | gcloud secrets create STRIPE_SECRET_KEY \
            --data-file=- \
            --replication-policy="automatic" \
            --labels="app=minberai,environment=production" \
            --quiet 2>/dev/null || echo -n "$stripe_secret_key" | gcloud secrets versions add STRIPE_SECRET_KEY --data-file=- --quiet
    fi
    
    if [ ! -z "$stripe_webhook_secret" ]; then
        print_status "Creating/updating STRIPE_WEBHOOK_SECRET..."
        echo -n "$stripe_webhook_secret" | gcloud secrets create STRIPE_WEBHOOK_SECRET \
            --data-file=- \
            --replication-policy="automatic" \
            --labels="app=minberai,environment=production" \
            --quiet 2>/dev/null || echo -n "$stripe_webhook_secret" | gcloud secrets versions add STRIPE_WEBHOOK_SECRET --data-file=- --quiet
    fi
    
    if [ ! -z "$supabase_service_role_key" ]; then
        print_status "Creating/updating SUPABASE_SERVICE_ROLE_KEY..."
        echo -n "$supabase_service_role_key" | gcloud secrets create SUPABASE_SERVICE_ROLE_KEY \
            --data-file=- \
            --replication-policy="automatic" \
            --labels="app=minberai,environment=production" \
            --quiet 2>/dev/null || echo -n "$supabase_service_role_key" | gcloud secrets versions add SUPABASE_SERVICE_ROLE_KEY --data-file=- --quiet
    fi
    
    print_success "Secrets setup complete!"
}

# Create Cloud Build triggers
setup_cloud_build_triggers() {
    print_step "Setting up Cloud Build triggers..."
    
    # Check if GitHub repository is connected to Cloud Build
    print_status "Checking GitHub repository connection..."
    
    # Get the repository connection name for 2nd generation
    local repo_connection=$(gcloud builds connections list --region=$REGION --format="value(name)" 2>/dev/null | head -1)
    
    if [ -z "$repo_connection" ]; then
        print_warning "GitHub repository not connected to Cloud Build."
        print_status "You need to connect your GitHub repository first:"
        echo ""
        print_status "1. Go to Google Cloud Console → Cloud Build → Triggers"
        print_status "2. Click 'Connect Repository'"
        print_status "3. Select 'GitHub' and authorize"
        print_status "4. Select your repository: merkylen-ltd/minbarai-core"
        print_status "5. Run this script again: ./setup-ci-cd.sh --triggers"
        echo ""
        print_warning "Skipping trigger creation until GitHub is connected."
        return 0
    fi
    
    # Get the repository name from the connection
    local repo_name=$(gcloud builds repositories list --connection=$repo_connection --region=$REGION --format="value(name)" 2>/dev/null | head -1)
    
    if [ -z "$repo_name" ]; then
        print_error "Could not find repository in connection: $repo_connection"
        return 1
    fi
    
    print_success "Found GitHub connection: $repo_connection"
    print_success "Found repository: $repo_name"
    
    # Check if triggers already exist
    local existing_triggers=$(gcloud builds triggers list --filter="name:minbarai" --format="value(name)" 2>/dev/null || echo "")
    
    if [ ! -z "$existing_triggers" ]; then
        print_warning "Some Cloud Build triggers already exist."
        read -p "Do you want to recreate them? (y/n): " recreate_triggers
        if [ "$recreate_triggers" != "y" ] && [ "$recreate_triggers" != "Y" ]; then
            print_status "Skipping trigger creation."
            return 0
        fi
        
        # Delete existing triggers
        print_status "Deleting existing triggers..."
        gcloud builds triggers list --filter="name:minbarai" --format="value(name)" | xargs -I {} gcloud builds triggers delete {} --quiet 2>/dev/null || true
    fi
    
    # Try to create triggers using 2nd generation format
    print_status "Attempting to create triggers using 2nd generation format..."
    
    # Create development trigger
    print_status "Creating development trigger (dev branch)..."
    if gcloud builds triggers create github \
        --name="minbarai-dev-deploy" \
        --repository="$repo_name" \
        --branch-pattern="^dev$" \
        --build-config="cloudbuild.yaml" \
        --substitutions="_REGION=$REGION,_SERVICE_NAME_DEV=$DEV_SERVICE_NAME,_SERVICE_NAME_PROD=$PROD_SERVICE_NAME,_CUSTOM_DOMAIN=$CUSTOM_DOMAIN" \
        --region=$REGION \
        --quiet 2>/dev/null; then
        print_success "Development trigger created successfully!"
    else
        print_warning "Failed to create development trigger via CLI."
        print_status "You'll need to create triggers manually in Google Cloud Console."
        show_manual_trigger_instructions
        return 0
    fi
    
    # Create production trigger
    print_status "Creating production trigger (main branch)..."
    if gcloud builds triggers create github \
        --name="minbarai-prod-deploy" \
        --repository="$repo_name" \
        --branch-pattern="^main$" \
        --build-config="cloudbuild.yaml" \
        --substitutions="_REGION=$REGION,_SERVICE_NAME_DEV=$DEV_SERVICE_NAME,_SERVICE_NAME_PROD=$PROD_SERVICE_NAME,_CUSTOM_DOMAIN=$CUSTOM_DOMAIN" \
        --region=$REGION \
        --quiet 2>/dev/null; then
        print_success "Production trigger created successfully!"
    else
        print_warning "Failed to create production trigger via CLI."
        print_status "You'll need to create triggers manually in Google Cloud Console."
        show_manual_trigger_instructions
        return 0
    fi
    
    print_success "Cloud Build triggers created successfully!"
}

# Show manual trigger creation instructions
show_manual_trigger_instructions() {
    echo ""
    print_status "Manual Trigger Creation Instructions:"
    echo ""
    print_status "1. Open Google Cloud Console:"
    print_status "   https://console.cloud.google.com/cloud-build/triggers?project=$PROJECT_ID"
    echo ""
    print_status "2. Create Development Trigger:"
    print_status "   - Name: minbarai-dev-deploy"
    print_status "   - Event: Push to a branch"
    print_status "   - Source: merkylen-ltd/minbarai-core"
    print_status "   - Branch: ^dev$"
    print_status "   - Configuration: Cloud Build configuration file (yaml or json)"
    print_status "   - Location: Repository"
    print_status "   - Build configuration file location: cloudbuild.yaml"
    echo ""
    print_status "3. Create Production Trigger:"
    print_status "   - Name: minbarai-prod-deploy"
    print_status "   - Event: Push to a branch"
    print_status "   - Source: merkylen-ltd/minbarai-core"
    print_status "   - Branch: ^main$"
    print_status "   - Configuration: Cloud Build configuration file (yaml or json)"
    print_status "   - Location: Repository"
    print_status "   - Build configuration file location: cloudbuild.yaml"
    echo ""
    print_status "4. Test the pipeline:"
    print_status "   git checkout dev"
    print_status "   git commit --allow-empty -m 'test: trigger CI/CD'"
    print_status "   git push origin dev"
    echo ""
}

# Verify the complete setup
verify_setup() {
    print_step "Verifying CI/CD setup..."
    
    # Check service account
    local service_account_email="$SERVICE_ACCOUNT_NAME@$PROJECT_ID.iam.gserviceaccount.com"
    if ! gcloud iam service-accounts describe $service_account_email --quiet &> /dev/null; then
        print_error "Service account verification failed"
        return 1
    fi
    
    # Check secrets
    local required_secrets=("STRIPE_SECRET_KEY" "STRIPE_WEBHOOK_SECRET" "SUPABASE_SERVICE_ROLE_KEY")
    for secret in "${required_secrets[@]}"; do
        if ! gcloud secrets describe $secret --quiet &> /dev/null; then
            print_warning "Secret $secret not found - you may need to set it manually"
        fi
    done
    
    # Check triggers
    local trigger_count=$(gcloud builds triggers list --filter="name:minbarai" --format="value(name)" | wc -l)
    if [ "$trigger_count" -lt 2 ]; then
        print_warning "Expected 2 Cloud Build triggers, found $trigger_count"
    fi
    
    print_success "CI/CD setup verification complete!"
}

# Display comprehensive summary
display_summary() {
    echo ""
    echo "=================================================="
    echo "🎉 MinberAI CI/CD Setup Complete!"
    echo "=================================================="
    echo ""
    echo "📋 Configuration Summary:"
    echo "   Project ID: $PROJECT_ID"
    echo "   Region: $REGION"
    echo "   Service Account: $SERVICE_ACCOUNT_NAME@$PROJECT_ID.iam.gserviceaccount.com"
    echo "   Key File: $SERVICE_ACCOUNT_FILE"
    echo "   GitHub Repository: merkylen-ltd/minbarai-core (detected from connection)"
    echo ""
    echo "🔧 Services Created:"
    echo "   - Development: $DEV_SERVICE_NAME"
    echo "   - Production: $PROD_SERVICE_NAME"
    echo "   - Domain: $CUSTOM_DOMAIN"
    echo ""
    echo "🔑 Secrets in Secret Manager:"
    echo "   - STRIPE_SECRET_KEY"
    echo "   - STRIPE_WEBHOOK_SECRET"
    echo "   - SUPABASE_SERVICE_ROLE_KEY"
    echo ""
    echo "🚀 Cloud Build Triggers:"
    echo "   - minbarai-dev-deploy (dev branch)"
    echo "   - minbarai-prod-deploy (main branch)"
    echo ""
    echo "📝 Next Steps:"
    echo "   1. Test the pipeline with a commit to dev branch:"
    echo "      git checkout dev"
    echo "      git commit --allow-empty -m 'test: trigger CI/CD'"
    echo "      git push origin dev"
    echo ""
    echo "   2. Monitor the build:"
    echo "      gcloud builds list --limit=5"
    echo ""
    echo "   3. View service URLs:"
    echo "      gcloud run services list --region=$REGION"
    echo ""
    echo "🔍 Useful Commands:"
    echo "   View builds: gcloud builds list --limit=10"
    echo "   View services: gcloud run services list --region=$REGION"
    echo "   View secrets: gcloud secrets list --filter='labels.app=minberai'"
    echo "   View triggers: gcloud builds triggers list"
    echo ""
    echo "⚠️  IMPORTANT:"
    echo "   - Keep $SERVICE_ACCOUNT_FILE secure"
    echo "   - Update .env file with any missing values"
    echo "   - Test the pipeline before relying on it"
    echo "=================================================="
}

# Main setup function
main() {
    echo "🚀 MinberAI CI/CD Setup"
    echo "=================================================="
    echo ""
    print_ci "This script will set up the complete CI/CD pipeline for MinberAI"
    print_ci "It will configure Google Cloud Build, service accounts, secrets, and triggers"
    echo ""
    
    check_prerequisites
    configure_gcloud
    setup_service_account
    setup_secrets
    setup_cloud_build_triggers
    verify_setup
    display_summary
    
    echo ""
    print_success "🎉 CI/CD setup completed successfully!"
    print_ci "Your pipeline is ready to use. Test it with a commit to the dev branch."
}

# Handle script arguments
case "${1:-}" in
    --help|-h)
        echo "MinberAI CI/CD Setup Script"
        echo ""
        echo "Usage: $0 [OPTIONS]"
        echo ""
        echo "Options:"
        echo "  --help, -h     Show this help message"
        echo "  --verify       Verify existing CI/CD setup"
        echo "  --triggers     Only setup Cloud Build triggers"
        echo "  --secrets      Only setup secrets in Secret Manager"
        echo "  --service-account  Only setup service account and permissions"
        echo "  --status       Show current CI/CD status"
        echo "  --clean        Clean up all CI/CD resources (DANGEROUS)"
        echo ""
        echo "Environment Variables (from .env file):"
        echo "  GOOGLE_CLOUD_PROJECT_ID              Google Cloud project ID"
        echo "  GOOGLE_CLOUD_REGION                 Google Cloud region"
        echo "  GOOGLE_CLOUD_SERVICE_ACCOUNT_NAME   Service account name"
        echo "  GITHUB_OWNER                        GitHub username/organization"
        echo "  GITHUB_REPO                         GitHub repository name"
        echo "  DEV_SERVICE_NAME                    Development service name"
        echo "  PROD_SERVICE_NAME                   Production service name"
        echo "  CUSTOM_DOMAIN                       Custom domain for production"
        echo ""
        echo "Prerequisites:"
        echo "  - gcloud CLI installed and authenticated"
        echo "  - GitHub repository connected to Google Cloud"
        echo "  - Project with billing enabled"
        echo ""
        echo "This script will:"
        echo "  1. Enable required Google Cloud APIs"
        echo "  2. Create service account with CI/CD permissions"
        echo "  3. Set up secrets in Secret Manager"
        echo "  4. Create Cloud Build triggers for dev and main branches"
        echo "  5. Verify the complete setup"
        echo ""
        echo "This is the single script for all CI/CD setup. Other setup scripts"
        echo "have been consolidated into this one for simplicity."
        exit 0
        ;;
    --verify)
        check_prerequisites
        configure_gcloud
        verify_setup
        exit 0
        ;;
    --triggers)
        check_prerequisites
        configure_gcloud
        setup_cloud_build_triggers
        exit 0
        ;;
    --secrets)
        check_prerequisites
        configure_gcloud
        setup_secrets
        exit 0
        ;;
    --service-account)
        check_prerequisites
        configure_gcloud
        setup_service_account
        exit 0
        ;;
    --status)
        print_status "Current CI/CD Status:"
        echo ""
        echo "Project: $PROJECT_ID"
        echo "Region: $REGION"
        echo "Service Account: $SERVICE_ACCOUNT_NAME@$PROJECT_ID.iam.gserviceaccount.com"
        echo ""
        echo "Cloud Build Triggers:"
        gcloud builds triggers list --filter="name:minbarai" --format="table(name,github.owner,github.name,github.push.branch)" 2>/dev/null || echo "No triggers found"
        echo ""
        echo "Secrets:"
        gcloud secrets list --filter="name:STRIPE_SECRET_KEY OR name:STRIPE_WEBHOOK_SECRET OR name:SUPABASE_SERVICE_ROLE_KEY" --format="table(name,createTime)" 2>/dev/null || echo "No secrets found"
        echo ""
        echo "Services:"
        gcloud run services list --region=$REGION --format="table(metadata.name,status.url)" 2>/dev/null || echo "No services found"
        exit 0
        ;;
    --clean)
        print_warning "This will DELETE all CI/CD resources!"
        read -p "Are you sure? Type 'DELETE' to confirm: " confirm
        if [ "$confirm" = "DELETE" ]; then
            print_status "Cleaning up CI/CD resources..."
            
            # Delete triggers
            gcloud builds triggers list --filter="name:minbarai" --format="value(name)" | xargs -I {} gcloud builds triggers delete {} --quiet 2>/dev/null || true
            
            # Delete secrets
            gcloud secrets list --filter="name:STRIPE_SECRET_KEY OR name:STRIPE_WEBHOOK_SECRET OR name:SUPABASE_SERVICE_ROLE_KEY" --format="value(name)" | xargs -I {} gcloud secrets delete {} --quiet 2>/dev/null || true
            
            # Delete service account
            local service_account_email="$SERVICE_ACCOUNT_NAME@$PROJECT_ID.iam.gserviceaccount.com"
            gcloud iam service-accounts delete $service_account_email --quiet 2>/dev/null || true
            
            # Delete key file
            rm -f "$SERVICE_ACCOUNT_FILE"
            
            print_success "All CI/CD resources cleaned up!"
        else
            print_status "Operation cancelled."
        fi
        exit 0
        ;;
    *)
        main
        ;;
esac
