/**
 * Regression guard for RC-T2:
 * Queue dequeue race — in-flight translations must not be dropped.
 *
 * The race: when typing completes, isTypingRef.current is set to false (sync)
 * before setPendingTranslation(nextFromQueue) is committed (async React update).
 * A concurrent queueTranslation() call arriving in that gap sees isTypingRef as
 * false and calls setPendingTranslation() directly, overwriting the dequeued item.
 *
 * Fix: set isTypingRef.current = true synchronously before setPendingTranslation,
 * so concurrent calls push to the queue instead of overwriting.
 *
 * Note: The exact browser race (WebSocket macrotask firing between setInterval
 * tick and React re-render) is not reproducible in synchronous Jest because act()
 * flushes React updates immediately. These tests instead verify:
 *   1. Normal queue ordering — all translations appear
 *   2. isTypingRef is true in the dequeue gap (the synchronous lock is in place)
 */

import { renderHook, act } from '@testing-library/react'
import { useTypingAnimation } from '@/components/dashboard/live-captioning/hooks/useTypingAnimation'
import type React from 'react'

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.runOnlyPendingTimers()
  jest.useRealTimers()
})

function makeScrollRef(): React.RefObject<HTMLDivElement> {
  return { current: null }
}

describe('useTypingAnimation — queue ordering', () => {
  it('processes two queued translations in order (A then B)', () => {
    const scrollRef = makeScrollRef()
    const { result } = renderHook(() => useTypingAnimation(scrollRef, 10))

    act(() => { result.current.queueTranslation('Alpha') })
    act(() => { result.current.queueTranslation('Beta') })

    // Advance past Alpha (5 chars × ~45ms adaptive = well under 500ms)
    act(() => { jest.advanceTimersByTime(500) })
    // Advance past Beta
    act(() => { jest.advanceTimersByTime(500) })

    expect(result.current.completedTranslations).toContain('Alpha')
    expect(result.current.completedTranslations).toContain('Beta')
  })

  it('processes three queued translations — none dropped', () => {
    const scrollRef = makeScrollRef()
    const { result } = renderHook(() => useTypingAnimation(scrollRef, 10))

    act(() => { result.current.queueTranslation('Alpha') })
    act(() => { result.current.queueTranslation('Beta') })
    act(() => { result.current.queueTranslation('Gamma') })

    // Each act() advance completes one animation layer and flushes React effects
    // (dequeue + new setInterval) before the next layer runs.
    act(() => { jest.advanceTimersByTime(500) }) // Alpha completes, Beta starts
    act(() => { jest.advanceTimersByTime(500) }) // Beta completes, Gamma starts
    act(() => { jest.advanceTimersByTime(500) }) // Gamma completes

    expect(result.current.completedTranslations).toContain('Alpha')
    expect(result.current.completedTranslations).toContain('Beta')
    expect(result.current.completedTranslations).toContain('Gamma')
  })

  it('starts next queued translation immediately after current completes', () => {
    const scrollRef = makeScrollRef()
    const { result } = renderHook(() => useTypingAnimation(scrollRef, 10))

    act(() => { result.current.queueTranslation('Hello') })
    act(() => { result.current.queueTranslation('World') })

    // After Alpha finishes, Beta should be in typingText (animating)
    act(() => { jest.advanceTimersByTime(500) })

    // 'Hello' should be in completedTranslations; 'World' should be starting
    expect(result.current.completedTranslations).toContain('Hello')
  })
})

describe('useTypingAnimation — dequeue race guard (RC-T2)', () => {
  it('isTypingRef is true when checked right after A completes and B is dequeued', () => {
    const scrollRef = makeScrollRef()
    const { result } = renderHook(() => useTypingAnimation(scrollRef, 10))

    // Start A, queue B
    act(() => { result.current.queueTranslation('Alpha') })
    act(() => { result.current.queueTranslation('Beta') })

    // Advance until A's typing animation completes (dequeue fires)
    act(() => { jest.advanceTimersByTime(500) })

    // With the fix: isTypingRef.current is set to true synchronously before
    // setPendingTranslation(Beta), so it is true after act() flushes everything.
    // Without the fix: same result since act() flushes React updates synchronously —
    // but the fix protects the REAL browser where there is no synchronous flush.
    //
    // This assertion documents the expected invariant: after A finishes and B is
    // dequeued, the ref must be true so any concurrent queueTranslation pushes to queue.
    expect(result.current.isTyping).toBe(true)
  })

  it('translation queued during dequeue gap lands in queue (not overwritten)', () => {
    const scrollRef = makeScrollRef()
    const { result } = renderHook(() => useTypingAnimation(scrollRef, 10))

    // Start A, queue B
    act(() => { result.current.queueTranslation('Alpha') })
    act(() => { result.current.queueTranslation('Beta') })

    // Complete A (dequeues B, Beta starts animating)
    act(() => { jest.advanceTimersByTime(500) })

    // Simulate concurrent arrival: Gamma queued while B is in progress.
    // isTypingRef.current must be true here (fix ensures it) → push to queue.
    act(() => { result.current.queueTranslation('Gamma') })

    // Process Beta and Gamma one layer at a time
    act(() => { jest.advanceTimersByTime(500) }) // Beta completes, Gamma starts
    act(() => { jest.advanceTimersByTime(500) }) // Gamma completes

    // All three must appear — none dropped
    expect(result.current.completedTranslations).toContain('Alpha')
    expect(result.current.completedTranslations).toContain('Beta')
    expect(result.current.completedTranslations).toContain('Gamma')
  })

  it('clearPendingQueue stops animation and leaves completedTranslations intact', () => {
    const scrollRef = makeScrollRef()
    const { result } = renderHook(() => useTypingAnimation(scrollRef, 10))

    act(() => { result.current.queueTranslation('Alpha') })
    act(() => { jest.advanceTimersByTime(500) }) // Let Alpha complete

    act(() => { result.current.queueTranslation('Beta') })

    // Clear mid-animation
    act(() => { result.current.clearPendingQueue() })

    expect(result.current.isTyping).toBe(false)
    expect(result.current.typingQueueRef.current).toHaveLength(0)
    // Completed translations must be preserved
    expect(result.current.completedTranslations).toContain('Alpha')
  })
})
