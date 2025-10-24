#!/bin/bash

# 🔐 Google Secret Manager Setup Script for MinberAI
# Sets up all sensitive environment variables in Google Secret Manager

set -e  # Exit on any error

# Load environment variables from .env file if it exists
if [ -f ".env" ]; then
    echo "Loading environment variables from .env file..."
    export $(grep -v '^#' .env | xargs)
fi

# Configuration - Can be overridden by .env file
PROJECT_ID=${GOOGLE_CLOUD_PROJECT_ID:-"gen-lang-client-0842740671"}
REGION=${GOOGLE_CLOUD_REGION:-"europe-west3"}

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
    
    # Check if project is set
    if [ "$PROJECT_ID" = "your-project-id" ] || [ -z "$PROJECT_ID" ]; then
        print_error "Please set GOOGLE_CLOUD_PROJECT_ID in your .env file or update the script."
        print_status "Create .env file: cp env.example .env"
        exit 1
    fi
    
    print_success "Prerequisites met!"
}

# Configure gcloud
configure_gcloud() {
    print_status "Configuring gcloud..."
    
    # Set project
    gcloud config set project $PROJECT_ID
    
    # Enable required APIs
    gcloud services enable secretmanager.googleapis.com --quiet
    
    print_success "gcloud configured!"
}

# Create secret in Secret Manager
create_secret() {
    local secret_name=$1
    local secret_value=$2
    local description=$3
    
    print_status "Creating secret: $secret_name"
    
    # Check if secret already exists
    if gcloud secrets describe $secret_name --quiet &> /dev/null; then
        print_warning "Secret $secret_name already exists. Updating..."
        
        # Add new version to existing secret
        echo -n "$secret_value" | gcloud secrets versions add $secret_name --data-file=- --quiet
    else
        # Create new secret
        echo -n "$secret_value" | gcloud secrets create $secret_name \
            --data-file=- \
            --replication-policy="automatic" \
            --labels="app=minberai,environment=production" \
            --quiet
    fi
    
    print_success "Secret $secret_name created/updated successfully!"
}

# Interactive secret input
get_secret_input() {
    local secret_name=$1
    local description=$2
    local current_value=$3
    
    echo ""
    echo "=================================================="
    echo "🔐 Setting up: $secret_name"
    echo "Description: $description"
    echo "=================================================="
    
    if [ ! -z "$current_value" ]; then
        echo "Current value: ${current_value:0:8}..."
        read -p "Keep current value? (y/n): " keep_current
        if [ "$keep_current" = "y" ] || [ "$keep_current" = "Y" ]; then
            echo "$current_value"
            return
        fi
    fi
    
    read -s -p "Enter $secret_name: " secret_value
    echo ""
    
    if [ -z "$secret_value" ]; then
        print_error "Secret value cannot be empty!"
        exit 1
    fi
    
    echo "$secret_value"
}

# Main setup function
main() {
    echo "🔐 MinberAI Secret Manager Setup"
    echo "=================================================="
    echo ""
    
    check_prerequisites
    configure_gcloud
    
    print_status "Setting up secrets in Google Secret Manager..."
    echo ""
    print_warning "You will be prompted to enter sensitive values."
    print_warning "These will be stored securely in Google Secret Manager."
    echo ""
    
    # Get current values from environment if available
    CURRENT_STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY:-""}
    CURRENT_STRIPE_WEBHOOK_SECRET=${STRIPE_WEBHOOK_SECRET:-""}
    CURRENT_SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY:-""}
    
    # Check if .env file exists and suggest creating it
    if [ ! -f ".env" ]; then
        print_warning ".env file not found. Creating from template..."
        if [ -f "env.example" ]; then
            cp env.example .env
            print_status "Created .env file from env.example. Please edit it with your values."
        else
            print_error "env.example file not found. Please create .env file manually."
            exit 1
        fi
    fi
    
    # Set up secrets
    # Gemini translation removed; no GEMINI_API_KEY needed
    
    STRIPE_SECRET_KEY=$(get_secret_input "STRIPE_SECRET_KEY" "Stripe secret key for payment processing" "$CURRENT_STRIPE_SECRET_KEY")
    create_secret "STRIPE_SECRET_KEY" "$STRIPE_SECRET_KEY" "Stripe secret key for payment processing"
    
    STRIPE_WEBHOOK_SECRET=$(get_secret_input "STRIPE_WEBHOOK_SECRET" "Stripe webhook signing secret" "$CURRENT_STRIPE_WEBHOOK_SECRET")
    create_secret "STRIPE_WEBHOOK_SECRET" "$STRIPE_WEBHOOK_SECRET" "Stripe webhook signing secret"
    
    SUPABASE_SERVICE_ROLE_KEY=$(get_secret_input "SUPABASE_SERVICE_ROLE_KEY" "Supabase service role key for database access" "$CURRENT_SUPABASE_SERVICE_ROLE_KEY")
    create_secret "SUPABASE_SERVICE_ROLE_KEY" "$SUPABASE_SERVICE_ROLE_KEY" "Supabase service role key for database access"
    
    echo ""
    echo "=================================================="
    echo "🎉 Secret Manager Setup Complete!"
    echo "=================================================="
    echo ""
    echo "✅ Created/Updated secrets:"
    # Gemini removed
    echo "   - STRIPE_SECRET_KEY"
    echo "   - STRIPE_WEBHOOK_SECRET"
    echo "   - SUPABASE_SERVICE_ROLE_KEY"
    echo ""
    echo "📝 Next steps:"
    echo "   1. Run ./deploy-pro.sh to deploy production environment"
    echo "   2. Run ./deploy-dev.sh to deploy development environment"
    echo "   3. Update Supabase OAuth redirect URLs"
    echo "   4. Test the deployment"
    echo ""
    echo "🔍 View secrets:"
    echo "   gcloud secrets list --filter='labels.app=minberai'"
    echo ""
    echo "⚠️  IMPORTANT: Keep these secrets secure!"
    echo "   They are now stored in Google Secret Manager and will be"
    echo "   automatically injected into your Cloud Run services."
    echo "=================================================="
}

# Handle script arguments
case "${1:-}" in
    --help|-h)
        echo "MinberAI Secret Manager Setup Script"
        echo ""
        echo "Usage: $0 [OPTIONS]"
        echo ""
        echo "Options:"
        echo "  --help, -h     Show this help message"
        echo "  --list         List all MinberAI secrets"
        echo "  --delete       Delete all MinberAI secrets (DANGEROUS)"
        echo ""
        echo "Configuration:"
        echo "  Edit this script to set PROJECT_ID and REGION"
        echo ""
        echo "Prerequisites:"
        echo "  - gcloud CLI installed and authenticated"
        echo "  - Secret Manager API enabled"
        echo "  - Appropriate IAM permissions"
        exit 0
        ;;
    --list)
        print_status "Listing MinberAI secrets..."
        gcloud secrets list --filter='labels.app=minberai' --format='table(name,createTime,labels)'
        exit 0
        ;;
    --delete)
        print_warning "This will delete ALL MinberAI secrets!"
        read -p "Are you sure? Type 'DELETE' to confirm: " confirm
        if [ "$confirm" = "DELETE" ]; then
            print_status "Deleting MinberAI secrets..."
            gcloud secrets list --filter='labels.app=minberai' --format='value(name)' | xargs -I {} gcloud secrets delete {} --quiet
            print_success "All MinberAI secrets deleted!"
        else
            print_status "Operation cancelled."
        fi
        exit 0
        ;;
    *)
        main
        ;;
esac
