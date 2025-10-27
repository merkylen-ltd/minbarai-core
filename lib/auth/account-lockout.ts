import { NextRequest } from 'next/server'

// Account lockout store - in production, use Redis or database
const accountLockoutStore = new Map<string, {
  attempts: number
  lockoutUntil: number
  lastAttempt: number
}>()

export interface AccountLockoutConfig {
  maxAttempts: number // Maximum failed attempts before lockout
  lockoutDurationMs: number // How long to lock the account
  windowMs: number // Time window for counting attempts
}

export interface AccountLockoutResult {
  isLocked: boolean
  remainingAttempts: number
  lockoutUntil?: number
  retryAfter?: number
}

/**
 * Check if account is locked due to failed attempts
 * @param email - User email address
 * @param config - Lockout configuration
 * @returns AccountLockoutResult with lock status
 */
export function checkAccountLockout(
  email: string,
  config: AccountLockoutConfig
): AccountLockoutResult {
  const now = Date.now()
  const key = `lockout:${email.toLowerCase()}`
  
  const record = accountLockoutStore.get(key)
  
  // No record means no lockout
  if (!record) {
    return {
      isLocked: false,
      remainingAttempts: config.maxAttempts
    }
  }
  
  // Check if lockout period has expired
  if (now > record.lockoutUntil) {
    // Clear expired lockout
    accountLockoutStore.delete(key)
    return {
      isLocked: false,
      remainingAttempts: config.maxAttempts
    }
  }
  
  // Check if attempts window has expired
  if (now > record.lastAttempt + config.windowMs) {
    // Reset attempts counter
    accountLockoutStore.delete(key)
    return {
      isLocked: false,
      remainingAttempts: config.maxAttempts
    }
  }
  
  // Account is locked
  return {
    isLocked: true,
    remainingAttempts: 0,
    lockoutUntil: record.lockoutUntil,
    retryAfter: Math.ceil((record.lockoutUntil - now) / 1000)
  }
}

/**
 * Record a failed login attempt
 * @param email - User email address
 * @param config - Lockout configuration
 * @returns AccountLockoutResult after recording attempt
 */
export function recordFailedAttempt(
  email: string,
  config: AccountLockoutConfig
): AccountLockoutResult {
  const now = Date.now()
  const key = `lockout:${email.toLowerCase()}`
  
  const record = accountLockoutStore.get(key)
  
  if (!record) {
    // First failed attempt
    const newRecord = {
      attempts: 1,
      lockoutUntil: 0,
      lastAttempt: now
    }
    
    // Check if this triggers lockout
    if (newRecord.attempts >= config.maxAttempts) {
      newRecord.lockoutUntil = now + config.lockoutDurationMs
    }
    
    accountLockoutStore.set(key, newRecord)
    
    return {
      isLocked: newRecord.attempts >= config.maxAttempts,
      remainingAttempts: config.maxAttempts - newRecord.attempts,
      lockoutUntil: newRecord.lockoutUntil > 0 ? newRecord.lockoutUntil : undefined,
      retryAfter: newRecord.lockoutUntil > 0 ? Math.ceil(config.lockoutDurationMs / 1000) : undefined
    }
  }
  
  // Check if lockout period has expired
  if (now > record.lockoutUntil) {
    // Reset and record new attempt
    const newRecord = {
      attempts: 1,
      lockoutUntil: 0,
      lastAttempt: now
    }
    
    if (newRecord.attempts >= config.maxAttempts) {
      newRecord.lockoutUntil = now + config.lockoutDurationMs
    }
    
    accountLockoutStore.set(key, newRecord)
    
    return {
      isLocked: newRecord.attempts >= config.maxAttempts,
      remainingAttempts: config.maxAttempts - newRecord.attempts,
      lockoutUntil: newRecord.lockoutUntil > 0 ? newRecord.lockoutUntil : undefined,
      retryAfter: newRecord.lockoutUntil > 0 ? Math.ceil(config.lockoutDurationMs / 1000) : undefined
    }
  }
  
  // Check if attempts window has expired
  if (now > record.lastAttempt + config.windowMs) {
    // Reset attempts counter
    const newRecord = {
      attempts: 1,
      lockoutUntil: 0,
      lastAttempt: now
    }
    
    if (newRecord.attempts >= config.maxAttempts) {
      newRecord.lockoutUntil = now + config.lockoutDurationMs
    }
    
    accountLockoutStore.set(key, newRecord)
    
    return {
      isLocked: newRecord.attempts >= config.maxAttempts,
      remainingAttempts: config.maxAttempts - newRecord.attempts,
      lockoutUntil: newRecord.lockoutUntil > 0 ? newRecord.lockoutUntil : undefined,
      retryAfter: newRecord.lockoutUntil > 0 ? Math.ceil(config.lockoutDurationMs / 1000) : undefined
    }
  }
  
  // Increment attempts
  record.attempts++
  record.lastAttempt = now
  
  // Check if this triggers lockout
  if (record.attempts >= config.maxAttempts) {
    record.lockoutUntil = now + config.lockoutDurationMs
  }
  
  accountLockoutStore.set(key, record)
  
  return {
    isLocked: record.attempts >= config.maxAttempts,
    remainingAttempts: Math.max(0, config.maxAttempts - record.attempts),
    lockoutUntil: record.lockoutUntil > 0 ? record.lockoutUntil : undefined,
    retryAfter: record.lockoutUntil > 0 ? Math.ceil((record.lockoutUntil - now) / 1000) : undefined
  }
}

/**
 * Clear failed attempts for an account (e.g., after successful login)
 * @param email - User email address
 */
export function clearFailedAttempts(email: string): void {
  const key = `lockout:${email.toLowerCase()}`
  accountLockoutStore.delete(key)
}

/**
 * Clear all lockout records (useful for testing)
 */
export function clearAllLockouts(): void {
  accountLockoutStore.clear()
}

/**
 * Get lockout statistics for monitoring
 */
export function getLockoutStats(): {
  totalLockedAccounts: number
  activeLockouts: number
  expiredLockouts: number
} {
  const now = Date.now()
  let activeLockouts = 0
  let expiredLockouts = 0
  
  for (const entry of Array.from(accountLockoutStore.entries())) {
    const [key, record] = entry
    if (now > record.lockoutUntil) {
      expiredLockouts++
    } else {
      activeLockouts++
    }
  }
  
  return {
    totalLockedAccounts: accountLockoutStore.size,
    activeLockouts,
    expiredLockouts
  }
}

// Predefined lockout configurations
export const ACCOUNT_LOCKOUT_CONFIGS = {
  // Standard account lockout
  STANDARD: {
    maxAttempts: 5, // 5 failed attempts
    lockoutDurationMs: 15 * 60 * 1000, // 15 minutes lockout
    windowMs: 15 * 60 * 1000, // 15 minutes window
  },
  
  // Stricter lockout for suspicious activity
  STRICT: {
    maxAttempts: 3, // 3 failed attempts
    lockoutDurationMs: 60 * 60 * 1000, // 1 hour lockout
    windowMs: 10 * 60 * 1000, // 10 minutes window
  },
  
  // Very strict lockout for high-risk scenarios
  VERY_STRICT: {
    maxAttempts: 3, // 3 failed attempts
    lockoutDurationMs: 24 * 60 * 60 * 1000, // 24 hours lockout
    windowMs: 5 * 60 * 1000, // 5 minutes window
  }
} as const
