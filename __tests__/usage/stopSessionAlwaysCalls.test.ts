/**
 * @jest-environment jsdom
 *
 * Regression guard for the useUsageSession stopSession stale-isActive bug.
 *
 * Before the fix, stopSession had an early-return guard:
 *   if (!isActive) { return }
 * This caused it to silently skip the HTTP stop request when called in the
 * fire-and-forget window — i.e. after startUsageSession() sent the HTTP
 * request but before the SSE session:created event arrived and set
 * isActive = true.  The server session was then never closed.
 *
 * After the fix, stopSession sends the POST regardless of isActive state.
 * The server API is idempotent so stopping a not-yet-active session is safe.
 */

import { renderHook, act } from '@testing-library/react'
import { useUsageSession } from '@/lib/hooks/useUsageSession'

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

  /** Fire a parsed SSE event on this instance */
  fireEvent(payload: Record<string, unknown>) {
    this.onmessage?.({ data: JSON.stringify(payload) })
  }
}

// ---- Test setup ------------------------------------------------------------

const fetchSpy = jest.fn()

beforeAll(() => {
  Object.defineProperty(global, 'EventSource', { writable: true, value: MockEventSource })
  global.fetch = fetchSpy
  // jsdom does not implement sendBeacon; the unmount cleanup uses it when isActive=true
  Object.defineProperty(navigator, 'sendBeacon', { writable: true, value: jest.fn() })
})

beforeEach(() => {
  fetchSpy.mockClear()
  MockEventSource.instances.length = 0
})

afterAll(() => {
  jest.restoreAllMocks()
})

// ---- Helpers ---------------------------------------------------------------

/** Resolve fetch with a 200 OK */
function mockFetchOk() {
  fetchSpy.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({}),
  })
}

// ---- Tests -----------------------------------------------------------------

describe('useUsageSession — stopSession always sends stop request', () => {
  it('calls POST /api/usage/ping { active: false } when isActive is false (fire-and-forget window)', async () => {
    mockFetchOk()

    const { result } = renderHook(() => useUsageSession())

    // isActive starts as false — no SSE event has been fired
    expect(result.current.isActive).toBe(false)

    // Call stopSession while isActive is still false
    await act(async () => {
      await result.current.stopSession()
    })

    const stopCalls = fetchSpy.mock.calls.filter(([url, opts]) => {
      if (url !== '/api/usage/ping') return false
      if (opts?.method !== 'POST') return false
      try {
        return JSON.parse(opts.body).active === false
      } catch {
        return false
      }
    })

    // The stop request must be sent — not silently swallowed
    expect(stopCalls).toHaveLength(1)
  })

  it('calls POST /api/usage/ping { active: false } when isActive is true', async () => {
    mockFetchOk()

    const { result } = renderHook(() => useUsageSession())

    // Simulate SSE making isActive = true
    const sse = MockEventSource.instances[0]
    act(() => {
      sse.fireEvent({
        type: 'session:created',
        sessionId: 'abc',
        status: 'active',
        timeRemainingSeconds: 3600,
        totalUsageSeconds: 0,
        currentSessionSeconds: 0,
        startedAt: null,
        expiresAt: null,
        capAt: null,
      })
    })

    expect(result.current.isActive).toBe(true)

    await act(async () => {
      await result.current.stopSession()
    })

    const stopCalls = fetchSpy.mock.calls.filter(([url, opts]) => {
      if (url !== '/api/usage/ping') return false
      if (opts?.method !== 'POST') return false
      try {
        return JSON.parse(opts.body).active === false
      } catch {
        return false
      }
    })

    expect(stopCalls).toHaveLength(1)
  })

  it('does not send a second stop request if one is already in flight', async () => {
    // Simulate a slow server response so both calls overlap
    let resolveFirst!: () => void
    fetchSpy.mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveFirst = () =>
            resolve({
              ok: true,
              status: 200,
              json: async () => ({}),
            } as Response)
        })
    )

    const { result } = renderHook(() => useUsageSession())

    // Fire both without awaiting
    const p1 = act(async () => { result.current.stopSession() })
    const p2 = act(async () => { result.current.stopSession() })

    // Resolve the pending fetch and wait for both act() calls
    resolveFirst()
    await p1
    await p2

    const stopCalls = fetchSpy.mock.calls.filter(([url, opts]) => {
      if (url !== '/api/usage/ping') return false
      if (opts?.method !== 'POST') return false
      try {
        return JSON.parse(opts.body).active === false
      } catch {
        return false
      }
    })

    // isStoppingRef should have blocked the second concurrent call
    expect(stopCalls).toHaveLength(1)
  })
})
