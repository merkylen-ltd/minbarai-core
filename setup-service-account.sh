#!/bin/bash

# 🔐 Google Cloud Service Account Setup Script for MinberAI
# Creates service account with all required permissions for Cloud Run deployment

set -e  # Exit on any error

# Load environment variables from .env file if it exists
if [ -f ".env" ]; then
    echo "Loading environment variables from .env file..."
    export $(grep -v '^#' .env | xargs)
fi

# Configuration - Can be overridden by .env file
PROJECT_ID=${GOOGLE_CLOUD_PROJECT_ID:-"gen-lang-client-0842740671"}
SERVICE_ACCOUNT_NAME=${GOOGLE_CLOUD_SERVICE_ACCOUNT_NAME:-"minberai-service-account"}
SERVICE_ACCOUNT_DISPLAY_NAME="MinberAI Service Account"
SERVICE_ACCOUNT_DESCRIPTION="Service account for MinberAI Cloud Run deployment with Secret Manager access"
SERVICE_ACCOUNT_FILE=${GOOGLE_CLOUD_SERVICE_ACCOUNT_FILE:-"minberai-service-account.json"}

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
    
    print_success "Prerequisites met!"
}

# Configure gcloud
configure_gcloud() {
    print_status "Configuring gcloud..."
    
    # Set project
    gcloud config set project $PROJECT_ID
    
    # Enable required APIs
    print_status "Enabling required Google Cloud APIs..."
    gcloud services enable run.googleapis.com --quiet
    gcloud services enable secretmanager.googleapis.com --quiet
    gcloud services enable cloudbuild.googleapis.com --quiet
    gcloud services enable containerregistry.googleapis.com --quiet
    gcloud services enable iam.googleapis.com --quiet
    
    print_success "gcloud configured and APIs enabled!"
}

# Create service account
create_service_account() {
    print_status "Creating service account: $SERVICE_ACCOUNT_NAME"
    
    # Check if service account already exists
    if gcloud iam service-accounts describe $SERVICE_ACCOUNT_NAME@$PROJECT_ID.iam.gserviceaccount.com --quiet &> /dev/null; then
        print_warning "Service account $SERVICE_ACCOUNT_NAME already exists."
        read -p "Do you want to continue and update permissions? (y/n): " continue_setup
        if [ "$continue_setup" != "y" ] && [ "$continue_setup" != "Y" ]; then
            print_status "Skipping service account creation."
            return 0
        fi
    else
        # Create service account
        gcloud iam service-accounts create $SERVICE_ACCOUNT_NAME \
            --display-name="$SERVICE_ACCOUNT_DISPLAY_NAME" \
            --description="$SERVICE_ACCOUNT_DESCRIPTION" \
            --quiet
        
        print_success "Service account created successfully!"
    fi
}

# Grant IAM roles
grant_iam_roles() {
    print_status "Granting IAM roles to service account..."
    
    local service_account_email="$SERVICE_ACCOUNT_NAME@$PROJECT_ID.iam.gserviceaccount.com"
    
    # Define roles to grant
    local roles=(
        "roles/run.admin"
        "roles/iam.serviceAccountUser"
        "roles/secretmanager.secretAccessor"
        "roles/storage.admin"
        "roles/cloudbuild.builds.editor"
        "roles/containerregistry.ServiceAgent"
    )
    
    # Grant each role
    for role in "${roles[@]}"; do
        print_status "Granting role: $role"
        gcloud projects add-iam-policy-binding $PROJECT_ID \
            --member="serviceAccount:$service_account_email" \
            --role="$role" \
            --quiet
    done
    
    print_success "All IAM roles granted successfully!"
}

# Create and download service account key
create_service_account_key() {
    print_status "Creating and downloading service account key..."
    
    local service_account_email="$SERVICE_ACCOUNT_NAME@$PROJECT_ID.iam.gserviceaccount.com"
    
    # Check if key file already exists
    if [ -f "$SERVICE_ACCOUNT_FILE" ]; then
        print_warning "Service account key file $SERVICE_ACCOUNT_FILE already exists."
        read -p "Do you want to overwrite it? (y/n): " overwrite_key
        if [ "$overwrite_key" != "y" ] && [ "$overwrite_key" != "Y" ]; then
            print_status "Keeping existing key file."
            return 0
        fi
    fi
    
    # Create and download key
    gcloud iam service-accounts keys create $SERVICE_ACCOUNT_FILE \
        --iam-account=$service_account_email \
        --quiet
    
    print_success "Service account key downloaded to: $SERVICE_ACCOUNT_FILE"
}

# Verify service account setup
verify_setup() {
    print_status "Verifying service account setup..."
    
    local service_account_email="$SERVICE_ACCOUNT_NAME@$PROJECT_ID.iam.gserviceaccount.com"
    
    # Check if service account exists
    if ! gcloud iam service-accounts describe $service_account_email --quiet &> /dev/null; then
        print_error "Service account verification failed: Account not found"
        return 1
    fi
    
    # Check if key file exists and is valid JSON
    if [ ! -f "$SERVICE_ACCOUNT_FILE" ]; then
        print_error "Service account key file not found: $SERVICE_ACCOUNT_FILE"
        return 1
    fi
    
    if ! jq empty "$SERVICE_ACCOUNT_FILE" 2>/dev/null; then
        print_error "Service account key file is not valid JSON: $SERVICE_ACCOUNT_FILE"
        return 1
    fi
    
    # List granted roles
    print_status "Service account roles:"
    gcloud projects get-iam-policy $PROJECT_ID \
        --flatten="bindings[].members" \
        --format="table(bindings.role)" \
        --filter="bindings.members:$service_account_email"
    
    print_success "Service account setup verified successfully!"
}

# Display summary
display_summary() {
    echo ""
    echo "=================================================="
    echo "🎉 Service Account Setup Complete!"
    echo "=================================================="
    echo ""
    echo "📋 Configuration Summary:"
    echo "   Project ID: $PROJECT_ID"
    echo "   Service Account: $SERVICE_ACCOUNT_NAME@$PROJECT_ID.iam.gserviceaccount.com"
    echo "   Key File: $SERVICE_ACCOUNT_FILE"
    echo ""
    echo "🔑 Granted Roles:"
    echo "   - Cloud Run Admin (deploy and manage services)"
    echo "   - Service Account User (impersonate service account)"
    echo "   - Secret Manager Secret Accessor (access secrets)"
    echo "   - Storage Admin (push/pull container images)"
    echo "   - Cloud Build Editor (CI/CD builds)"
    echo "   - Container Registry Service Agent (container operations)"
    echo ""
    echo "📝 Next Steps:"
    echo "   1. Update your .env file with the service account file path:"
    echo "      GOOGLE_CLOUD_SERVICE_ACCOUNT_FILE=$SERVICE_ACCOUNT_FILE"
    echo ""
    echo "   2. Set up secrets in Secret Manager:"
    echo "      ./setup-secrets.sh"
    echo ""
    echo "   3. Deploy to production:"
    echo "      ./deploy-pro.sh"
    echo ""
    echo "   4. Deploy to development:"
    echo "      ./deploy-dev.sh"
    echo ""
    echo "⚠️  SECURITY NOTES:"
    echo "   - Keep $SERVICE_ACCOUNT_FILE secure and never commit it to version control"
    echo "   - The file is already added to .gitignore"
    echo "   - Consider rotating keys periodically for security"
    echo ""
    echo "🔍 Verify setup:"
    echo "   gcloud iam service-accounts describe $SERVICE_ACCOUNT_NAME@$PROJECT_ID.iam.gserviceaccount.com"
    echo "=================================================="
}

# Main setup function
main() {
    echo "🔐 MinberAI Google Cloud Service Account Setup"
    echo "=================================================="
    echo ""
    
    check_prerequisites
    configure_gcloud
    create_service_account
    grant_iam_roles
    create_service_account_key
    verify_setup
    display_summary
    
    echo ""
    print_success "🎉 Service account setup completed successfully!"
    print_status "You can now proceed with secret setup and deployment."
}

# Handle script arguments
case "${1:-}" in
    --help|-h)
        echo "MinberAI Google Cloud Service Account Setup Script"
        echo ""
        echo "Usage: $0 [OPTIONS]"
        echo ""
        echo "Options:"
        echo "  --help, -h     Show this help message"
        echo "  --verify       Verify existing service account setup"
        echo "  --list-roles   List current roles for the service account"
        echo "  --delete       Delete the service account (DANGEROUS)"
        echo ""
        echo "Environment Variables (from .env file):"
        echo "  GOOGLE_CLOUD_PROJECT_ID              Google Cloud project ID"
        echo "  GOOGLE_CLOUD_SERVICE_ACCOUNT_NAME    Service account name"
        echo "  GOOGLE_CLOUD_SERVICE_ACCOUNT_FILE    Service account key file path"
        echo ""
        echo "Prerequisites:"
        echo "  - gcloud CLI installed and authenticated"
        echo "  - Appropriate permissions to create service accounts"
        echo "  - Project with billing enabled"
        echo ""
        echo "This script will:"
        echo "  1. Enable required Google Cloud APIs"
        echo "  2. Create service account with proper permissions"
        echo "  3. Download service account key file"
        echo "  4. Verify the setup"
        exit 0
        ;;
    --verify)
        check_prerequisites
        configure_gcloud
        verify_setup
        exit 0
        ;;
    --list-roles)
        check_prerequisites
        configure_gcloud
        local service_account_email="$SERVICE_ACCOUNT_NAME@$PROJECT_ID.iam.gserviceaccount.com"
        print_status "Current roles for $service_account_email:"
        gcloud projects get-iam-policy $PROJECT_ID \
            --flatten="bindings[].members" \
            --format="table(bindings.role)" \
            --filter="bindings.members:$service_account_email"
        exit 0
        ;;
    --delete)
        print_warning "This will DELETE the service account and all associated keys!"
        read -p "Are you sure? Type 'DELETE' to confirm: " confirm
        if [ "$confirm" = "DELETE" ]; then
            check_prerequisites
            configure_gcloud
            local service_account_email="$SERVICE_ACCOUNT_NAME@$PROJECT_ID.iam.gserviceaccount.com"
            print_status "Deleting service account: $service_account_email"
            gcloud iam service-accounts delete $service_account_email --quiet
            if [ -f "$SERVICE_ACCOUNT_FILE" ]; then
                rm "$SERVICE_ACCOUNT_FILE"
                print_status "Deleted key file: $SERVICE_ACCOUNT_FILE"
            fi
            print_success "Service account deleted successfully!"
        else
            print_status "Operation cancelled."
        fi
        exit 0
        ;;
    *)
        main
        ;;
esac
