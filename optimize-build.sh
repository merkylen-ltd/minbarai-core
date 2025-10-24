#!/bin/bash

# 🚀 Build Optimization Script for MinberAI
# Optimizes Docker builds for ultra-slim runtime and maximum performance

set -e  # Exit on any error

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
    
    # Check if docker is installed
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install it first."
        exit 1
    fi
    
    # Check if docker is running
    if ! docker info &> /dev/null; then
        print_error "Docker is not running. Please start Docker first."
        exit 1
    fi
    
    print_success "Prerequisites met!"
}

# Clean up previous builds
cleanup_builds() {
    print_status "Cleaning up previous builds..."
    
    # Remove old images
    docker image prune -f
    
    # Remove old containers
    docker container prune -f
    
    # Remove old volumes
    docker volume prune -f
    
    print_success "Cleanup completed!"
}

# Build optimized image
build_optimized() {
    local dockerfile=${1:-"Dockerfile"}
    local tag=${2:-"minberai"}
    local build_args=${3:-""}
    
    print_status "Building optimized image with $dockerfile..."
    
    # Build with optimizations
    docker build \
        --file $dockerfile \
        --tag $tag \
        --build-arg BUILDKIT_INLINE_CACHE=1 \
        --build-arg NODE_ENV=production \
        --build-arg NEXT_TELEMETRY_DISABLED=1 \
        $build_args \
        .
    
    print_success "Image built successfully: $tag"
}

# Analyze image size
analyze_image() {
    local tag=$1
    
    print_status "Analyzing image size for $tag..."
    
    # Get image size
    local size=$(docker images --format "table {{.Size}}" $tag | tail -n 1)
    
    # Get image layers
    local layers=$(docker history $tag --format "table {{.Size}}\t{{.CreatedBy}}" | wc -l)
    
    echo ""
    echo "=================================================="
    echo "📊 Image Analysis: $tag"
    echo "=================================================="
    echo "Size: $size"
    echo "Layers: $layers"
    echo ""
    
    # Show layer breakdown
    print_status "Layer breakdown:"
    docker history $tag --format "table {{.Size}}\t{{.CreatedBy}}"
    echo ""
}

# Compare images
compare_images() {
    print_status "Comparing image sizes..."
    
    echo ""
    echo "=================================================="
    echo "📊 Image Size Comparison"
    echo "=================================================="
    docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}" | grep minberai
    echo ""
}

# Test image
test_image() {
    local tag=$1
    local port=${2:-3000}
    
    print_status "Testing image: $tag"
    
    # Start container in background
    local container_id=$(docker run -d -p $port:8080 $tag)
    
    # Wait for container to start
    sleep 5
    
    # Test health endpoint
    if curl -f http://localhost:$port/api/health &> /dev/null; then
        print_success "Health check passed for $tag"
    else
        print_error "Health check failed for $tag"
    fi
    
    # Stop and remove container
    docker stop $container_id &> /dev/null
    docker rm $container_id &> /dev/null
    
    print_success "Test completed for $tag"
}

# Main optimization function
main() {
    echo "🚀 MinberAI Build Optimization"
    echo "=================================================="
    echo ""
    
    check_prerequisites
    cleanup_builds
    
    # Build standard optimized image
    print_status "Building standard optimized image..."
    build_optimized "Dockerfile" "minberai:optimized"
    analyze_image "minberai:optimized"
    
    # Build ultra-minimal image
    print_status "Building ultra-minimal image..."
    build_optimized "Dockerfile.minimal" "minberai:minimal"
    analyze_image "minberai:minimal"
    
    # Compare images
    compare_images
    
    # Test both images
    test_image "minberai:optimized" 3000
    test_image "minberai:minimal" 3001
    
    echo ""
    echo "=================================================="
    echo "🎉 Build Optimization Complete!"
    echo "=================================================="
    echo ""
    echo "📋 Available Images:"
    echo "   - minberai:optimized (Distroless-based, secure)"
    echo "   - minberai:minimal (Scratch-based, ultra-small)"
    echo ""
    echo "🔍 Test Images:"
    echo "   docker run -p 3000:8080 minberai:optimized"
    echo "   docker run -p 3001:8080 minberai:minimal"
    echo ""
    echo "📊 Compare Sizes:"
    echo "   docker images | grep minberai"
    echo ""
    echo "⚠️  Note: Use minberai:optimized for production (better compatibility)"
    echo "   Use minberai:minimal for maximum size reduction (experimental)"
    echo "=================================================="
}

# Handle script arguments
case "${1:-}" in
    --help|-h)
        echo "MinberAI Build Optimization Script"
        echo ""
        echo "Usage: $0 [OPTIONS]"
        echo ""
        echo "Options:"
        echo "  --help, -h     Show this help message"
        echo "  --standard     Build only standard optimized image"
        echo "  --minimal      Build only ultra-minimal image"
        echo "  --compare      Compare existing images"
        echo "  --test TAG     Test specific image"
        echo "  --clean        Clean up all images"
        echo ""
        echo "This script will:"
        echo "  1. Clean up previous builds"
        echo "  2. Build optimized images"
        echo "  3. Analyze image sizes"
        echo "  4. Test functionality"
        echo "  5. Compare results"
        exit 0
        ;;
    --standard)
        check_prerequisites
        cleanup_builds
        build_optimized "Dockerfile" "minberai:optimized"
        analyze_image "minberai:optimized"
        test_image "minberai:optimized"
        exit 0
        ;;
    --minimal)
        check_prerequisites
        cleanup_builds
        build_optimized "Dockerfile.minimal" "minberai:minimal"
        analyze_image "minberai:minimal"
        test_image "minberai:minimal"
        exit 0
        ;;
    --compare)
        compare_images
        exit 0
        ;;
    --test)
        if [ -z "$2" ]; then
            print_error "Please provide image tag to test."
            exit 1
        fi
        test_image "$2"
        exit 0
        ;;
    --clean)
        print_warning "This will remove ALL MinberAI images!"
        read -p "Are you sure? Type 'DELETE' to confirm: " confirm
        if [ "$confirm" = "DELETE" ]; then
            docker rmi $(docker images --format "{{.Repository}}:{{.Tag}}" | grep minberai) 2>/dev/null || true
            print_success "All MinberAI images removed!"
        else
            print_status "Operation cancelled."
        fi
        exit 0
        ;;
    *)
        main
        ;;
esac
