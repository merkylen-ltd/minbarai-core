/**
 * Secure logging utility for authentication flows
 * Masks sensitive data in production while keeping debugging info in development
 */

const IS_PRODUCTION = process.env.NODE_ENV === 'production'

/**
 * Mask email address for logging
 * Example: john.doe@example.com -> j***e@e***.com
 */
function maskEmail(email: string | null | undefined): string {
  if (!email) return '[no email]'
  
  const [local, domain] = email.split('@')
  if (!local || !domain) return '[invalid email]'
  
  const maskedLocal = local.length > 2
    ? `${local[0]}***${local[local.length - 1]}`
    : '***'
  
  const domainParts = domain.split('.')
  const maskedDomain = domainParts.length > 1
    ? `${domainParts[0][0]}***.${domainParts[domainParts.length - 1]}`
    : '***'
  
  return `${maskedLocal}@${maskedDomain}`
}

/**
 * Mask user ID for logging (show first and last 4 chars)
 */
function maskId(id: string | null | undefined): string {
  if (!id) return '[no id]'
  if (id.length <= 8) return '***'
  return `${id.substring(0, 4)}...${id.substring(id.length - 4)}`
}

/**
 * Secure logger for authentication events
 */
export const authLogger = {
  /**
   * Log successful authentication
   */
  authSuccess(userId: string, email: string, method: 'password' | 'oauth' | 'email_confirmation') {
    if (IS_PRODUCTION) {
      console.log(`[AUTH_SUCCESS] method=${method} user=${maskId(userId)} email=${maskEmail(email)}`)
    } else {
      console.log(`[AUTH_SUCCESS] method=${method} user=${userId} email=${email}`)
    }
  },

  /**
   * Log failed authentication attempt
   */
  authFailure(email: string, reason: string, method: 'password' | 'oauth' | 'email_confirmation') {
    if (IS_PRODUCTION) {
      console.warn(`[AUTH_FAILURE] method=${method} email=${maskEmail(email)} reason=${reason}`)
    } else {
      console.warn(`[AUTH_FAILURE] method=${method} email=${email} reason=${reason}`)
    }
  },

  /**
   * Log rate limit exceeded
   */
  rateLimitExceeded(identifier: string, endpoint: string) {
    console.warn(`[RATE_LIMIT] endpoint=${endpoint} identifier=${IS_PRODUCTION ? maskId(identifier) : identifier}`)
  },

  /**
   * Log account lockout
   */
  accountLocked(email: string, until: Date) {
    console.warn(`[ACCOUNT_LOCKED] email=${maskEmail(email)} until=${until.toISOString()}`)
  },

  /**
   * Log security event (always log, even in production)
   */
  securityEvent(event: string, details: Record<string, any>) {
    const maskedDetails = IS_PRODUCTION 
      ? Object.entries(details).reduce((acc, [key, value]) => {
          if (key.includes('email')) acc[key] = maskEmail(String(value))
          else if (key.includes('id') || key.includes('user')) acc[key] = maskId(String(value))
          else acc[key] = value
          return acc
        }, {} as Record<string, any>)
      : details
    
    console.error(`[SECURITY_EVENT] event=${event}`, maskedDetails)
  },

  /**
   * Log callback/redirect flow
   */
  callbackFlow(action: string, email: string, step: string) {
    if (IS_PRODUCTION) {
      console.log(`[CALLBACK] action=${action} step=${step} email=${maskEmail(email)}`)
    } else {
      console.log(`[CALLBACK] action=${action} step=${step} email=${email}`)
    }
  },

  /**
   * Log error (sanitize stack traces in production)
   */
  error(context: string, error: unknown) {
    if (IS_PRODUCTION) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`[ERROR] context=${context} message=${message}`)
    } else {
      console.error(`[ERROR] context=${context}`, error)
    }
  },

  /**
   * Log info (development only)
   */
  info(message: string, data?: any) {
    if (!IS_PRODUCTION) {
      console.log(`[INFO] ${message}`, data || '')
    }
  },

  /**
   * Log warning
   */
  warn(message: string, data?: any) {
    console.warn(`[WARN] ${message}`, IS_PRODUCTION && data ? '(details hidden)' : data || '')
  }
}

/**
 * Export utility functions for direct use
 */
export { maskEmail, maskId }

