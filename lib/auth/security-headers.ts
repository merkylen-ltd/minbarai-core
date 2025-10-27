import { NextRequest, NextResponse } from 'next/server'

/**
 * Security headers configuration
 */
export const SECURITY_HEADERS = {
  // Content Security Policy - prevents XSS attacks
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.google.com https://www.gstatic.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https: blob:",
    "connect-src 'self' https://*.supabase.co https://*.supabase.com wss://*.supabase.co wss://*.supabase.com https://voiceflow-relay-e5l6mfznxq-ew.a.run.app",
    "frame-src 'self' https://js.stripe.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests"
  ].join('; '),

  // HTTP Strict Transport Security - forces HTTPS
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',

  // X-Frame-Options - prevents clickjacking
  'X-Frame-Options': 'DENY',

  // X-Content-Type-Options - prevents MIME sniffing
  'X-Content-Type-Options': 'nosniff',

  // Referrer-Policy - controls referrer information
  'Referrer-Policy': 'strict-origin-when-cross-origin',

  // Permissions-Policy - controls browser features
  'Permissions-Policy': [
    'camera=()',
    'microphone=(self)',
    'geolocation=()',
    'interest-cohort=()',
    'payment=()',
    'usb=()',
    'magnetometer=()',
    'gyroscope=()',
    'accelerometer=()'
  ].join(', '),

  // X-XSS-Protection - legacy XSS protection (for older browsers)
  'X-XSS-Protection': '1; mode=block',

  // Cross-Origin-Embedder-Policy - prevents embedding in cross-origin contexts
  'Cross-Origin-Embedder-Policy': 'require-corp',

  // Cross-Origin-Opener-Policy - prevents cross-origin window access
  'Cross-Origin-Opener-Policy': 'same-origin',

  // Cross-Origin-Resource-Policy - controls cross-origin resource access
  'Cross-Origin-Resource-Policy': 'same-origin'
} as const

/**
 * Add security headers to response
 * @param response - NextResponse object
 * @returns Response with security headers added
 */
export function addSecurityHeaders(response: NextResponse): NextResponse {
  // Add all security headers
  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value)
  })

  return response
}

/**
 * Security headers middleware for Next.js
 * @param request - NextRequest object
 * @param response - NextResponse object
 * @returns Response with security headers
 */
export function securityHeadersMiddleware(
  request: NextRequest,
  response: NextResponse
): NextResponse {
  return addSecurityHeaders(response)
}

/**
 * Get CSP nonce for inline scripts (if needed)
 * @param request - NextRequest object
 * @returns CSP nonce string
 */
export function getCSPNonce(request: NextRequest): string {
  // Generate a random nonce for this request
  const nonce = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString('base64')
  return nonce
}

/**
 * Create CSP header with nonce for inline scripts
 * @param nonce - CSP nonce
 * @returns CSP header value
 */
export function createCSPWithNonce(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'unsafe-inline' 'unsafe-eval' https://www.google.com https://www.gstatic.com`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https: blob:",
    "connect-src 'self' https://*.supabase.co https://*.supabase.com wss://*.supabase.co wss://*.supabase.com https://voiceflow-relay-e5l6mfznxq-ew.a.run.app",
    "frame-src 'self' https://js.stripe.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests"
  ].join('; ')
}
