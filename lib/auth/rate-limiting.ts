import { NextRequest } from 'next/server'

// Simple in-memory rate limiting store
// In production, this should be replaced with Redis or similar
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

export interface RateLimitConfig {
  windowMs: number // Time window in milliseconds
  maxAttempts: number // Maximum attempts per window
  keyGenerator?: (request: NextRequest) => string // Custom key generator
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetTime: number
  retryAfter?: number
}

/**
 * Check if request is within rate limit
 * @param request - NextRequest object
 * @param config - Rate limiting configuration
 * @returns RateLimitResult with allowance status and metadata
 */
export function checkRateLimit(
  request: NextRequest,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now()
  const key = config.keyGenerator ? config.keyGenerator(request) : getDefaultKey(request)
  
  const record = rateLimitStore.get(key)
  
  // If no record exists or window has expired, create new record
  if (!record || now > record.resetTime) {
    const newRecord = {
      count: 1,
      resetTime: now + config.windowMs
    }
    rateLimitStore.set(key, newRecord)
    
    return {
      allowed: true,
      remaining: config.maxAttempts - 1,
      resetTime: newRecord.resetTime
    }
  }
  
  // Check if limit exceeded
  if (record.count >= config.maxAttempts) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: record.resetTime,
      retryAfter: Math.ceil((record.resetTime - now) / 1000)
    }
  }
  
  // Increment counter
  record.count++
  rateLimitStore.set(key, record)
  
  return {
    allowed: true,
    remaining: config.maxAttempts - record.count,
    resetTime: record.resetTime
  }
}

/**
 * Get default rate limit key based on IP address
 * @param request - NextRequest object
 * @returns Rate limit key string
 */
function getDefaultKey(request: NextRequest): string {
  // Try to get real IP from various headers
  const forwardedFor = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')
  const cfConnectingIp = request.headers.get('cf-connecting-ip')
  
  let ip = 'unknown'
  
  if (forwardedFor) {
    // x-forwarded-for can contain multiple IPs, take the first one
    ip = forwardedFor.split(',')[0].trim()
  } else if (realIp) {
    ip = realIp
  } else if (cfConnectingIp) {
    ip = cfConnectingIp
  } else {
    // Fallback to connection remote address
    ip = request.ip || 'unknown'
  }
  
  return `rate_limit:${ip}`
}

/**
 * Get rate limit key for specific user (for account-level rate limiting)
 * @param userId - User ID
 * @returns Rate limit key string
 */
export function getUserRateLimitKey(userId: string): string {
  return `rate_limit:user:${userId}`
}

/**
 * Clear rate limit for a specific key
 * @param key - Rate limit key to clear
 */
export function clearRateLimit(key: string): void {
  rateLimitStore.delete(key)
}

/**
 * Clear all rate limits (useful for testing)
 */
export function clearAllRateLimits(): void {
  rateLimitStore.clear()
}

/**
 * Get rate limit statistics for monitoring
 */
export function getRateLimitStats(): {
  totalKeys: number
  activeKeys: number
  expiredKeys: number
} {
  const now = Date.now()
  let activeKeys = 0
  let expiredKeys = 0
  
  for (const entry of Array.from(rateLimitStore.entries())) {
    const [key, record] = entry
    if (now > record.resetTime) {
      expiredKeys++
    } else {
      activeKeys++
    }
  }
  
  return {
    totalKeys: rateLimitStore.size,
    activeKeys,
    expiredKeys
  }
}

// Predefined rate limit configurations
export const RATE_LIMIT_CONFIGS = {
  // Authentication endpoints - stricter limits
  AUTH: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxAttempts: 5, // 5 attempts per 15 minutes
  },
  
  // Password reset - very strict
  PASSWORD_RESET: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxAttempts: 3, // 3 attempts per hour
  },
  
  // General API endpoints
  API: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxAttempts: 100, // 100 requests per 15 minutes
  },
  
  // OAuth callback - moderate limits
  OAUTH_CALLBACK: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxAttempts: 10, // 10 attempts per 15 minutes
  }
} as const
