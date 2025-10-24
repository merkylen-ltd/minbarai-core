import { ValidSubscriptionStatus } from '@/types'

/**
 * Valid subscription statuses that allow access to the dashboard and services
 * - 'active': Paid subscription is active
 * - 'incomplete': Payment processing (temporary status during checkout)
 * - 'canceled': Subscription cancelled but still within paid period
 */
const VALID_SUBSCRIPTION_STATUSES: ValidSubscriptionStatus[] = ['active', 'incomplete', 'canceled']

/**
 * Checks if a subscription status allows access to the dashboard and services
 * @param status - The subscription status to check
 * @returns true if the status allows access, false otherwise
 */
export function isValidSubscriptionStatus(status: string | null): status is ValidSubscriptionStatus {
  return status !== null && VALID_SUBSCRIPTION_STATUSES.includes(status as ValidSubscriptionStatus)
}

/**
 * Checks if a user is valid for translation services (includes new users with null status)
 * @param status - The subscription status to check
 * @returns true if the user can use translation services
 */
export function isValidForTranslation(status: string | null): boolean {
  // Allow null status for new users (they get default session limit)
  return status === null || VALID_SUBSCRIPTION_STATUSES.includes(status as ValidSubscriptionStatus)
}

/**
 * Gets a user-friendly message for subscription status
 * @param status - The subscription status
 * @returns A user-friendly message
 */
export function getSubscriptionStatusMessage(status: string | null): string {
  switch (status) {
    case 'active':
      return 'Your subscription is active'
    case 'incomplete':
      return 'Payment processing - your subscription will be active shortly'
    case 'canceled':
      return 'Your subscription has been canceled but you still have access until your current period ends'
    case 'past_due':
      return 'Your subscription payment is past due. Please update your payment method.'
    case 'unpaid':
      return 'Your subscription payment failed. Please update your payment method.'
    case null:
      return 'No active subscription found'
    default:
      return 'Unknown subscription status'
  }
}

/**
 * Checks if a subscription status requires immediate attention
 * @param status - The subscription status
 * @returns true if the status requires attention, false otherwise
 */
export function requiresSubscriptionAttention(status: string | null): boolean {
  return ['past_due', 'incomplete', 'unpaid'].includes(status || '')
}

/**
 * Checks if a cancelled subscription is still within the paid period
 * @param status - The subscription status
 * @param subscriptionPeriodEnd - The subscription period end timestamp
 * @returns true if cancelled subscription is still within paid period, false otherwise
 */
export function isCancelledSubscriptionActive(status: string | null, subscriptionPeriodEnd?: string | null): boolean {
  if (status !== 'canceled') {
    return false
  }
  
  // If subscription_period_end is null, it means the subscription was deleted (not just cancelled)
  // In this case, there's no paid period remaining, so access should be revoked immediately
  if (!subscriptionPeriodEnd) {
    return false
  }
  
  const now = new Date()
  const periodEndDate = new Date(subscriptionPeriodEnd)
  
  return now < periodEndDate
}

/**
 * Gets the remaining subscription time for cancelled subscriptions
 * @param subscriptionPeriodEnd - The subscription period end timestamp
 * @returns A human-readable string of remaining time
 */
export function getCancelledSubscriptionTimeRemaining(subscriptionPeriodEnd?: string | null): string {
  if (!subscriptionPeriodEnd) {
    return 'No subscription period set'
  }
  
  const now = new Date()
  const periodEndDate = new Date(subscriptionPeriodEnd)
  const diffMs = periodEndDate.getTime() - now.getTime()
  
  if (diffMs <= 0) {
    return 'Subscription period expired'
  }
  
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
  
  if (days > 0) {
    return `${days} day${days !== 1 ? 's' : ''} remaining`
  } else if (hours > 0) {
    return `${hours} hour${hours !== 1 ? 's' : ''} remaining`
  } else {
    return `${minutes} minute${minutes !== 1 ? 's' : ''} remaining`
  }
}

/**
 * Gets the formatted end date for cancelled subscriptions
 * @param subscriptionPeriodEnd - The subscription period end timestamp
 * @returns A formatted date string
 */
export function getCancelledSubscriptionEndDate(subscriptionPeriodEnd?: string | null): string {
  if (!subscriptionPeriodEnd) {
    return 'No end date set'
  }
  
  const endDate = new Date(subscriptionPeriodEnd)
  return endDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  })
}

/**
 * Gets the session limit for a user based on their subscription status
 * @param status - The subscription status
 * @param sessionLimitMinutes - The configured session limit
 * @returns The session limit in minutes
 */
export function getSessionLimit(status: string | null, sessionLimitMinutes?: number): number {
  if (status === 'active') {
    return sessionLimitMinutes || 180 // Default 3 hours for active users
  } else if (status === 'canceled') {
    return sessionLimitMinutes || 180 // Same as active users until period ends
  } else if (status === 'incomplete') {
    return 30 // Allow limited access during payment processing
  } else if (status === null || status === undefined) {
    // New users without subscription status get default session limit
    return sessionLimitMinutes || 180 // Default 3 hours for new users
  } else {
    return 0 // No sessions allowed for expired/invalid subscriptions
  }
}
