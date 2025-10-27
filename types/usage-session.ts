/**
 * Usage Session Types
 * 
 * Types for the server-driven usage tracking system with SSE
 */

export type SessionStatus = 'idle' | 'starting' | 'active' | 'stopping' | 'closed' | 'expired' | 'capped'

export interface UsageSessionState {
  // Session identification
  sessionId: string | null
  status: SessionStatus
  isActive: boolean
  
  // Time data (server-calculated)
  timeRemainingSeconds: number
  totalUsageSeconds: number
  currentSessionSeconds: number
  
  // Session timestamps
  sessionStartedAt: string | null
  sessionExpiresAt: string | null
  sessionCapAt: string | null
  
  // Connection state
  isConnected: boolean
  isLoading: boolean
  error: string | null
}

export interface UsageSessionActions {
  startSession: () => Promise<void>
  stopSession: () => Promise<void>
}

export interface UsageSessionHelpers {
  timeRemainingMinutes: number
  totalUsageMinutes: number
  isValidForRecording: boolean // Can START a new recording (false during active)
  isValidForTranslation: boolean // Has valid subscription and time (true during active)
  hasReachedLimit: boolean
  isNearLimit: boolean
}

export type UsageSessionReturn = UsageSessionState & UsageSessionActions & UsageSessionHelpers

// SSE Event Types
export type SSEEventType = 
  | 'session:created'
  | 'session:heartbeat'
  | 'session:closed'
  | 'session:warning'
  | 'usage:updated'
  | 'connection:heartbeat'

export interface SSEBaseEvent {
  type: SSEEventType
}

export interface SSESessionCreatedEvent extends SSEBaseEvent {
  type: 'session:created'
  sessionId: string
  status: SessionStatus
  startedAt: string
  expiresAt: string
  capAt: string
  timeRemainingSeconds: number
  totalUsageSeconds: number
  currentSessionSeconds: number
}

export interface SSESessionHeartbeatEvent extends SSEBaseEvent {
  type: 'session:heartbeat'
  sessionId: string
  status: SessionStatus
  startedAt: string
  expiresAt: string
  capAt: string
  timeRemainingSeconds: number
  totalUsageSeconds: number
  currentSessionSeconds: number
}

export interface SSESessionClosedEvent extends SSEBaseEvent {
  type: 'session:closed'
  sessionId: string
  endedAt: string
  totalUsageSeconds: number
  timeRemainingSeconds: number
  reason: 'user' | 'expired' | 'capped'
}

export interface SSESessionWarningEvent extends SSEBaseEvent {
  type: 'session:warning'
  sessionId: string
  timeRemainingSeconds: number
  message: string
}

export interface SSEUsageUpdatedEvent extends SSEBaseEvent {
  type: 'usage:updated'
  sessionId: string | null
  status: SessionStatus
  startedAt: string | null
  expiresAt: string | null
  capAt: string | null
  timeRemainingSeconds: number
  totalUsageSeconds: number
  currentSessionSeconds: number
}

export interface SSEConnectionHeartbeatEvent extends SSEBaseEvent {
  type: 'connection:heartbeat'
}

export type SSEEvent = 
  | SSESessionCreatedEvent
  | SSESessionHeartbeatEvent
  | SSESessionClosedEvent
  | SSESessionWarningEvent
  | SSEUsageUpdatedEvent
  | SSEConnectionHeartbeatEvent

// API Response Types (backward compatible)
export interface UsageSessionAPIResponse {
  session_id?: string
  status: 'active' | 'closed' | 'expired' | 'capped'
  started_at?: string
  expires_at?: string
  cap_at?: string
  
  // New: Backend-calculated time data
  time_remaining_seconds: number
  total_usage_seconds: number
  current_session_seconds?: number
  
  // Backward compatibility
  totals: {
    total_seconds: number
  }
}

