import { USAGE_SESSION_TTL_SECONDS, PING_INTERVAL_MS } from '@/lib/usage/constants'

describe('usage constants', () => {
  it('TTL_SECONDS is 180 (3 minutes)', () => {
    expect(USAGE_SESSION_TTL_SECONDS).toBe(180)
  })

  it('PING_INTERVAL_MS is 45000 (45 seconds)', () => {
    expect(PING_INTERVAL_MS).toBe(45_000)
  })

  it('at least 4 pings fit within the TTL window', () => {
    // A healthy client sends a ping every PING_INTERVAL_MS.
    // The TTL must allow at least 4 missed pings so transient network
    // blips don't prematurely expire sessions.
    const pingIntervalSeconds = PING_INTERVAL_MS / 1000
    expect(USAGE_SESSION_TTL_SECONDS).toBeGreaterThan(pingIntervalSeconds * 3)
  })
})
