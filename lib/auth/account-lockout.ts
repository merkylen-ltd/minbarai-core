import { createAdminClient } from '@/lib/supabase/admin'

export interface AccountLockoutConfig {
  maxAttempts: number
  lockoutDurationMs: number
  windowMs: number
}

export interface AccountLockoutResult {
  isLocked: boolean
  remainingAttempts: number
  lockoutUntil?: number
  retryAfter?: number
}

function lockoutKey(email: string): string {
  return `lockout:${email.toLowerCase()}`
}

/** Read-only check — does not increment the attempt counter */
export async function checkAccountLockout(
  email: string,
  config: AccountLockoutConfig
): Promise<AccountLockoutResult> {
  try {
    const adminClient = createAdminClient()
    const { data } = await adminClient
      .from('auth_rate_limits')
      .select('attempts, locked_until, window_start')
      .eq('key', lockoutKey(email))
      .maybeSingle()

    if (!data) {
      return { isLocked: false, remainingAttempts: config.maxAttempts }
    }

    const now = Date.now()
    const lockedUntil = data.locked_until ? new Date(data.locked_until as string).getTime() : null
    const windowExpiry = new Date(data.window_start as string).getTime() + config.windowMs

    // Lock expired or window expired — treat as clean
    if ((!lockedUntil || lockedUntil <= now) && windowExpiry <= now) {
      return { isLocked: false, remainingAttempts: config.maxAttempts }
    }

    if (lockedUntil && lockedUntil > now) {
      return {
        isLocked: true,
        remainingAttempts: 0,
        lockoutUntil: lockedUntil,
        retryAfter: Math.ceil((lockedUntil - now) / 1000),
      }
    }

    return {
      isLocked: false,
      remainingAttempts: Math.max(0, config.maxAttempts - (data.attempts as number)),
    }
  } catch {
    // Fail open
    return { isLocked: false, remainingAttempts: config.maxAttempts }
  }
}

/** Record a failed login attempt — atomically increments counter and may set lockout */
export async function recordFailedAttempt(
  email: string,
  config: AccountLockoutConfig
): Promise<AccountLockoutResult> {
  const key = lockoutKey(email)
  const windowSeconds = Math.ceil(config.windowMs / 1000)
  const lockoutSeconds = Math.ceil(config.lockoutDurationMs / 1000)
  const now = Date.now()

  try {
    const adminClient = createAdminClient()
    const { data, error } = await adminClient.rpc('check_and_record_attempt', {
      p_key: key,
      p_max_attempts: config.maxAttempts,
      p_window_seconds: windowSeconds,
      p_lockout_seconds: lockoutSeconds,
    })

    if (error || !data || data.length === 0) {
      return { isLocked: false, remainingAttempts: config.maxAttempts }
    }

    const row = data[0]
    const isLocked = row.is_locked as boolean
    const curAttempts = row.cur_attempts as number
    const lockedUntil = row.locked_until ? new Date(row.locked_until as string).getTime() : undefined

    if (isLocked && lockedUntil) {
      return {
        isLocked: true,
        remainingAttempts: 0,
        lockoutUntil: lockedUntil,
        retryAfter: Math.ceil((lockedUntil - now) / 1000),
      }
    }

    return {
      isLocked: false,
      remainingAttempts: Math.max(0, config.maxAttempts - curAttempts),
    }
  } catch {
    // Fail open — a failed DB write must not block login flow
    return { isLocked: false, remainingAttempts: config.maxAttempts }
  }
}

/** Delete the lockout record after successful login — fire-and-forget, never awaited by callers */
export async function clearFailedAttempts(email: string): Promise<void> {
  try {
    const adminClient = createAdminClient()
    await adminClient
      .from('auth_rate_limits')
      .delete()
      .eq('key', lockoutKey(email))
  } catch {
    // Swallow — a failed delete must never block a successful login response
  }
}

export const ACCOUNT_LOCKOUT_CONFIGS = {
  STANDARD: { maxAttempts: 5, lockoutDurationMs: 15 * 60 * 1000, windowMs: 15 * 60 * 1000 },
  STRICT: { maxAttempts: 3, lockoutDurationMs: 60 * 60 * 1000, windowMs: 10 * 60 * 1000 },
  VERY_STRICT: { maxAttempts: 3, lockoutDurationMs: 24 * 60 * 60 * 1000, windowMs: 5 * 60 * 1000 },
} as const
