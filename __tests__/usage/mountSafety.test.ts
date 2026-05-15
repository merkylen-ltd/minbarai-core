/**
 * Test 3 — Mount safety (RC-2 regression guard)
 *
 * useUsageSession must NOT call POST /api/usage/ping with { active: false }
 * on mount, even when an active session exists.  The old useUsageTracking hook
 * had this bug — this test confirms the replacement hook is safe.
 */

import { renderHook } from '@testing-library/react'
import { useUsageSession } from '@/lib/hooks/useUsageSession'

// Stub EventSource so the SSE connection doesn't error in jsdom
class MockEventSource {
  onopen: (() => void) | null = null
  onmessage: ((e: { data: string }) => void) | null = null
  onerror: (() => void) | null = null
  close = jest.fn()
}

// Track all fetch calls
const fetchSpy = jest.fn()

beforeAll(() => {
  Object.defineProperty(global, 'EventSource', {
    writable: true,
    value: MockEventSource,
  })
  global.fetch = fetchSpy
})

afterAll(() => {
  jest.restoreAllMocks()
})

describe('useUsageSession mount safety', () => {
  beforeEach(() => {
    fetchSpy.mockClear()
  })

  it('does not POST { active: false } to /api/usage/ping on mount', () => {
    renderHook(() => useUsageSession())

    // Find any POST to the ping endpoint made during mount
    const destructiveCalls = fetchSpy.mock.calls.filter(([url, options]) => {
      if (url !== '/api/usage/ping') return false
      if (options?.method !== 'POST') return false
      try {
        const body = JSON.parse(options.body)
        return body.active === false
      } catch {
        return false
      }
    })

    expect(destructiveCalls).toHaveLength(0)
  })

  it('does not call /api/usage/ping at all on mount (reads via SSE only)', () => {
    renderHook(() => useUsageSession())

    const pingCalls = fetchSpy.mock.calls.filter(([url]) => url === '/api/usage/ping')
    expect(pingCalls).toHaveLength(0)
  })
})
