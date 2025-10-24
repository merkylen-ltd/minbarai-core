# Pricing Configuration Guide

## Overview

MinbarAI now uses a centralized pricing configuration system that allows you to manage all pricing information from a single file. This makes it easy to update prices across the entire application without having to modify multiple files.

## Configuration File

The main pricing configuration is located in `lib/pricing.ts`. This file contains:

- **Pricing Plans**: All subscription plans with their features, limits, and pricing
- **Currency Settings**: Default currency and symbol
- **Helper Functions**: Utilities for price formatting and calculations
- **Type Definitions**: TypeScript interfaces for type safety

## Key Features

### 1. Centralized Configuration
All pricing information is stored in one place, making updates simple and consistent.

### 2. Type Safety
Full TypeScript support with interfaces for all pricing data structures.

### 3. Helper Functions
Built-in utilities for:
- Price formatting with currency symbols
- Discount percentage calculations
- Plan lookup by ID
- Filtering available plans

### 4. Environment Integration
Seamless integration with environment variables for Stripe configuration.

## How to Update Prices

### Step 1: Edit the Configuration File

Open `lib/pricing.ts` and modify the `PRICING_CONFIG` object:

```typescript
export const PRICING_CONFIG: PricingConfig = {
  currency: 'EUR',
  currencySymbol: '€',
  defaultPriceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID || 'price_placeholder_50_euro_monthly',
  plans: [
    {
      id: 'professional',
      name: 'Professional Beta',
      description: 'Early access to professional features',
      price: 50, // ← Change this price
      originalPrice: 120, // ← Change this original price
      interval: 'month',
      // ... rest of the plan configuration
    }
  ]
}
```

### Step 2: Update Stripe Configuration (Optional)

If you have specific Stripe price IDs for each plan, you can add them to the plan configuration:

```typescript
{
  id: 'professional',
  name: 'Professional Beta',
  price: 50,
  stripePriceId: 'price_1234567890', // ← Add your Stripe price ID
  // ... rest of configuration
}
```

### Step 3: Test the Changes

After updating the configuration:

1. Restart your development server
2. Navigate to the subscribe page
3. Verify that the new prices are displayed correctly
4. Test the checkout process

## Configuration Structure

### PricingPlan Interface

```typescript
interface PricingPlan {
  id: string                    // Unique identifier
  name: string                  // Display name
  description: string           // Plan description
  price: number | null          // Current price (null for coming soon)
  originalPrice?: number        // Original price for discount display
  interval: 'month' | 'year'   // Billing interval
  features: string[]            // List of features
  limits: {                    // Usage limits
    minutes: number
    languages: number
    sessions: number
  }
  isPopular?: boolean          // Mark as popular plan
  isComingSoon?: boolean       // Mark as coming soon
  stripePriceId?: string      // Optional Stripe price ID
}
```

### PricingConfig Interface

```typescript
interface PricingConfig {
  currency: string              // Currency code (e.g., 'EUR')
  currencySymbol: string       // Currency symbol (e.g., '€')
  plans: PricingPlan[]         // Array of pricing plans
  defaultPriceId: string      // Default Stripe price ID
}
```

## Helper Functions

### Available Functions

- `getPlanById(planId: string)`: Get a specific plan by ID
- `getPopularPlan()`: Get the plan marked as popular
- `getAvailablePlans()`: Get all plans that are not "coming soon"
- `formatPrice(price: number)`: Format price with currency symbol
- `calculateDiscountPercentage(originalPrice: number, currentPrice: number)`: Calculate discount percentage
- `getEffectivePricingConfig()`: Get configuration with environment overrides

### Usage Examples

```typescript
import { 
  getPlanById, 
  formatPrice, 
  calculateDiscountPercentage 
} from '@/lib/pricing'

// Get a specific plan
const professionalPlan = getPlanById('professional')

// Format a price
const formattedPrice = formatPrice(50) // Returns "€99"

// Calculate discount
const discount = calculateDiscountPercentage(120, 50) // Returns 58
```

## Environment Variables

The pricing configuration integrates with these environment variables:

- `NEXT_PUBLIC_STRIPE_PRICE_ID`: Default Stripe price ID
- `STRIPE_SECRET_KEY`: Stripe secret key for API operations

## Files Updated

The following files have been updated to use the centralized pricing configuration:

1. **`lib/pricing.ts`** - New pricing configuration file
2. **`app/subscribe/page.tsx`** - Subscribe page now uses pricing config
3. **`lib/stripe/config.ts`** - Stripe configuration uses pricing config
4. **`app/api/stripe/checkout/route.ts`** - Checkout route validates against pricing config

## Benefits

1. **Single Source of Truth**: All pricing information in one place
2. **Easy Updates**: Change prices without touching multiple files
3. **Type Safety**: Full TypeScript support prevents errors
4. **Consistency**: Ensures pricing is consistent across the application
5. **Maintainability**: Easier to maintain and update pricing logic
6. **Flexibility**: Easy to add new plans or modify existing ones

## Migration Notes

If you're updating from the old hardcoded pricing system:

1. All hardcoded prices have been moved to `lib/pricing.ts`
2. The subscribe page now imports pricing data from the configuration
3. Stripe integration automatically uses the centralized pricing
4. No breaking changes to the user interface

## Troubleshooting

### Common Issues

1. **Prices not updating**: Make sure to restart your development server after changing the configuration
2. **TypeScript errors**: Ensure all required fields are provided in the pricing configuration
3. **Stripe errors**: Verify that your Stripe price IDs are correct and active

### Getting Help

If you encounter issues with the pricing configuration:

1. Check the browser console for any errors
2. Verify that the pricing configuration file is properly formatted
3. Ensure all required environment variables are set
4. Test with a simple price change first to isolate the issue

## Future Enhancements

Potential future improvements to the pricing system:

1. **Dynamic Pricing**: Load pricing from an API or database
2. **A/B Testing**: Support for different pricing tiers
3. **Regional Pricing**: Different prices for different regions
4. **Promotional Pricing**: Temporary price reductions
5. **Plan Comparison**: Built-in plan comparison features
