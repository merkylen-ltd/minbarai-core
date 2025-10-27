'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { 
  UsageSessionReturn, 
  SessionStatus, 
  SSEEvent,
  UsageSessionAPIResponse 
} from '@/types/usage-session'

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
  const [error, setError] = useState<string | null>(null)
  
  // Refs for managing SSE connection and preventing duplicate requests
  const eventSourceRef = useRef<EventSource | null>(null)
  const isStartingRef = useRef(false)
  const isStoppingRef = useRef(false)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const maxReconnectAttempts = 5
  const baseReconnectDelay = 1000

  /**
   * Process SSE events and update state
   */
  const processSSEEvent = useCallback((event: SSEEvent) => {
    console.log('[useUsageSession] Received event:', event.type, event)
    
    // Ignore heartbeat events (just keep connection alive)
    if (event.type === 'connection:heartbeat') {
      return
    }
    
    // Update state based on event type
    if (event.type === 'session:created' || event.type === 'session:heartbeat' || event.type === 'usage:updated') {
      setSessionId(event.sessionId)
      setStatus(event.status)
      setIsActive(event.status === 'active')
      setTimeRemainingSeconds(event.timeRemainingSeconds)
      setTotalUsageSeconds(event.totalUsageSeconds)
      setCurrentSessionSeconds(event.currentSessionSeconds)
      setSessionStartedAt(event.startedAt)
      setSessionExpiresAt(event.expiresAt)
      setSessionCapAt(event.capAt)
      setError(null)
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
      console.log('[useUsageSession] SSE already connected')
      return
    }

    console.log('[useUsageSession] Connecting to SSE stream...')

    try {
      const eventSource = new EventSource('/api/usage/stream')
      eventSourceRef.current = eventSource

      eventSource.onopen = () => {
        console.log('[useUsageSession] SSE connection opened')
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
    console.log('[useUsageSession] Disconnecting from SSE stream')
    
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
   */
  const startSession = useCallback(async () => {
    if (isStartingRef.current || isActive) {
      console.log('[useUsageSession] Session already starting or active')
      return
    }

    isStartingRef.current = true
    setStatus('starting')
    setError(null)

    try {
      console.log('[useUsageSession] Starting session...')
      
      const response = await fetch('/api/usage/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: true }),
      })

      if (!response.ok) {
        throw new Error(`Failed to start session: ${response.statusText}`)
      }

      const data: UsageSessionAPIResponse = await response.json()
      
      // Update state from response
      setSessionId(data.session_id || null)
      setStatus('active')
      setIsActive(true)
      setTimeRemainingSeconds(data.time_remaining_seconds)
      setTotalUsageSeconds(data.total_usage_seconds)
      setCurrentSessionSeconds(data.current_session_seconds || 0)
      setSessionStartedAt(data.started_at || null)
      setSessionExpiresAt(data.expires_at || null)
      setSessionCapAt(data.cap_at || null)

      console.log('[useUsageSession] Session started:', data.session_id)
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
   */
  const stopSession = useCallback(async () => {
    if (isStoppingRef.current || !isActive) {
      console.log('[useUsageSession] Session already stopping or not active')
      return
    }

    isStoppingRef.current = true
    setStatus('stopping')
    setError(null)

    try {
      console.log('[useUsageSession] Stopping session...')
      
      const response = await fetch('/api/usage/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: false }),
      })

      if (!response.ok) {
        throw new Error(`Failed to stop session: ${response.statusText}`)
      }

      const data: UsageSessionAPIResponse = await response.json()
      
      // Update state from response - set to idle (ready for new session)
      setSessionId(null)
      setStatus('idle') // Back to idle state, ready for new recording
      setIsActive(false)
      setTimeRemainingSeconds(data.time_remaining_seconds)
      setTotalUsageSeconds(data.total_usage_seconds)
      setCurrentSessionSeconds(0)
      setSessionStartedAt(null)
      setSessionExpiresAt(null)
      setSessionCapAt(null)

      console.log('[useUsageSession] Session stopped, back to idle')
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      console.error('[useUsageSession] Error stopping session:', err)
      setError(errorMessage)
    } finally {
      isStoppingRef.current = false
    }
  }, [isActive])

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

  // Computed values
  const timeRemainingMinutes = Math.floor(timeRemainingSeconds / 60)
  const totalUsageMinutes = Math.floor(totalUsageSeconds / 60)
  const hasReachedLimit = timeRemainingSeconds <= 0
  
  // Valid for starting a NEW recording if:
  // 1. Not currently active (prevents double-start)
  // 2. Has time remaining
  // 3. Status allows recording (idle, closed normally, or expired with time left)
  const isValidForRecording = !isActive && !hasReachedLimit && ['idle', 'closed', 'expired'].includes(status)
  
  // Valid for translation (subscription is valid and has time) - regardless of recording state
  // This is used to show subscription validity in UI
  const isValidForTranslation = !hasReachedLimit && !['capped'].includes(status)
  
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
    error,
  }
}

