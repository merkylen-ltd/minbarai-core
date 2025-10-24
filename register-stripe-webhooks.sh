#!/bin/bash

# 🔗 Stripe Webhook Registration Script for MinberAI
# Automatically creates/updates Stripe webhook endpoints for Cloud Run deployments

set -e  # Exit on any error

# Load environment variables from .env file if it exists
if [ -f ".env" ]; then
    echo "Loading environment variables from .env file..."
    export $(grep -v '^#' .env | xargs)
fi

# Configuration - Can be overridden by .env file
STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY:-""}
WEBHOOK_URL_PROD="https://${CUSTOM_DOMAIN:-minbarai.com}/api/stripe/webhooks"
WEBHOOK_URL_DEV="https://minbarai-dev-878512438019.europe-west3.run.app/api/stripe/webhooks"

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
    
    # Check if curl is installed
    if ! command -v curl &> /dev/null; then
        print_error "curl is not installed. Please install it first."
        exit 1
    fi
    
    # Check if jq is installed
    if ! command -v jq &> /dev/null; then
        print_error "jq is not installed. Please install it first."
        exit 1
    fi
    
    print_success "Prerequisites met!"
}

# Get Stripe secret key from environment
get_stripe_secret_key() {
    if [ -z "$STRIPE_SECRET_KEY" ]; then
        print_error "Stripe secret key not found."
        print_status "Please set STRIPE_SECRET_KEY in your .env file."
        print_status "Create .env file: cp env.example .env"
        exit 1
    fi
}

# List existing webhooks
list_webhooks() {
    print_status "Fetching existing webhook endpoints..."
    
    curl -s -u "$STRIPE_SECRET_KEY:" \
        "https://api.stripe.com/v1/webhook_endpoints" \
        | jq -r '.data[] | "\(.id) - \(.url) - \(.status)"'
}

# Create or update webhook endpoint
create_webhook() {
    local webhook_url=$1
    local environment=$2
    
    print_status "Creating/updating webhook for $environment: $webhook_url"
    
    # Check if webhook already exists
    local existing_webhook=$(curl -s -u "$STRIPE_SECRET_KEY:" \
        "https://api.stripe.com/v1/webhook_endpoints" \
        | jq -r --arg url "$webhook_url" '.data[] | select(.url == $url) | .id')
    
    # Events to listen for
    local events='[
        "checkout.session.completed",
        "checkout.session.expired",
        "customer.subscription.created",
        "customer.subscription.updated",
        "customer.subscription.deleted",
        "customer.subscription.trial_will_end",
        "invoice.payment_succeeded",
        "invoice.payment_failed",
        "invoice.payment_action_required",
        "invoice.finalized",
        "payment_method.attached",
        "payment_method.detached",
        "payment_method.updated",
        "customer.updated",
        "customer.deleted",
        "payment_intent.succeeded",
        "payment_intent.payment_failed",
        "payment_intent.canceled",
        "charge.dispute.created",
        "charge.dispute.updated",
        "charge.dispute.closed",
        "charge.refunded"
    ]'
    
    if [ ! -z "$existing_webhook" ]; then
        print_warning "Webhook already exists with ID: $existing_webhook"
        print_status "Updating existing webhook..."
        
        # Update existing webhook
        local response=$(curl -s -u "$STRIPE_SECRET_KEY:" \
            -X POST \
            "https://api.stripe.com/v1/webhook_endpoints/$existing_webhook" \
            -d "enabled_events[]=checkout.session.completed" \
            -d "enabled_events[]=checkout.session.expired" \
            -d "enabled_events[]=customer.subscription.created" \
            -d "enabled_events[]=customer.subscription.updated" \
            -d "enabled_events[]=customer.subscription.deleted" \
            -d "enabled_events[]=customer.subscription.trial_will_end" \
            -d "enabled_events[]=invoice.payment_succeeded" \
            -d "enabled_events[]=invoice.payment_failed" \
            -d "enabled_events[]=invoice.payment_action_required" \
            -d "enabled_events[]=invoice.finalized" \
            -d "enabled_events[]=payment_method.attached" \
            -d "enabled_events[]=payment_method.detached" \
            -d "enabled_events[]=payment_method.updated" \
            -d "enabled_events[]=customer.updated" \
            -d "enabled_events[]=customer.deleted" \
            -d "enabled_events[]=payment_intent.succeeded" \
            -d "enabled_events[]=payment_intent.payment_failed" \
            -d "enabled_events[]=payment_intent.canceled" \
            -d "enabled_events[]=charge.dispute.created" \
            -d "enabled_events[]=charge.dispute.updated" \
            -d "enabled_events[]=charge.dispute.closed" \
            -d "enabled_events[]=charge.refunded")
        
        local webhook_id=$(echo "$response" | jq -r '.id')
        local signing_secret=$(echo "$response" | jq -r '.secret')
        
        print_success "Webhook updated successfully!"
        echo "Webhook ID: $webhook_id"
        echo "Signing Secret: $signing_secret"
        
    else
        print_status "Creating new webhook endpoint..."
        
        # Create new webhook
        local response=$(curl -s -u "$STRIPE_SECRET_KEY:" \
            -X POST \
            "https://api.stripe.com/v1/webhook_endpoints" \
            -d "url=$webhook_url" \
            -d "enabled_events[]=checkout.session.completed" \
            -d "enabled_events[]=checkout.session.expired" \
            -d "enabled_events[]=customer.subscription.created" \
            -d "enabled_events[]=customer.subscription.updated" \
            -d "enabled_events[]=customer.subscription.deleted" \
            -d "enabled_events[]=customer.subscription.trial_will_end" \
            -d "enabled_events[]=invoice.payment_succeeded" \
            -d "enabled_events[]=invoice.payment_failed" \
            -d "enabled_events[]=invoice.payment_action_required" \
            -d "enabled_events[]=invoice.finalized" \
            -d "enabled_events[]=payment_method.attached" \
            -d "enabled_events[]=payment_method.detached" \
            -d "enabled_events[]=payment_method.updated" \
            -d "enabled_events[]=customer.updated" \
            -d "enabled_events[]=customer.deleted" \
            -d "enabled_events[]=payment_intent.succeeded" \
            -d "enabled_events[]=payment_intent.payment_failed" \
            -d "enabled_events[]=payment_intent.canceled" \
            -d "enabled_events[]=charge.dispute.created" \
            -d "enabled_events[]=charge.dispute.updated" \
            -d "enabled_events[]=charge.dispute.closed" \
            -d "enabled_events[]=charge.refunded")
        
        local webhook_id=$(echo "$response" | jq -r '.id')
        local signing_secret=$(echo "$response" | jq -r '.secret')
        
        if [ "$webhook_id" = "null" ] || [ -z "$webhook_id" ]; then
            print_error "Failed to create webhook. Response:"
            echo "$response" | jq '.'
            exit 1
        fi
        
        print_success "Webhook created successfully!"
        echo "Webhook ID: $webhook_id"
        echo "Signing Secret: $signing_secret"
    fi
    
    # Store signing secret for later use
    echo "$signing_secret" > ".stripe-webhook-secret-$environment"
    print_status "Signing secret saved to .stripe-webhook-secret-$environment"
}

# Test webhook endpoint
test_webhook() {
    local webhook_url=$1
    local environment=$2
    
    print_status "Testing webhook endpoint for $environment..."
    
    # Send a test request to the webhook endpoint
    local test_response=$(curl -s -w "%{http_code}" -o /dev/null \
        -X POST \
        "$webhook_url" \
        -H "Content-Type: application/json" \
        -d '{"test": true}')
    
    if [ "$test_response" = "200" ] || [ "$test_response" = "400" ]; then
        print_success "Webhook endpoint is reachable (HTTP $test_response)"
    else
        print_warning "Webhook endpoint returned HTTP $test_response"
        print_status "This might be expected if the endpoint requires proper Stripe signature validation."
    fi
}

# Main function
main() {
    local environment=${1:-production}
    
    echo "🔗 MinberAI Stripe Webhook Registration"
    echo "=================================================="
    echo ""
    
    check_prerequisites
    get_stripe_secret_key
    
    print_status "Registering webhooks for environment: $environment"
    echo ""
    
    # List existing webhooks
    print_status "Current webhook endpoints:"
    list_webhooks
    echo ""
    
    if [ "$environment" = "production" ]; then
        if [ -z "$WEBHOOK_URL_PROD" ]; then
            print_error "Production webhook URL not configured."
            exit 1
        fi
        create_webhook "$WEBHOOK_URL_PROD" "production"
        test_webhook "$WEBHOOK_URL_PROD" "production"
        
    elif [ "$environment" = "development" ]; then
        if [ -z "$WEBHOOK_URL_DEV" ]; then
            print_error "Development webhook URL not configured."
            print_status "Please set WEBHOOK_URL_DEV in the script or pass it as an argument."
            exit 1
        fi
        create_webhook "$WEBHOOK_URL_DEV" "development"
        test_webhook "$WEBHOOK_URL_DEV" "development"
        
    else
        print_error "Invalid environment. Use 'production' or 'development'."
        exit 1
    fi
    
    echo ""
    echo "=================================================="
    echo "🎉 Webhook Registration Complete!"
    echo "=================================================="
    echo ""
    echo "✅ Webhook endpoints configured for $environment"
    echo ""
    echo "📝 Next steps:"
    echo "   1. Update STRIPE_WEBHOOK_SECRET in Secret Manager with the signing secret"
    echo "   2. Test webhook events in Stripe Dashboard"
    echo "   3. Monitor webhook logs in your application"
    echo ""
    echo "🔍 View webhooks in Stripe Dashboard:"
    echo "   https://dashboard.stripe.com/webhooks"
    echo ""
    echo "⚠️  IMPORTANT: Keep the signing secret secure!"
    echo "   It's saved in .stripe-webhook-secret-$environment"
    echo "=================================================="
}

# Handle script arguments
case "${1:-}" in
    --help|-h)
        echo "MinberAI Stripe Webhook Registration Script"
        echo ""
        echo "Usage: $0 [ENVIRONMENT] [OPTIONS]"
        echo ""
        echo "Environments:"
        echo "  production     Register webhook for production (minbarai.com)"
        echo "  development    Register webhook for development (requires WEBHOOK_URL_DEV)"
        echo ""
        echo "Options:"
        echo "  --help, -h     Show this help message"
        echo "  --list         List all existing webhook endpoints"
        echo "  --test URL     Test a specific webhook URL"
        echo ""
        echo "Environment Variables:"
        echo "  STRIPE_SECRET_KEY    Stripe secret key (required)"
        echo "  WEBHOOK_URL_DEV      Development webhook URL (for dev environment)"
        echo ""
        echo "Prerequisites:"
        echo "  - curl installed"
        echo "  - jq installed"
        echo "  - Valid Stripe secret key"
        exit 0
        ;;
    --list)
        check_prerequisites
        get_stripe_secret_key
        list_webhooks
        exit 0
        ;;
    --test)
        if [ -z "$2" ]; then
            print_error "Please provide a webhook URL to test."
            exit 1
        fi
        check_prerequisites
        test_webhook "$2" "test"
        exit 0
        ;;
    production|development)
        main "$1"
        ;;
    *)
        print_error "Invalid argument. Use --help for usage information."
        exit 1
        ;;
esac
