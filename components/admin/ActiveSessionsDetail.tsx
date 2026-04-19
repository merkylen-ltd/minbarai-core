'use client'

import { useEffect, useState } from 'react'
import { format, formatDistance } from 'date-fns'
import StatusBadge from './StatusBadge'

interface ActiveSession {
  id: string
  userId: string
  email: string
  subscriptionStatus: string
  sessionLimitMinutes: number
  status: string
  startedAt: string
  endedAt?: string
  durationSeconds: number
  durationMinutes: number
}

interface SessionData {
  success: boolean
  activeSessions: ActiveSession[]
  summary: {
    active: number
    capped: number
    expired: number
    total: number
  }
  timestamp: string
}

export default function ActiveSessionsDetail() {
  const [data, setData] = useState<SessionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const res = await fetch('/api/admin/realtime/active-sessions-detail')
        const result = await res.json()
        if (result.success) {
          setData(result)
          setLastUpdated(new Date())
        }
      } catch (error) {
        console.error('Error fetching sessions:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchSessions()
    // Refresh every 10 seconds
    const interval = setInterval(fetchSessions, 10000)

    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className="bg-primary-700/30 border border-accent-500/20 rounded-lg p-6">
        <h2 className="text-neutral-0 font-display text-xl font-semibold mb-4">Active Sessions</h2>
        <div className="text-neutral-400">Loading...</div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="bg-primary-700/30 border border-accent-500/20 rounded-lg p-6">
        <h2 className="text-neutral-0 font-display text-xl font-semibold mb-4">Active Sessions</h2>
        <div className="text-red-400">Failed to load sessions</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
          <div className="text-green-400 text-sm font-medium mb-1">Active</div>
          <div className="text-neutral-0 text-3xl font-semibold">{data.summary.active}</div>
        </div>
        <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-lg">
          <div className="text-orange-400 text-sm font-medium mb-1">Capped</div>
          <div className="text-neutral-0 text-3xl font-semibold">{data.summary.capped}</div>
        </div>
        <div className="p-4 bg-gray-500/10 border border-gray-500/20 rounded-lg">
          <div className="text-gray-400 text-sm font-medium mb-1">Expired</div>
          <div className="text-neutral-0 text-3xl font-semibold">{data.summary.expired}</div>
        </div>
        <div className="p-4 bg-accent-500/10 border border-accent-500/20 rounded-lg">
          <div className="text-accent-400 text-sm font-medium mb-1">Total</div>
          <div className="text-neutral-0 text-3xl font-semibold">{data.summary.total}</div>
        </div>
      </div>

      {/* Active Sessions Table */}
      <div className="bg-primary-700/30 border border-accent-500/20 rounded-lg p-6 overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-neutral-0 font-display text-xl font-semibold">Active Sessions Detail</h2>
          <span className="text-neutral-400 text-xs">
            Updated {lastUpdated ? formatDistance(lastUpdated, new Date(), { addSuffix: true }) : 'now'}
          </span>
        </div>

        {data.activeSessions.length === 0 ? (
          <div className="text-neutral-400 py-8 text-center">No active sessions</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-primary-800/50 border-b border-accent-500/10">
                <tr>
                  <th className="px-4 py-3 text-left text-neutral-300 font-semibold">Email</th>
                  <th className="px-4 py-3 text-left text-neutral-300 font-semibold">Subscription</th>
                  <th className="px-4 py-3 text-left text-neutral-300 font-semibold">Session Start</th>
                  <th className="px-4 py-3 text-right text-neutral-300 font-semibold">Duration</th>
                  <th className="px-4 py-3 text-right text-neutral-300 font-semibold">Limit</th>
                  <th className="px-4 py-3 text-right text-neutral-300 font-semibold">Usage %</th>
                  <th className="px-4 py-3 text-left text-neutral-300 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-accent-500/10">
                {data.activeSessions.map((session) => {
                  const usagePercent =
                    session.sessionLimitMinutes > 0
                      ? Math.round((session.durationMinutes / session.sessionLimitMinutes) * 100)
                      : 0

                  const usageColor =
                    usagePercent >= 90
                      ? 'bg-red-500/10 text-red-300'
                      : usagePercent >= 75
                        ? 'bg-orange-500/10 text-orange-300'
                        : usagePercent >= 50
                          ? 'bg-yellow-500/10 text-yellow-300'
                          : 'bg-green-500/10 text-green-300'

                  return (
                    <tr key={session.id} className="hover:bg-primary-700/20 transition-colors">
                      <td className="px-4 py-3 text-neutral-0 font-medium">{session.email}</td>
                      <td className="px-4 py-3">
                        <span className="capitalize text-sm px-2 py-1 rounded bg-primary-800/50 text-neutral-300">
                          {session.subscriptionStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-neutral-300 text-xs">
                        {format(new Date(session.startedAt), 'MMM d, HH:mm:ss')}
                        <br />
                        <span className="text-neutral-500">
                          {formatDistance(new Date(session.startedAt), new Date(), { addSuffix: true })}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-neutral-0">
                        {session.durationMinutes}m
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-neutral-300">
                        {session.sessionLimitMinutes}m
                      </td>
                      <td className={`px-4 py-3 text-right font-semibold rounded ${usageColor}`}>
                        {usagePercent}%
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-block px-2 py-1 rounded text-xs font-medium bg-green-500/20 text-green-300">
                          Active
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="text-neutral-400 text-xs">
        Last updated: {format(new Date(data.timestamp), 'PPpp')}
      </div>
    </div>
  )
}
