import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export interface RateLimitConfig {
  windowMs: number
  maxAttempts: number
  keyGenerator?: (request: NextRequest) => string
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetTime: number
  retryAfter?: number
}

function getIp(request: Request | NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')
  const cfConnectingIp = request.headers.get('cf-connecting-ip')

  // Use the LAST value — Google Cloud Run's LB appends the real client IP.
  // Taking [0] is client-controlled and can be spoofed to bypass rate limiting.
  if (forwardedFor) return forwardedFor.split(',').at(-1)!.trim()
  if (realIp) return realIp
  if (cfConnectingIp) return cfConnectingIp
  return (request as NextRequest).ip ?? 'unknown'
}

export async function checkRateLimit(
  request: Request | NextRequest,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const ip = config.keyGenerator
    ? config.keyGenerator(request as NextRequest)
    : getIp(request)
  const key = `ip:${ip}`
  const windowSeconds = Math.ceil(config.windowMs / 1000)
  const now = Date.now()

  try {
    const adminClient = createAdminClient()
    const { data, error } = await adminClient.rpc('check_and_record_attempt', {
      p_key: key,
      p_max_attempts: config.maxAttempts,
      p_window_seconds: windowSeconds,
      p_lockout_seconds: windowSeconds,
    })

    if (error || !data || data.length === 0) {
      return { allowed: true, remaining: config.maxAttempts - 1, resetTime: now + config.windowMs }
    }

    const row = data[0]
    const resetTime = new Date(row.reset_at as string).getTime()
    const isLocked = row.is_locked as boolean

    if (isLocked) {
      const lockedUntil = new Date(row.locked_until as string).getTime()
      return {
        allowed: false,
        remaining: 0,
        resetTime,
        retryAfter: Math.ceil((lockedUntil - now) / 1000),
      }
    }

    return {
      allowed: true,
      remaining: Math.max(0, config.maxAttempts - (row.cur_attempts as number)),
      resetTime,
    }
  } catch {
    // Fail open — rate limiting is best-effort; never block a user because the DB is slow
    return { allowed: true, remaining: config.maxAttempts - 1, resetTime: now + config.windowMs }
  }
}

export function getUserRateLimitKey(userId: string): string {
  return `rate_limit:user:${userId}`
}

export const RATE_LIMIT_CONFIGS = {
  AUTH: { windowMs: 15 * 60 * 1000, maxAttempts: 5 },
  PASSWORD_RESET: { windowMs: 60 * 60 * 1000, maxAttempts: 3 },
  API: { windowMs: 15 * 60 * 1000, maxAttempts: 100 },
  OAUTH_CALLBACK: { windowMs: 15 * 60 * 1000, maxAttempts: 10 },
} as const
