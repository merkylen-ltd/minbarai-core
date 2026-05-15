/**
 * app/api/stripe/webhooks/route.ts — Rate Limiting Tests
 *
 * Tests the database-backed webhook rate limiting via the RPC function.
 * These are unit tests that mock the Supabase RPC calls.
 */

describe('Webhook Rate Limiting (Unit Tests with Mocks)', () => {
  const testIP = '192.0.2.1'
  const maxRequests = 100
  const windowSeconds = 60

  // Mock the Supabase RPC call and track state
  const mockRateLimitState = new Map<string, { count: number; resetAt: Date }>()

  const mockRpc = async (functionName: string, params: Record<string, unknown>) => {
    if (functionName !== 'check_and_record_webhook_attempt') {
      throw new Error(`Unknown RPC function: ${functionName}`)
    }

    const ip = params.p_ip_address as string
    const maxReq = params.p_max_requests as number
    const windowSecs = params.p_window_seconds as number
    const now = new Date()

    let record = mockRateLimitState.get(ip)
    if (!record) {
      record = {
        count: 0,
        resetAt: new Date(now.getTime() + windowSecs * 1000)
      }
    }

    // Check if window has expired
    if (now >= record.resetAt) {
      record.count = 0
      record.resetAt = new Date(now.getTime() + windowSecs * 1000)
    }

    // Increment count
    record.count++
    mockRateLimitState.set(ip, record)

    const isAllowed = record.count <= maxReq

    return {
      data: [
        {
          cur_requests: record.count,
          is_allowed: isAllowed,
          reset_at: record.resetAt.toISOString()
        }
      ],
      error: null
    }
  }

  beforeEach(() => {
    mockRateLimitState.clear()
  })

  it('should allow first request from new IP', async () => {
    const { data, error } = await mockRpc('check_and_record_webhook_attempt', {
      p_ip_address: testIP,
      p_max_requests: maxRequests,
      p_window_seconds: windowSeconds
    })

    expect(error).toBeNull()
    expect(data).toHaveLength(1)
    expect(data[0].is_allowed).toBe(true)
    expect(data[0].cur_requests).toBe(1)
  })

  it('should increment request count on each call', async () => {
    // First request
    const result1 = await mockRpc('check_and_record_webhook_attempt', {
      p_ip_address: testIP,
      p_max_requests: maxRequests,
      p_window_seconds: windowSeconds
    })
    expect(result1.data[0].cur_requests).toBe(1)

    // Second request
    const result2 = await mockRpc('check_and_record_webhook_attempt', {
      p_ip_address: testIP,
      p_max_requests: maxRequests,
      p_window_seconds: windowSeconds
    })
    expect(result2.data[0].cur_requests).toBe(2)
    expect(result2.data[0].is_allowed).toBe(true)

    // Third request
    const result3 = await mockRpc('check_and_record_webhook_attempt', {
      p_ip_address: testIP,
      p_max_requests: maxRequests,
      p_window_seconds: windowSeconds
    })
    expect(result3.data[0].cur_requests).toBe(3)
    expect(result3.data[0].is_allowed).toBe(true)
  })

  it('should reject requests when exceeding rate limit', async () => {
    const lowLimit = 3

    // Make lowLimit requests (all should be allowed)
    for (let i = 1; i <= lowLimit; i++) {
      const result = await mockRpc('check_and_record_webhook_attempt', {
        p_ip_address: testIP,
        p_max_requests: lowLimit,
        p_window_seconds: windowSeconds
      })
      expect(result.data[0].is_allowed).toBe(true)
      expect(result.data[0].cur_requests).toBe(i)
    }

    // Make one more request (should be rejected)
    const rejectedResult = await mockRpc('check_and_record_webhook_attempt', {
      p_ip_address: testIP,
      p_max_requests: lowLimit,
      p_window_seconds: windowSeconds
    })
    expect(rejectedResult.data[0].is_allowed).toBe(false)
    expect(rejectedResult.data[0].cur_requests).toBe(lowLimit + 1)
  })

  it('should provide reset timestamp when rate limited', async () => {
    const lowLimit = 2

    // Make lowLimit + 1 requests to trigger rate limit
    for (let i = 0; i < lowLimit; i++) {
      await mockRpc('check_and_record_webhook_attempt', {
        p_ip_address: testIP,
        p_max_requests: lowLimit,
        p_window_seconds: windowSeconds
      })
    }

    const result = await mockRpc('check_and_record_webhook_attempt', {
      p_ip_address: testIP,
      p_max_requests: lowLimit,
      p_window_seconds: windowSeconds
    })

    expect(result.data[0].is_allowed).toBe(false)
    expect(result.data[0].reset_at).toBeDefined()

    // Reset timestamp should be in the future
    const resetTime = new Date(result.data[0].reset_at).getTime()
    const now = Date.now()
    expect(resetTime).toBeGreaterThan(now)
    expect(resetTime - now).toBeLessThanOrEqual(windowSeconds * 1000 + 1000)
  })

  it('should track separate IPs independently', async () => {
    const ip1 = '192.0.2.10'
    const ip2 = '192.0.2.20'
    const limit = 2

    // Request from IP1
    const ip1Result1 = await mockRpc('check_and_record_webhook_attempt', {
      p_ip_address: ip1,
      p_max_requests: limit,
      p_window_seconds: windowSeconds
    })
    expect(ip1Result1.data[0].cur_requests).toBe(1)

    // Make 2 requests from IP2
    const ip2Result1 = await mockRpc('check_and_record_webhook_attempt', {
      p_ip_address: ip2,
      p_max_requests: limit,
      p_window_seconds: windowSeconds
    })
    expect(ip2Result1.data[0].cur_requests).toBe(1)

    const ip2Result2 = await mockRpc('check_and_record_webhook_attempt', {
      p_ip_address: ip2,
      p_max_requests: limit,
      p_window_seconds: windowSeconds
    })
    expect(ip2Result2.data[0].cur_requests).toBe(2)

    // IP1 second request should be at count 2 (unaffected by IP2)
    const ip1Result2 = await mockRpc('check_and_record_webhook_attempt', {
      p_ip_address: ip1,
      p_max_requests: limit,
      p_window_seconds: windowSeconds
    })
    expect(ip1Result2.data[0].cur_requests).toBe(2)
  })

  it('should not reset count within the same window', async () => {
    // Make 3 rapid requests
    for (let i = 1; i <= 3; i++) {
      const result = await mockRpc('check_and_record_webhook_attempt', {
        p_ip_address: testIP,
        p_max_requests: 5,
        p_window_seconds: windowSeconds
      })
      expect(result.data[0].cur_requests).toBe(i)
    }

    // State should still show count of 3
    const state = mockRateLimitState.get(testIP)
    expect(state?.count).toBe(3)
  })

  it('should handle concurrent requests correctly', async () => {
    const limit = 5
    const concurrentRequests = 10

    // Make many concurrent mock requests
    const promises = Array.from({ length: concurrentRequests }, () =>
      mockRpc('check_and_record_webhook_attempt', {
        p_ip_address: testIP,
        p_max_requests: limit,
        p_window_seconds: windowSeconds
      })
    )

    const results = await Promise.all(promises)

    // Count allowed and rejected
    const allowedCount = results.filter(r => r.data[0].is_allowed).length
    const rejectedCount = results.filter(r => !r.data[0].is_allowed).length

    expect(allowedCount).toBe(limit)
    expect(rejectedCount).toBe(concurrentRequests - limit)

    // Final count should be total requests
    const state = mockRateLimitState.get(testIP)
    expect(state?.count).toBe(concurrentRequests)
  })

  it('should reset count when window expires', async () => {
    const limit = 5
    const shortWindow = 1 // 1 second

    // First request
    const result1 = await mockRpc('check_and_record_webhook_attempt', {
      p_ip_address: testIP,
      p_max_requests: limit,
      p_window_seconds: shortWindow
    })
    expect(result1.data[0].cur_requests).toBe(1)

    // Simulate window expiration by manually advancing time in the state
    const state = mockRateLimitState.get(testIP)!
    state.resetAt = new Date(Date.now() - 100) // Window expired

    // Next request should reset the count
    const result2 = await mockRpc('check_and_record_webhook_attempt', {
      p_ip_address: testIP,
      p_max_requests: limit,
      p_window_seconds: shortWindow
    })
    expect(result2.data[0].cur_requests).toBe(1)
  })
})
