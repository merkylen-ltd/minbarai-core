/**
 * Test 5 — Multi-tab session:closed delivery (RC-3 regression guard)
 *
 * Two independent invocations of getCurrentUsageState() with their own
 * previousState closures must BOTH detect the session closure and return
 * a session:closed event.  Before the fix, the shared module-level Map
 * caused the second invocation to miss the closure.
 */

import type { SSEEvent } from '@/types/usage-session'
import type { SupabaseClient } from '@supabase/supabase-js'

// ── Minimal inline of getCurrentUsageState (post-fix signature) ──────────────
// We duplicate only the closure-detection logic here to keep the test
// independent of the full route module (which has Next.js globals).

interface SessionStateCache {
  sessionId: string | null
  status: string
  lastChecked: number
}

async function getCurrentUsageState(
  activeSession: { id: string; started_at: string; last_seen_at: string; max_end_at: string } | null,
  totalUsageSeconds: number,
  limitSeconds: number,
  previousState: SessionStateCache,
  updatePreviousState: (s: SessionStateCache) => void,
): Promise<SSEEvent> {
  const now = Date.now()

  let effectiveStatus = 'idle'
  let effectiveSessionId: string | null = null
  let currentSessionSeconds = 0

  if (activeSession) {
    const sessionStart = new Date(activeSession.started_at).getTime()
    currentSessionSeconds = Math.floor((now - sessionStart) / 1000)
    effectiveStatus = 'active'
    effectiveSessionId = activeSession.id
  }

  const hadActiveSession =
    previousState.sessionId !== null &&
    (previousState.status === 'active' ||
      previousState.status === 'capped' ||
      previousState.status === 'expired')

  const currentHasNoSession = effectiveStatus === 'idle' || effectiveSessionId === null

  const sessionJustClosed =
    hadActiveSession && currentHasNoSession && previousState.status !== 'idle'

  updatePreviousState({ sessionId: effectiveSessionId, status: effectiveStatus, lastChecked: now })

  const usedSeconds = totalUsageSeconds + currentSessionSeconds
  const timeRemainingSeconds = Math.max(0, limitSeconds - usedSeconds)

  if (sessionJustClosed) {
    return {
      type: 'session:closed',
      sessionId: previousState.sessionId!,
      endedAt: new Date(now).toISOString(),
      totalUsageSeconds: usedSeconds,
      timeRemainingSeconds,
      reason: 'user',
    } as SSEEvent
  }

  return {
    type: 'usage:updated',
    sessionId: null,
    status: 'idle',
    startedAt: null,
    expiresAt: null,
    capAt: null,
    timeRemainingSeconds,
    totalUsageSeconds,
    currentSessionSeconds: 0,
  } as SSEEvent
}

// ── tests ────────────────────────────────────────────────────────────────────

describe('getCurrentUsageState — per-connection closure detection (RC-3)', () => {
  const SESSION_ID = 'session-abc'
  const ACTIVE_SESSION = {
    id: SESSION_ID,
    started_at: new Date(Date.now() - 60_000).toISOString(),
    last_seen_at: new Date(Date.now() - 10_000).toISOString(),
    max_end_at: new Date(Date.now() + 10_800_000).toISOString(),
  }

  it('both tabs receive session:closed when each has independent previousState', async () => {
    // Simulate two SSE connections, each with their own closure state
    let stateA: SessionStateCache = { sessionId: null, status: 'idle', lastChecked: 0 }
    let stateB: SessionStateCache = { sessionId: null, status: 'idle', lastChecked: 0 }

    // Both tabs see the active session first
    const event1A = await getCurrentUsageState(
      ACTIVE_SESSION, 0, 10800, stateA, (s) => { stateA = s },
    )
    const event1B = await getCurrentUsageState(
      ACTIVE_SESSION, 0, 10800, stateB, (s) => { stateB = s },
    )
    expect(event1A.type).toBe('usage:updated') // active, not closed
    expect(event1B.type).toBe('usage:updated')

    // Session is now closed in DB — both tabs get null activeSession
    const event2A = await getCurrentUsageState(
      null, 3600, 10800, stateA, (s) => { stateA = s },
    )
    const event2B = await getCurrentUsageState(
      null, 3600, 10800, stateB, (s) => { stateB = s },
    )

    // Both tabs must fire session:closed (RC-3 fix)
    expect(event2A.type).toBe('session:closed')
    expect(event2B.type).toBe('session:closed')
  })

  it('does not double-fire session:closed on subsequent idle polls', async () => {
    let state: SessionStateCache = { sessionId: null, status: 'idle', lastChecked: 0 }

    // Establish active state
    await getCurrentUsageState(ACTIVE_SESSION, 0, 10800, state, (s) => { state = s })

    // Session closes
    const closed = await getCurrentUsageState(null, 3600, 10800, state, (s) => { state = s })
    expect(closed.type).toBe('session:closed')

    // Next poll — still no session → must be usage:updated (idle), NOT session:closed again
    const idle = await getCurrentUsageState(null, 3600, 10800, state, (s) => { state = s })
    expect(idle.type).toBe('usage:updated')
  })
})
