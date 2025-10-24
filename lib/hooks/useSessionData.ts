'use client'

import { useState, useEffect, useCallback } from 'react'
import { SessionData } from '@/types'

interface UseSessionDataReturn {
  sessionData: SessionData | null
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
  fetchSessionData: () => Promise<void>
  isValidForTranslation: boolean
  sessionTimeRemaining: number
  totalUsageMinutes: number
}

export function useSessionData(): UseSessionDataReturn {
  const [sessionData, setSessionData] = useState<SessionData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchSessionData = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      
      const response = await fetch('/api/auth/session-data', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication required')
        } else if (response.status === 404) {
          throw new Error('User data not found')
        } else {
          throw new Error('Failed to fetch session data')
        }
      }

      const data = await response.json()
      setSessionData(data)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      console.error('Error fetching session data:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const refetch = useCallback(async () => {
    await fetchSessionData()
  }, [fetchSessionData])

  // Calculate if user is valid for translation
  const isValidForTranslation = sessionData ? 
    sessionData.isValidSubscription && !sessionData.isSessionExpired : false

  // Calculate session time remaining in minutes, accounting for active session
  const sessionTimeRemaining = sessionData ? (() => {
    let usedMinutes = sessionData.totalUsageMinutes
    
    // If there's an active session, add its current duration to the used minutes
    if (sessionData.activeSession && sessionData.activeSession.status === 'active') {
      const sessionStart = new Date(sessionData.activeSession.started_at).getTime()
      const now = Date.now()
      const currentSessionMinutes = Math.floor((now - sessionStart) / 60000)
      usedMinutes += currentSessionMinutes
    }
    
    return Math.max(0, sessionData.sessionLimitMinutes - usedMinutes)
  })() : 0

  // Get total usage minutes
  const totalUsageMinutes = sessionData?.totalUsageMinutes || 0

  // Fetch session data on mount
  useEffect(() => {
    fetchSessionData()
  }, [fetchSessionData])

  // Auto-refresh session data to keep time remaining updated
  // Refresh more frequently if there's an active session
  useEffect(() => {
    if (!sessionData) return

    const hasActiveSession = sessionData.activeSession && sessionData.activeSession.status === 'active'
    const refreshInterval = hasActiveSession ? 10000 : 30000 // 10s if active, 30s otherwise

    const interval = setInterval(() => {
      fetchSessionData()
    }, refreshInterval)

    return () => clearInterval(interval)
  }, [sessionData, fetchSessionData])

  return {
    sessionData,
    isLoading,
    error,
    refetch,
    fetchSessionData,
    isValidForTranslation,
    sessionTimeRemaining,
    totalUsageMinutes
  }
}
