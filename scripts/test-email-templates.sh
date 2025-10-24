#!/bin/bash

# ================================================================================
#                    MINBERAI EMAIL TEMPLATE TEST SCRIPT
# ================================================================================
# This script helps test the email templates by opening them in a browser
# ================================================================================

echo "🧪 MinbarAI Email Template Test Suite"
echo "====================================="
echo ""

# Check if we're in the right directory
if [ ! -f "public/email-templates/confirmation-email.html" ]; then
    echo "❌ Email templates not found!"
    echo "Please run the configuration script first:"
    echo "  ./scripts/configure-email-templates.sh"
    echo ""
    exit 1
fi

echo "✅ Email templates found"
echo ""

# Function to test email template
test_template() {
    local template_name=$1
    local template_file=$2
    
    echo "📧 Testing: $template_name"
    echo "   File: $template_file"
    
    if [ -f "$template_file" ]; then
        echo "   ✅ Template exists"
        
        # Check if template has required elements
        if grep -q "MinbarAI" "$template_file"; then
            echo "   ✅ Contains MinbarAI branding"
        else
            echo "   ❌ Missing MinbarAI branding"
        fi
        
        if grep -q "logo-icon" "$template_file"; then
            echo "   ✅ Contains logo"
        else
            echo "   ❌ Missing logo"
        fi
        
        if grep -q "cta-button" "$template_file"; then
            echo "   ✅ Contains CTA button"
        else
            echo "   ❌ Missing CTA button"
        fi
        
        if grep -q "security-notice" "$template_file"; then
            echo "   ✅ Contains security notice"
        else
            echo "   ❌ Missing security notice"
        fi
        
        # Check for responsive design
        if grep -q "@media" "$template_file"; then
            echo "   ✅ Responsive design included"
        else
            echo "   ❌ Missing responsive design"
        fi
        
        # Check for dark mode support
        if grep -q "prefers-color-scheme: dark" "$template_file"; then
            echo "   ✅ Dark mode support included"
        else
            echo "   ❌ Missing dark mode support"
        fi
        
    else
        echo "   ❌ Template file not found"
    fi
    
    echo ""
}

# Test all templates
echo "🔍 Testing Email Templates"
echo "=========================="
echo ""

test_template "Account Confirmation" "public/email-templates/confirmation-email.html"
test_template "Magic Link Sign-In" "public/email-templates/magic-link-email.html"
test_template "Password Recovery" "public/email-templates/recovery-email.html"
test_template "Email Change" "public/email-templates/email-change-email.html"

echo "🌐 Browser Testing"
echo "=================="
echo ""

# Check if we can open templates in browser
if command -v xdg-open &> /dev/null; then
    echo "Opening templates in browser for visual testing..."
    echo ""
    
    echo "📧 Opening confirmation email template..."
    xdg-open "public/email-templates/confirmation-email.html" 2>/dev/null &
    
    sleep 2
    
    echo "📧 Opening magic link email template..."
    xdg-open "public/email-templates/magic-link-email.html" 2>/dev/null &
    
    sleep 2
    
    echo "📧 Opening recovery email template..."
    xdg-open "public/email-templates/recovery-email.html" 2>/dev/null &
    
    sleep 2
    
    echo "📧 Opening email change template..."
    xdg-open "public/email-templates/email-change-email.html" 2>/dev/null &
    
elif command -v open &> /dev/null; then
    echo "Opening templates in browser for visual testing..."
    echo ""
    
    echo "📧 Opening confirmation email template..."
    open "public/email-templates/confirmation-email.html" 2>/dev/null &
    
    sleep 2
    
    echo "📧 Opening magic link email template..."
    open "public/email-templates/magic-link-email.html" 2>/dev/null &
    
    sleep 2
    
    echo "📧 Opening recovery email template..."
    open "public/email-templates/recovery-email.html" 2>/dev/null &
    
    sleep 2
    
    echo "📧 Opening email change template..."
    open "public/email-templates/email-change-email.html" 2>/dev/null &
    
else
    echo "⚠️  Cannot open templates in browser automatically"
    echo "   Please manually open the HTML files in your browser:"
    echo "   - public/email-templates/confirmation-email.html"
    echo "   - public/email-templates/magic-link-email.html"
    echo "   - public/email-templates/recovery-email.html"
    echo "   - public/email-templates/email-change-email.html"
fi

echo ""
echo "📋 Manual Testing Checklist"
echo "=========================="
echo ""
echo "When viewing templates in browser, check for:"
echo ""
echo "✅ Visual Elements:"
echo "   - MinbarAI logo displays correctly"
echo "   - Brand colors (#55a39a) are applied"
echo "   - Gradient backgrounds render properly"
echo "   - Typography matches website style"
echo ""
echo "✅ Layout & Responsiveness:"
echo "   - Template looks good on desktop"
echo "   - Mobile view is properly formatted"
echo "   - Text is readable and well-spaced"
echo "   - CTA buttons are prominent"
echo ""
echo "✅ Content:"
echo "   - All text is clear and professional"
echo "   - Security notices are visible"
echo "   - Contact information is present"
echo "   - No placeholder text remains"
echo ""
echo "✅ Technical:"
echo "   - No broken images or links"
echo "   - CSS styles are applied correctly"
echo "   - Dark mode toggle works (if supported)"
echo "   - Template loads quickly"
echo ""

echo "🔧 Next Steps"
echo "============="
echo ""
echo "1. Review templates in browser"
echo "2. Make any necessary adjustments"
echo "3. Configure templates in Supabase Dashboard:"
echo "   https://supabase.com/dashboard/project/hjsifxofnqbnrgqkbomx"
echo "4. Test with real email addresses"
echo "5. Monitor email delivery and user feedback"
echo ""

echo "🎉 Email template testing complete!"
echo ""
echo "For detailed setup instructions, see: EMAIL_TEMPLATE_SETUP.md"
