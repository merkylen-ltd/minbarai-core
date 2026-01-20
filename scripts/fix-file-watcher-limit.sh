#!/bin/bash

# Script to fix ENOSPC: System limit for number of file watchers reached
# This increases the inotify file watcher limit permanently

set -e

echo "🔧 Fixing file watcher limit (ENOSPC error)..."

# Check current limit
CURRENT_LIMIT=$(cat /proc/sys/fs/inotify/max_user_watches)
echo "Current limit: $CURRENT_LIMIT"

# Target limit (recommended: 524288)
TARGET_LIMIT=524288

if [ "$CURRENT_LIMIT" -lt "$TARGET_LIMIT" ]; then
    echo "📈 Increasing limit to $TARGET_LIMIT..."
    
    # Increase temporarily (requires sudo)
    sudo sysctl fs.inotify.max_user_watches=$TARGET_LIMIT
    
    # Make it permanent by adding to /etc/sysctl.conf
    if ! grep -q "fs.inotify.max_user_watches" /etc/sysctl.conf; then
        echo "💾 Making change permanent..."
        echo "" | sudo tee -a /etc/sysctl.conf
        echo "# Increase file watcher limit for development tools (Next.js, etc.)" | sudo tee -a /etc/sysctl.conf
        echo "fs.inotify.max_user_watches=$TARGET_LIMIT" | sudo tee -a /etc/sysctl.conf
        echo "✅ Added to /etc/sysctl.conf - will persist after reboot"
    else
        echo "⚠️  Entry already exists in /etc/sysctl.conf"
        echo "   Please manually update it to: fs.inotify.max_user_watches=$TARGET_LIMIT"
    fi
    
    # Verify the change
    NEW_LIMIT=$(cat /proc/sys/fs/inotify/max_user_watches)
    echo "✅ New limit: $NEW_LIMIT"
    echo ""
    echo "🎉 File watcher limit increased successfully!"
    echo "   You can now run 'npm run dev' without ENOSPC errors."
else
    echo "✅ Limit is already sufficient ($CURRENT_LIMIT >= $TARGET_LIMIT)"
fi
