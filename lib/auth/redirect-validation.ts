import { NextRequest } from 'next/server'

/**
 * Strict redirect URL validation to prevent open redirect attacks
 * @param url - URL to validate
 * @param allowedPaths - Array of allowed path prefixes
 * @param origin - Origin URL for validation
 * @returns Validated redirect URL or null if invalid
 */
export function validateRedirectUrl(
  url: string | null,
  allowedPaths: string[],
  origin: string
): string | null {
  if (!url) {
    return null
  }

  try {
    // Parse the URL
    const parsedUrl = new URL(url, origin)
    
    // Must be same origin
    if (parsedUrl.origin !== origin) {
      return null
    }
    
    // Must be HTTP or HTTPS
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return null
    }
    
    // Check for dangerous protocols
    const dangerousProtocols = ['javascript:', 'data:', 'file:', 'vbscript:', 'about:']
    if (dangerousProtocols.some(protocol => url.toLowerCase().startsWith(protocol))) {
      return null
    }
    
    // Check for encoded protocols
    const encodedDangerous = ['%6A%61%76%61%73%63%72%69%70%74', '%64%61%74%61', '%66%69%6C%65']
    if (encodedDangerous.some(encoded => url.toLowerCase().includes(encoded))) {
      return null
    }
    
    // Normalize the pathname
    const pathname = parsedUrl.pathname
    
    // Check for path traversal attempts
    if (pathname.includes('..') || pathname.includes('//')) {
      return null
    }
    
    // Check against allowed paths
    const isAllowed = allowedPaths.some(allowedPath => {
      // Exact match
      if (pathname === allowedPath) {
        return true
      }
      
      // Starts with allowed path followed by /
      if (pathname.startsWith(allowedPath + '/')) {
        return true
      }
      
      return false
    })
    
    if (!isAllowed) {
      return null
    }
    
    // Reconstruct safe URL
    return `${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`
    
  } catch (error) {
    // Invalid URL
    return null
  }
}

/**
 * Sanitize redirect URL by removing dangerous characters
 * @param url - URL to sanitize
 * @returns Sanitized URL
 */
export function sanitizeRedirectUrl(url: string): string {
  // Remove null bytes and control characters
  return url.replace(/[\x00-\x1F\x7F]/g, '')
}

/**
 * Get default redirect URL based on user state
 * @param hasValidSubscription - Whether user has valid subscription
 * @returns Default redirect URL
 */
export function getDefaultRedirectUrl(hasValidSubscription: boolean): string {
  if (hasValidSubscription) {
    return '/dashboard'
  } else {
    return '/subscribe'
  }
}

/**
 * Allowed redirect paths for authentication flows
 */
export const ALLOWED_REDIRECT_PATHS = [
  '/dashboard',
  '/subscribe',
  '/auth/signin',
  '/auth/signup',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/auth-code-error',
  '/',
  '/terms',
  '/privacy'
]

/**
 * Validate authentication redirect URL
 * @param url - URL to validate
 * @param origin - Origin URL
 * @returns Validated URL or default
 */
export function validateAuthRedirectUrl(url: string | null, origin: string): string {
  const validated = validateRedirectUrl(url, ALLOWED_REDIRECT_PATHS, origin)
  return validated || '/dashboard'
}
