/**
 * @jest-environment jsdom
 *
 * Regression guard: keepalive pings must be sent every PING_INTERVAL_MS while
 * a usage session is active, so the server never marks the session 'expired'
 * due to inactivity during a long recording.
 *
 * Before the fix, useUsageSession sent ONE ping on start and ONE on stop.
 * After 180 s (TTL) without a ping the server would mark the session 'expired',
 * the SSE stream would push status='expired' to the client, and the auto-stop
 * effect in the dashboard would fire the "Session Stopped / expired" popup
 * mid-recording.
 *
 * After the fix, a setInterval fires a bare fetch every PING_INTERVAL_MS (45 s)
 * while isActive is true — well within the 180 s TTL.
 */

import { renderHook, act } from '@testing-library/react'
import { useUsageSession } from '@/lib/hooks/useUsageSession'
import { PING_INTERVAL_MS } from '@/lib/usage/constants'

// ---- MockEventSource -------------------------------------------------------

class MockEventSource {
  static instances: MockEventSource[] = []

  onopen: (() => void) | null = null
  onmessage: ((e: { data: string }) => void) | null = null
  onerror: (() => void) | null = null
  close = jest.fn()

  constructor() {
    MockEventSource.instances.push(this)
  }

  fireEvent(payload: Record<string, unknown>) {
    this.onmessage?.({ data: JSON.stringify(payload) })
  }
}

// ---- Shared SSE payload factories ------------------------------------------

function sessionCreatedPayload(sessionId = 'test-session') {
  return {
    type: 'session:created',
    sessionId,
    status: 'active',
    timeRemainingSeconds: 3600,
    totalUsageSeconds: 0,
    currentSessionSeconds: 0,
    startedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    capAt: new Date(Date.now() + 10_800_000).toISOString(),
  }
}

function sessionClosedPayload(sessionId = 'test-session') {
  return {
    type: 'session:closed',
    sessionId,
    endedAt: new Date().toISOString(),
    totalUsageSeconds: 60,
    timeRemainingSeconds: 3540,
    reason: 'user',
  }
}

// ---- Test setup ------------------------------------------------------------

const fetchSpy = jest.fn()

beforeAll(() => {
  Object.defineProperty(global, 'EventSource', { writable: true, value: MockEventSource })
  global.fetch = fetchSpy
  Object.defineProperty(navigator, 'sendBeacon', { writable: true, value: jest.fn() })
})

beforeEach(() => {
  fetchSpy.mockClear()
  MockEventSource.instances.length = 0
  jest.useFakeTimers()
})

afterEach(() => {
  jest.runOnlyPendingTimers()
  jest.useRealTimers()
})

afterAll(() => {
  jest.restoreAllMocks()
})

// ---- Helpers ---------------------------------------------------------------

function mockFetchOk() {
  fetchSpy.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({}),
  })
}

function keepaliveCalls() {
  return fetchSpy.mock.calls.filter(([url, opts]) => {
    if (url !== '/api/usage/ping') return false
    if (opts?.method !== 'POST') return false
    try {
      return JSON.parse(opts.body).active === true
    } catch {
      return false
    }
  })
}

// ---- Tests -----------------------------------------------------------------

describe('useUsageSession — keepalive pings', () => {
  it('sends a ping every PING_INTERVAL_MS while isActive is true', async () => {
    mockFetchOk()

    const { result } = renderHook(() => useUsageSession())

    // Make the session active via SSE
    const sse = MockEventSource.instances[0]
    act(() => {
      sse.fireEvent(sessionCreatedPayload())
    })
    expect(result.current.isActive).toBe(true)

    // No keepalive yet — interval hasn't fired
    expect(keepaliveCalls()).toHaveLength(0)

    // Advance one full interval — first keepalive fires
    await act(async () => {
      jest.advanceTimersByTime(PING_INTERVAL_MS)
    })
    expect(keepaliveCalls()).toHaveLength(1)

    // Advance another interval — second keepalive fires
    await act(async () => {
      jest.advanceTimersByTime(PING_INTERVAL_MS)
    })
    expect(keepaliveCalls()).toHaveLength(2)
  })

  it('stops sending keepalives once the session is closed', async () => {
    mockFetchOk()

    const { result } = renderHook(() => useUsageSession())

    const sse = MockEventSource.instances[0]
    act(() => {
      sse.fireEvent(sessionCreatedPayload())
    })
    expect(result.current.isActive).toBe(true)

    // Fire one interval
    await act(async () => {
      jest.advanceTimersByTime(PING_INTERVAL_MS)
    })
    const pingsBefore = keepaliveCalls().length
    expect(pingsBefore).toBe(1)

    // Close the session via SSE
    act(() => {
      sse.fireEvent(sessionClosedPayload())
    })
    expect(result.current.isActive).toBe(false)

    // Advance several more intervals — no further pings
    await act(async () => {
      jest.advanceTimersByTime(PING_INTERVAL_MS * 3)
    })
    expect(keepaliveCalls()).toHaveLength(pingsBefore)
  })

  it('does not send keepalives when the session is idle', async () => {
    mockFetchOk()

    renderHook(() => useUsageSession())

    // Advance well past the interval without making the session active
    await act(async () => {
      jest.advanceTimersByTime(PING_INTERVAL_MS * 5)
    })

    expect(keepaliveCalls()).toHaveLength(0)
  })
})
