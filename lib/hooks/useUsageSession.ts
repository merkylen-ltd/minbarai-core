'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type {
  UsageSessionReturn,
  SessionStatus,
  SSEEvent,
  UsageSessionAPIResponse
} from '@/types/usage-session'
import { PING_INTERVAL_MS } from '@/lib/usage/constants'

/**
 * Unified Usage Session Hook
 * 
 * Replaces useUsageTracking and useSessionData with a single, server-driven hook
 * that uses SSE for real-time updates and eliminates race conditions.
 */
export function useUsageSession(): UsageSessionReturn {
  // Session state (from SSE events)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [status, setStatus] = useState<SessionStatus>('idle')
  const [isActive, setIsActive] = useState(false)
  
  // Time data (backend-calculated, no client-side calculations)
  const [timeRemainingSeconds, setTimeRemainingSeconds] = useState(0)
  const [totalUsageSeconds, setTotalUsageSeconds] = useState(0)
  const [currentSessionSeconds, setCurrentSessionSeconds] = useState(0)
  
  // Session timestamps
  const [sessionStartedAt, setSessionStartedAt] = useState<string | null>(null)
  const [sessionExpiresAt, setSessionExpiresAt] = useState<string | null>(null)
  const [sessionCapAt, setSessionCapAt] = useState<string | null>(null)
  
  // Connection and error state
  const [isConnected, setIsConnected] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Refs for managing SSE connection and preventing duplicate requests
  const eventSourceRef = useRef<EventSource | null>(null)
  const isStartingRef = useRef(false)
  const isStoppingRef = useRef(false)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const maxReconnectAttempts = 5
  const baseReconnectDelay = 1000
  const keepalivePingIntervalRef = useRef<NodeJS.Timeout | null>(null)

  /**
   * Process SSE events and update state
   */
  const processSSEEvent = useCallback((event: SSEEvent) => {
    // Set loading to false once we receive any event
    setIsLoading(false)
    
    // Ignore heartbeat events (just keep connection alive)
    if (event.type === 'connection:heartbeat') {
      return
    }
    
    // Update state based on event type
    if (event.type === 'session:created' || event.type === 'session:heartbeat' || event.type === 'usage:updated') {
      setSessionId(event.sessionId)
      setStatus(event.status)
      // Only set isActive if status is literally 'active', not expired/capped
      setIsActive(event.status === 'active')
      setTimeRemainingSeconds(event.timeRemainingSeconds)
      setTotalUsageSeconds(event.totalUsageSeconds)
      setCurrentSessionSeconds(event.currentSessionSeconds)
      setSessionStartedAt(event.startedAt)
      setSessionExpiresAt(event.expiresAt)
      setSessionCapAt(event.capAt)
      
      // Clear error unless we hit a limit
      const eventIsCapped = (event.status as string) === 'capped'
      if (!eventIsCapped && event.timeRemainingSeconds > 0) {
        setError(null)
      } else if (eventIsCapped || event.timeRemainingSeconds <= 0) {
        // User has reached their limit
        setError('Session limit reached. No remaining time available.')
      }
    } else if (event.type === 'session:closed') {
      setSessionId(null)
      setStatus('closed')
      setIsActive(false)
      setTimeRemainingSeconds(event.timeRemainingSeconds)
      setTotalUsageSeconds(event.totalUsageSeconds)
      setCurrentSessionSeconds(0)
      setSessionStartedAt(null)
      setSessionExpiresAt(null)
      setSessionCapAt(null)
      setError(null)
    } else if (event.type === 'session:warning') {
      setTimeRemainingSeconds(event.timeRemainingSeconds)
      // Warning doesn't change other state
    }
    
    // Reset reconnect attempts on successful event
    reconnectAttemptsRef.current = 0
  }, [])

  /**
   * Connect to SSE stream
   */
  const connectSSE = useCallback(() => {
    // Don't connect if already connected
    if (eventSourceRef.current) {
      return
    }

    try {
      const eventSource = new EventSource('/api/usage/stream')
      eventSourceRef.current = eventSource

      eventSource.onopen = () => {
        setIsConnected(true)
        setError(null)
        reconnectAttemptsRef.current = 0
        
        // Clear any pending reconnect
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current)
          reconnectTimeoutRef.current = null
        }
      }

      eventSource.onmessage = (event) => {
        try {
          const data: SSEEvent = JSON.parse(event.data)
          processSSEEvent(data)
        } catch (err) {
          console.error('[useUsageSession] Error parsing SSE event:', err)
        }
      }

      eventSource.onerror = (err) => {
        console.error('[useUsageSession] SSE error:', err)
        setIsConnected(false)
        
        // Close and cleanup current connection
        if (eventSourceRef.current) {
          eventSourceRef.current.close()
          eventSourceRef.current = null
        }

        // Attempt reconnection with exponential backoff
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++
          const delay = baseReconnectDelay * Math.pow(2, reconnectAttemptsRef.current - 1)
          
          console.log(`[useUsageSession] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`)
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connectSSE()
          }, delay)
        } else {
          console.error('[useUsageSession] Max reconnection attempts reached')
          setError('Connection lost. Please refresh the page.')
        }
      }
    } catch (err) {
      console.error('[useUsageSession] Error creating EventSource:', err)
      setError('Failed to connect to usage tracking service')
      setIsConnected(false)
    }
  }, [processSSEEvent])

  /**
   * Disconnect from SSE stream
   */
  const disconnectSSE = useCallback(() => {
    // Clear reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    
    // Close event source
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    
    setIsConnected(false)
  }, [])

  /**
   * Start a usage session (begin recording/tracking)
   * 
   * NOTE: This function only triggers the session creation on the server.
   * State updates come from SSE events, not from the ping response.
   * This eliminates race conditions between ping responses and SSE events.
   */
  const startSession = useCallback(async () => {
    if (isStartingRef.current || isActive) {
      return
    }

    isStartingRef.current = true
    setStatus('starting')
    setError(null)

    try {
      const response = await fetch('/api/usage/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: true }),
      })

      const data = await response.json()
      
      // Handle limit reached response (403)
      if (response.status === 403) {
        console.warn('[useUsageSession] Session limit reached:', data.error)
        setError(data.error || 'Session limit reached')
        setStatus('capped')
        // SSE will send the authoritative state update shortly
        return
      }
      
      if (!response.ok) {
        throw new Error(data.error || `Failed to start session: ${response.statusText}`)
      }
      
      // SUCCESS: Session created on server
      // Don't update state here - trust SSE to send the authoritative update
      // The SSE stream will receive a database change event and update our state
      console.log('[useUsageSession] Session start requested, waiting for SSE update')
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      console.error('[useUsageSession] Error starting session:', err)
      setError(errorMessage)
      setStatus('idle')
      setIsActive(false)
    } finally {
      isStartingRef.current = false
    }
  }, [isActive])

  /**
   * Stop a usage session (stop recording/tracking)
   * 
   * NOTE: This function only triggers the session closure on the server.
   * State updates come from SSE events, not from the ping response.
   * This eliminates race conditions between ping responses and SSE events.
   */
  const stopSession = useCallback(async () => {
    // Guard against concurrent calls only — do NOT guard on isActive.
    // The session may have just been created (startUsageSession is fire-and-forget)
    // and the SSE session:created event may not have arrived yet, so isActive can
    // still be false even though the server has an open session. The server API is
    // idempotent: stopping an already-closed session is a safe no-op.
    if (isStoppingRef.current) {
      console.log('[useUsageSession] Stop already in progress, ignoring duplicate call')
      return
    }

    isStoppingRef.current = true
    setStatus('stopping')
    setError(null)

    try {
      const response = await fetch('/api/usage/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: false }),
      })

      if (!response.ok) {
        throw new Error(`Failed to stop session: ${response.statusText}`)
      }

      // SUCCESS: Session closed on server
      // Don't update state here - trust SSE to send the authoritative update
      // The SSE stream will receive a database change event and send session:closed
      console.log('[useUsageSession] Session stop requested, waiting for SSE update')
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      console.error('[useUsageSession] Error stopping session:', err)
      setError(errorMessage)
      // Revert to idle on error; if the session is still active the SSE
      // heartbeat will push the correct state back shortly.
      setStatus('idle')
    } finally {
      isStoppingRef.current = false
    }
  }, [])

  /**
   * Connect to SSE on mount, disconnect on unmount
   */
  useEffect(() => {
    connectSSE()
    
    return () => {
      disconnectSSE()
    }
  }, [connectSSE, disconnectSSE])

  /**
   * Ensure session is stopped on unmount if active
   */
  useEffect(() => {
    return () => {
      if (isActive && !isStoppingRef.current) {
        // Use sendBeacon for reliable delivery on page unload
        const blob = new Blob([JSON.stringify({ active: false })], {
          type: 'application/json',
        })
        navigator.sendBeacon('/api/usage/ping', blob)
      }
    }
  }, [isActive])

  /**
   * Keepalive ping interval — renews last_seen_at while a session is active.
   *
   * The server marks a session 'expired' if it receives no ping for TTL_SECONDS
   * (180 s). Without this interval, the client only sends one ping on start,
   * so any session longer than 3 minutes would auto-expire mid-recording.
   *
   * Uses a bare fetch (not startSession) to bypass the isActive guard in
   * startSession, which would silently drop the request.
   */
  useEffect(() => {
    if (!isActive) {
      if (keepalivePingIntervalRef.current) {
        clearInterval(keepalivePingIntervalRef.current)
        keepalivePingIntervalRef.current = null
      }
      return
    }

    keepalivePingIntervalRef.current = setInterval(() => {
      fetch('/api/usage/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: true }),
      }).catch((err) => {
        console.warn('[useUsageSession] Keepalive ping failed:', err)
      })
    }, PING_INTERVAL_MS)

    return () => {
      if (keepalivePingIntervalRef.current) {
        clearInterval(keepalivePingIntervalRef.current)
        keepalivePingIntervalRef.current = null
      }
    }
  }, [isActive])

  // Computed values
  const timeRemainingMinutes = Math.floor(timeRemainingSeconds / 60)
  const totalUsageMinutes = Math.floor(totalUsageSeconds / 60)
  
  // Check if user has reached their session limit
  const isCapped = (status as string) === 'capped'
  const hasReachedLimit = timeRemainingSeconds <= 0 || isCapped
  
  // Valid for starting a NEW recording if:
  // 1. Not currently active (prevents double-start)
  // 2. Has time remaining (not at 0 or capped)
  // 3. Status allows recording (idle, closed normally, or expired with time left)
  const recordingAllowedStatuses: SessionStatus[] = ['idle', 'closed', 'expired']
  const isValidForRecording = !isActive && 
                               !hasReachedLimit && 
                               timeRemainingSeconds > 0 &&
                               recordingAllowedStatuses.includes(status)
  
  // Valid for translation (subscription is valid and has time) - regardless of recording state
  // This is used to show subscription validity in UI
  const isValidForTranslation = !hasReachedLimit && timeRemainingSeconds > 0
  
  const isNearLimit = timeRemainingSeconds > 0 && timeRemainingSeconds <= 1800 // 30 minutes

  return {
    // Session state
    sessionId,
    status,
    isActive,
    
    // Time data (server-calculated)
    timeRemainingSeconds,
    timeRemainingMinutes,
    totalUsageSeconds,
    totalUsageMinutes,
    currentSessionSeconds,
    
    // Session details
    sessionStartedAt,
    sessionExpiresAt,
    sessionCapAt,
    
    // Actions
    startSession,
    stopSession,
    
    // UI helpers
    isValidForRecording, // Can START a new recording (false during active recording)
    isValidForTranslation, // Has valid subscription and time (true during active recording)
    hasReachedLimit,
    isNearLimit,
    
    // Connection state
    isConnected,
    isLoading,
    error,
  }
}

