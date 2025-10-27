/**
 * Email validation and sanitization utilities
 */

/**
 * Sanitize email input to prevent injection attacks
 * @param email - Raw email input
 * @returns Sanitized email
 */
export function sanitizeEmail(email: string): string {
  if (!email) {
    return ''
  }
  
  // Remove null bytes and control characters
  let sanitized = email.replace(/[\x00-\x1F\x7F]/g, '')
  
  // Trim whitespace
  sanitized = sanitized.trim()
  
  // Convert to lowercase for consistency
  sanitized = sanitized.toLowerCase()
  
  // Remove any HTML tags (basic protection)
  sanitized = sanitized.replace(/<[^>]*>/g, '')
  
  // Limit length to prevent buffer overflow attacks
  if (sanitized.length > 254) {
    sanitized = sanitized.substring(0, 254)
  }
  
  return sanitized
}

/**
 * Validate email format with stricter rules
 * @param email - Email to validate
 * @returns Validation result
 */
export function validateEmailStrict(email: string): { isValid: boolean; errors: string[] } {
  const errors: string[] = []
  
  if (!email) {
    errors.push('Email is required')
    return { isValid: false, errors }
  }
  
  // Sanitize first
  const sanitized = sanitizeEmail(email)
  
  if (sanitized !== email) {
    errors.push('Email contains invalid characters')
  }
  
  // Basic length check
  if (sanitized.length < 5 || sanitized.length > 254) {
    errors.push('Email must be between 5 and 254 characters')
  }
  
  // Check for basic email format
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/
  
  if (!emailRegex.test(sanitized)) {
    errors.push('Please enter a valid email address')
  }
  
  // Check for dangerous patterns
  const dangerousPatterns = [
    /javascript:/i,
    /data:/i,
    /vbscript:/i,
    /onload/i,
    /onerror/i,
    /<script/i,
    /<iframe/i,
    /<object/i,
    /<embed/i
  ]
  
  for (const pattern of dangerousPatterns) {
    if (pattern.test(sanitized)) {
      errors.push('Email contains potentially dangerous content')
      break
    }
  }
  
  // Check for consecutive dots
  if (sanitized.includes('..')) {
    errors.push('Email cannot contain consecutive dots')
  }
  
  // Check for dots at start/end of local part
  const [localPart] = sanitized.split('@')
  if (localPart && (localPart.startsWith('.') || localPart.endsWith('.'))) {
    errors.push('Email local part cannot start or end with a dot')
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

/**
 * Normalize email for consistent storage/comparison
 * @param email - Email to normalize
 * @returns Normalized email
 */
export function normalizeEmail(email: string): string {
  const sanitized = sanitizeEmail(email)
  
  // Remove dots from Gmail addresses (Gmail quirk)
  const [localPart, domain] = sanitized.split('@')
  if (domain === 'gmail.com' && localPart) {
    const normalizedLocal = localPart.replace(/\./g, '')
    return `${normalizedLocal}@${domain}`
  }
  
  return sanitized
}

/**
 * Check if email is from a disposable email service
 * @param email - Email to check
 * @returns True if disposable email
 */
export function isDisposableEmail(email: string): boolean {
  const disposableDomains = [
    '10minutemail.com',
    'tempmail.org',
    'guerrillamail.com',
    'mailinator.com',
    'temp-mail.org',
    'throwaway.email',
    'getnada.com',
    'maildrop.cc',
    'yopmail.com',
    'sharklasers.com'
  ]
  
  const domain = email.split('@')[1]?.toLowerCase()
  return domain ? disposableDomains.includes(domain) : false
}

/**
 * Get email domain for validation
 * @param email - Email address
 * @returns Domain part of email
 */
export function getEmailDomain(email: string): string | null {
  const parts = email.split('@')
  return parts.length === 2 ? parts[1].toLowerCase() : null
}
