import { NextResponse } from 'next/server'

/**
 * Standardized API error response format
 * Used across all API routes for consistent error handling
 */
export interface ApiErrorResponse {
  error: string
  message?: string
  details?: string | string[]
  code?: string
  retryAfter?: number
}

/**
 * Standard HTTP error status codes used in the application
 */
export type HttpErrorStatus = 400 | 401 | 403 | 404 | 409 | 423 | 429 | 500 | 503

/**
 * Create a standardized error response
 * 
 * @param error - Short error identifier
 * @param status - HTTP status code
 * @param options - Additional error details
 * @returns NextResponse with standardized error format
 */
export function createErrorResponse(
  error: string,
  status: HttpErrorStatus,
  options?: {
    message?: string
    details?: string | string[]
    code?: string
    retryAfter?: number
    headers?: Record<string, string>
  }
): NextResponse<ApiErrorResponse> {
  const body: ApiErrorResponse = { error }
  
  if (options?.message) {
    body.message = options.message
  }
  
  if (options?.details) {
    body.details = options.details
  }
  
  if (options?.code) {
    body.code = options.code
  }
  
  if (options?.retryAfter) {
    body.retryAfter = options.retryAfter
  }
  
  const responseOptions: ResponseInit = { status }
  
  if (options?.headers) {
    responseOptions.headers = options.headers
  }
  
  return NextResponse.json(body, responseOptions)
}

/**
 * Pre-defined error response creators for common scenarios
 */
export const ApiErrors = {
  /**
   * 400 Bad Request - Invalid input or request format
   */
  badRequest: (message: string, details?: string | string[]) => 
    createErrorResponse('Bad Request', 400, { message, details }),

  /**
   * 401 Unauthorized - Authentication required
   */
  unauthorized: (message = 'Authentication required') => 
    createErrorResponse('Unauthorized', 401, { message }),

  /**
   * 403 Forbidden - Insufficient permissions
   */
  forbidden: (message = 'Access denied') => 
    createErrorResponse('Forbidden', 403, { message }),

  /**
   * 404 Not Found - Resource not found
   */
  notFound: (resource = 'Resource') => 
    createErrorResponse('Not Found', 404, { message: `${resource} not found` }),

  /**
   * 409 Conflict - Resource already exists
   */
  conflict: (message: string) => 
    createErrorResponse('Conflict', 409, { message }),

  /**
   * 423 Locked - Account or resource locked
   */
  locked: (message: string, retryAfter?: number) => 
    createErrorResponse('Locked', 423, { message, retryAfter }),

  /**
   * 429 Too Many Requests - Rate limit exceeded
   */
  rateLimited: (retryAfter: number, message = 'Too many requests') => 
    createErrorResponse('Rate Limit Exceeded', 429, { 
      message, 
      retryAfter,
      headers: { 'Retry-After': retryAfter.toString() }
    }),

  /**
   * 500 Internal Server Error - Unexpected server error
   */
  internal: (message = 'Internal server error', details?: string) => 
    createErrorResponse('Internal Server Error', 500, { message, details }),

  /**
   * 503 Service Unavailable - Service temporarily unavailable
   */
  serviceUnavailable: (message = 'Service temporarily unavailable') => 
    createErrorResponse('Service Unavailable', 503, { message }),
}
