'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { PingResponse, UsageSessionStatus } from '@/types'

interface UseUsageTrackingReturn {
  isActive: boolean
  sessionId: string | null
  status: UsageSessionStatus | null
  startedAt: string | null
  expiresAt: string | null
  capAt: string | null
  totalSeconds: number
  error: string | null
  startSession: () => Promise<void>
  stopSession: () => Promise<void>
  pingSession: () => Promise<void>
}

const PING_INTERVAL = 45000 // 45 seconds
const TTL_SECONDS = 180 // 3 minutes
const MAX_RETRIES = 3
const INITIAL_RETRY_DELAY = 1000 // 1 second
const MAX_CONSECUTIVE_FAILURES = 5 // Circuit breaker threshold

export function useUsageTracking(): UseUsageTrackingReturn {
  const [isActive, setIsActive] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [status, setStatus] = useState<UsageSessionStatus | null>(null)
  const [startedAt, setStartedAt] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<string | null>(null)
  const [capAt, setCapAt] = useState<string | null>(null)
  const [totalSeconds, setTotalSeconds] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const isPingingRef = useRef(false)
  const isStartingRef = useRef(false)
  const isStoppingRef = useRef(false)
  const consecutiveFailuresRef = useRef(0)
  const circuitBreakerOpenRef = useRef(false)
  const isActiveRef = useRef(false)

  // Keep ref in sync with state for use in callbacks
  useEffect(() => {
    isActiveRef.current = isActive
  }, [isActive])

  /**
   * Ping with exponential backoff retry logic
   */
  const pingWithRetry = async (active: boolean, retryCount = 0): Promise<PingResponse | null> => {
    try {
      const response = await fetch('/api/usage/ping', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ active }),
      })

      if (!response.ok) {
        if (response.status >= 500 && retryCount < MAX_RETRIES) {
          // Server error, retry with exponential backoff
          const delay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount)
          console.warn(`[Usage Tracking] Ping failed (${response.status}), retrying in ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`)
          await new Promise(resolve => setTimeout(resolve, delay))
          return pingWithRetry(active, retryCount + 1)
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data: PingResponse = await response.json()
      
      // Reset failure counter on success
      consecutiveFailuresRef.current = 0
      circuitBreakerOpenRef.current = false
      
      return data
    } catch (err) {
      if (retryCount < MAX_RETRIES) {
        const delay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount)
        console.warn(`[Usage Tracking] Ping error, retrying in ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRIES}):`, err)
        await new Promise(resolve => setTimeout(resolve, delay))
        return pingWithRetry(active, retryCount + 1)
      }
      
      throw err
    }
  }

  const pingSession = useCallback(async () => {
    // Prevent concurrent pings
    if (isPingingRef.current) {
      console.log('[Usage Tracking] Ping already in progress, skipping')
      return
    }

    // Circuit breaker: stop pinging if too many failures
    if (circuitBreakerOpenRef.current) {
      console.warn('[Usage Tracking] Circuit breaker open, skipping ping')
      setError('Too many failures, tracking paused')
      return
    }

    isPingingRef.current = true

    try {
      const activeState = isActiveRef.current
      const data = await pingWithRetry(activeState)
      
      if (!data) {
        throw new Error('No response data received')
      }
      
      // Update state with response data
      setSessionId(data.session_id || null)
      setStartedAt(data.started_at || null)
      setExpiresAt(data.expires_at || null)
      setCapAt(data.cap_at || null)
      setTotalSeconds(data.totals.total_seconds)
      setError(null)
      
      // Only update status if we're actively tracking OR we got an active session
      // This prevents showing "closed" status from passive pings
      if (activeState || data.status === 'active') {
        setStatus(data.status)
      }

      // If we INTENDED to be active but session is no longer active, stop pinging
      if (data.status !== 'active' && activeState) {
        console.log(`[Usage Tracking] Session status changed to ${data.status}, stopping tracking`)
        setIsActive(false)
        stopPinging()
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      console.error('[Usage Tracking] Ping failed after retries:', err)
      
      // Increment failure counter
      consecutiveFailuresRef.current++
      
      // Open circuit breaker if too many failures
      if (consecutiveFailuresRef.current >= MAX_CONSECUTIVE_FAILURES) {
        console.error('[Usage Tracking] Too many consecutive failures, opening circuit breaker')
        circuitBreakerOpenRef.current = true
        setIsActive(false)
        stopPinging()
      }
    } finally {
      isPingingRef.current = false
    }
  }, [])

  const stopPinging = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current)
      pingIntervalRef.current = null
    }
  }, [])

  const startPinging = useCallback(() => {
    // Clear any existing interval
    stopPinging()

    // Only start if not already running
    if (!pingIntervalRef.current) {
      pingIntervalRef.current = setInterval(() => {
        // Double-check isActive ref to prevent race conditions
        if (isActiveRef.current) {
          pingSession()
        }
      }, PING_INTERVAL)
    }
  }, [pingSession, stopPinging])

  const startSession = useCallback(async () => {
    // Prevent concurrent start calls
    if (isStartingRef.current || isActiveRef.current) {
      console.log('[Usage Tracking] Session already starting or active')
      return
    }

    isStartingRef.current = true
    
    try {
      // Reset circuit breaker when manually starting
      circuitBreakerOpenRef.current = false
      consecutiveFailuresRef.current = 0
      
      setIsActive(true)
      setError(null)
      
      // Send initial ping to start session
      await pingSession()
      
      // Start periodic pinging
      startPinging()
    } catch (err) {
      console.error('[Usage Tracking] Failed to start session:', err)
      setIsActive(false)
    } finally {
      isStartingRef.current = false
    }
  }, [pingSession, startPinging])

  const stopSession = useCallback(async () => {
    // Prevent concurrent stop calls
    if (isStoppingRef.current || !isActiveRef.current) {
      console.log('[Usage Tracking] Session already stopping or not active')
      return
    }

    isStoppingRef.current = true
    
    try {
      // Stop pinging first
      stopPinging()
      
      // Set inactive to prevent any in-flight pings from restarting
      setIsActive(false)
      
      // Send final ping to stop session
      const data = await pingWithRetry(false)
      
      if (data) {
        setTotalSeconds(data.totals.total_seconds)
        setStatus('closed')
        setError(null)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      console.error('[Usage Tracking] Error stopping session:', err)
    } finally {
      isStoppingRef.current = false
    }
  }, [stopPinging])

  // Cleanup on unmount - ensure session is stopped
  useEffect(() => {
    return () => {
      stopPinging()
      
      // Send final stop ping if active (best effort, non-blocking)
      if (isActiveRef.current) {
        // Use sendBeacon for reliable delivery
        const blob = new Blob([JSON.stringify({ active: false })], {
          type: 'application/json'
        })
        navigator.sendBeacon('/api/usage/ping', blob)
      }
    }
  }, [stopPinging])

  // Auto-stop pinging when page becomes hidden (but don't stop on visibility change, only on unload)
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (isActiveRef.current) {
        // Use Blob with correct content type for sendBeacon
        const blob = new Blob([JSON.stringify({ active: false })], {
          type: 'application/json'
        })
        navigator.sendBeacon('/api/usage/ping', blob)
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [])

  // Check for existing active session on mount (but don't restore closed sessions)
  useEffect(() => {
    let mounted = true

    const checkExistingSession = async () => {
      try {
        // Check if there's an active session
        const data = await pingWithRetry(false) // Send a passive ping
        
        if (!mounted) return
        
        // ONLY restore if status is 'active' - ignore closed/expired/capped sessions
        if (data && data.session_id && data.status === 'active') {
          console.log('[Usage Tracking] Found existing active session, reconnecting:', data.session_id)
          setSessionId(data.session_id)
          setStatus(data.status)
          setStartedAt(data.started_at || null)
          setExpiresAt(data.expires_at || null)
          setCapAt(data.cap_at || null)
          setTotalSeconds(data.totals.total_seconds)
          
          // Note: We don't auto-start pinging, user must explicitly call startSession
          // This prevents unwanted session continuation
        } else if (data && data.status !== 'active') {
          // Session exists but is not active - don't set the status
          // Only update total usage
          console.log('[Usage Tracking] Found non-active session on mount, ignoring status')
          setTotalSeconds(data.totals.total_seconds)
          // Explicitly set status to null to prevent UI from showing "Session closed"
          setStatus(null)
        }
      } catch (err) {
        // Silently fail - no existing session or error fetching
        console.log('[Usage Tracking] No existing session found on mount')
      }
    }

    checkExistingSession()

    return () => {
      mounted = false
    }
  }, [])

  return {
    isActive,
    sessionId,
    status,
    startedAt,
    expiresAt,
    capAt,
    totalSeconds,
    error,
    startSession,
    stopSession,
    pingSession
  }
}
