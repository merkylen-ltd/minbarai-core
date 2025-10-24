export interface User {
  id: string
  email: string
  subscription_status: 'active' | 'past_due' | 'incomplete' | 'canceled' | 'unpaid' | null
  subscription_id?: string
  customer_id?: string
  subscription_period_end?: string
  session_limit_minutes?: number
  created_at: string
  updated_at: string
}

// Helper type for valid subscription statuses that allow dashboard access
export type ValidSubscriptionStatus = 'active' | 'incomplete' | 'canceled'

// Usage session status enum
export type UsageSessionStatus = 'active' | 'closed' | 'expired' | 'capped'

export interface UsageSession {
  id: string
  user_id: string
  status: UsageSessionStatus
  started_at: string
  last_seen_at: string
  ended_at?: string
  duration_seconds?: number
  max_end_at: string
  created_at: string
  updated_at: string
}

export interface CaptionData {
  transcript: string
  isFinal: boolean
  timestamp?: string
}

export interface TranslationToken {
  token: string
  isEndOfChunk?: boolean
}

export interface Invoice {
  id: string
  created: number
  description?: string
  amount_paid: number
  currency: string
  status: string
  hosted_invoice_url?: string
}

export interface Subscription {
  id: string
  status: string
  current_period_start: number
  current_period_end: number
  cancel_at_period_end: boolean
}

export interface UserData {
  id: string
  email: string
  subscription_status: string | null
  subscription_id?: string
  customer_id?: string
  subscription_period_end?: string
  session_limit_minutes?: number
}

export interface ConnectionStatus {
  connected: boolean
  status: 'connected' | 'disconnected' | 'error' | 'connecting'
  message?: string
}

export interface SessionData {
  user: User
  activeSession: {
    id: string
    started_at: string
    last_seen_at: string
    max_end_at: string
    status: UsageSessionStatus
  } | null
  sessionLimitMinutes: number
  isValidSubscription: boolean
  totalUsageMinutes: number
  totalUsageSeconds: number
  isSessionExpired: boolean
}

export interface PingResponse {
  session_id?: string
  status: UsageSessionStatus
  started_at?: string
  expires_at?: string
  cap_at?: string
  totals: {
    total_seconds: number
  }
}
