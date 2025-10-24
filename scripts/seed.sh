#!/bin/bash

# MinbarAI Database Seed Script
# Easy-to-use shell script for seeding the database

set -e  # Exit on any error

echo "🌱 MinbarAI Database Seed Script"
echo "================================"

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
    echo "❌ Error: .env.local file not found!"
    echo "   Please copy env.example to .env.local and configure your environment variables."
    echo "   Required variables:"
    echo "   - NEXT_PUBLIC_SUPABASE_URL"
    echo "   - SUPABASE_SERVICE_ROLE_KEY"
    exit 1
fi

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js is not installed or not in PATH"
    exit 1
fi

# Check if npm is available
if ! command -v npm &> /dev/null; then
    echo "❌ Error: npm is not installed or not in PATH"
    exit 1
fi

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Parse command line arguments
case "${1:-help}" in
    "help"|"-h"|"--help")
        echo "Usage: $0 <command> [email] [password]"
        echo ""
        echo "Commands:"
        echo "  <email> [password]  Create a new user with email (password optional)"
        echo "  cleanup <email>     Remove user data from database"
        echo "  list                List all seeded users"
        echo "  help                Show this help message"
        echo ""
        echo "Examples:"
        echo "  $0 test@example.com                    # Create user with auto-generated password"
        echo "  $0 test@example.com MyPassword123     # Create user with specific password"
        echo "  $0 cleanup test@example.com           # Remove user data"
        echo "  $0 list                               # List all users"
        echo "  $0 help                               # Show help"
        ;;
    "cleanup")
        if [ -z "$2" ]; then
            echo "❌ Error: Missing email for cleanup"
            echo "Usage: $0 cleanup <email>"
            exit 1
        fi
        echo "🧹 Cleaning up user: $2..."
        node scripts/seed-database.js cleanup "$2"
        ;;
    "list")
        echo "📋 Listing all seeded users..."
        node scripts/seed-database.js list
        ;;
    *)
        # Create user command
        if [ -z "$1" ]; then
            echo "❌ Error: Missing email"
            echo "Usage: $0 <email> [password]"
            exit 1
        fi
        
        email="$1"
        password="$2"
        
        # Validate email format
        if [[ ! "$email" =~ ^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$ ]]; then
            echo "❌ Error: Invalid email format"
            exit 1
        fi
        
        if [ -n "$password" ]; then
            echo "🚀 Creating user: $email with provided password..."
            node scripts/seed-database.js "$email" "$password"
        else
            echo "🚀 Creating user: $email with auto-generated password..."
            node scripts/seed-database.js "$email"
        fi
        ;;
esac

echo ""
echo "✅ Script completed successfully!"