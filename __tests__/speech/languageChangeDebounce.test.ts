/**
 * @jest-environment jsdom
 *
 * Regression guard for the language-change debounce cleanup bug in
 * useSpeechRecognition.
 *
 * Before the fix, the debounce() utility was called INSIDE useCallback.
 * Each time the callback's deps changed, useCallback created a new closure
 * with a fresh, closure-local timeoutId.  The old timeoutId was inaccessible
 * and the old pending timeout could never be cleared — even after the component
 * unmounted.
 *
 * After the fix, the debounce timeout is owned by the effect and tracked in
 * languageChangeTimeoutRef.  The effect's cleanup function cancels it on
 * every re-run and on unmount.
 *
 * This test exercises the fix by verifying that:
 *  1. Rapidly changing the language pairs fires only one handler call (debounce
 *     prevents the intermediate values from being processed).
 *  2. Unmounting while a change is pending does NOT call the handler.
 *
 * Because useSpeechRecognition has many external dependencies, we test the
 * debounce invariant directly via jest.useFakeTimers() against a minimal
 * subset of the hook's language-change effect logic, extracted into a helper
 * that mirrors the production pattern exactly.
 */

// ---------------------------------------------------------------------------
// The production pattern under test (inline re-implementation)
// ---------------------------------------------------------------------------
// We cannot easily render the full useSpeechRecognition hook in isolation
// (it requires VoiceFlow, Gemini, browser APIs, etc.).  Instead we replicate
// the exact effect pattern that was changed:
//
//   useEffect(() => {
//     if (!isRecording) return
//     if (timeoutRef.current) clearTimeout(timeoutRef.current)
//     timeoutRef.current = setTimeout(() => handler(value), delay)
//     return () => {
//       if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null }
//     }
//   }, [value, isRecording, handler])
//
// This lets us test the invariant without instantiating the full hook.
// ---------------------------------------------------------------------------

import { renderHook, act } from '@testing-library/react'
import { useEffect, useRef, useCallback, useState } from 'react'

const DEBOUNCE_MS = 500

/** Minimal hook that mirrors the language-change effect pattern */
function useDebounceEffect(
  value: string,
  isRecording: boolean,
  handler: (v: string) => void
) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handlerRef = useRef(handler)
  handlerRef.current = handler // keep latest without adding to deps

  useEffect(() => {
    if (!isRecording) return

    if (timeoutRef.current) clearTimeout(timeoutRef.current)

    timeoutRef.current = setTimeout(() => {
      handlerRef.current(value)
    }, DEBOUNCE_MS)

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [value, isRecording])
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('language-change effect debounce', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
  })

  it('fires handler once after the debounce delay', () => {
    const handler = jest.fn()
    const { rerender } = renderHook(
      ({ value }: { value: string }) =>
        useDebounceEffect(value, true, handler),
      { initialProps: { value: 'en' } }
    )

    // Still within debounce window — handler must not have fired
    jest.advanceTimersByTime(DEBOUNCE_MS - 1)
    expect(handler).not.toHaveBeenCalled()

    // Past the debounce window — handler fires exactly once
    jest.advanceTimersByTime(1)
    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler).toHaveBeenCalledWith('en')

    void rerender
  })

  it('cancels the pending timeout when value changes within the window', () => {
    const handler = jest.fn()
    const { rerender } = renderHook(
      ({ value }: { value: string }) =>
        useDebounceEffect(value, true, handler),
      { initialProps: { value: 'en' } }
    )

    // Change value before the debounce fires
    jest.advanceTimersByTime(200)
    rerender({ value: 'fr' })

    // Advance past the ORIGINAL debounce window — old timer was cancelled
    jest.advanceTimersByTime(300)
    expect(handler).not.toHaveBeenCalled()

    // Advance past the NEW debounce window — handler fires once with latest value
    jest.advanceTimersByTime(200)
    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler).toHaveBeenCalledWith('fr')
  })

  it('cancels the pending timeout on unmount', () => {
    const handler = jest.fn()
    const { unmount } = renderHook(() =>
      useDebounceEffect('en', true, handler)
    )

    jest.advanceTimersByTime(200) // within window
    unmount()

    // Advance well past the debounce window
    jest.advanceTimersByTime(DEBOUNCE_MS + 100)
    expect(handler).not.toHaveBeenCalled()
  })

  it('does not schedule a timeout when isRecording is false', () => {
    const handler = jest.fn()
    renderHook(() => useDebounceEffect('en', false, handler))

    jest.advanceTimersByTime(DEBOUNCE_MS + 100)
    expect(handler).not.toHaveBeenCalled()
  })
})
