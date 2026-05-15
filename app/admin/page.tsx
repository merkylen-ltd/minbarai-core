'use client'

import { useEffect, useState } from 'react'
import MetricCard from '@/components/admin/MetricCard'
import ActiveSessionsDetail from '@/components/admin/ActiveSessionsDetail'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { format } from 'date-fns'

interface OverviewData {
  totalUsers: number
  activeSubscriptions: number
  activeSessions: number
  newSignups: {
    today: number
    thisWeek: number
    thisMonth: number
  }
  mrr: number
}

interface SignupData {
  period: string
  signups: Array<{ date: string; count: number }>
}

interface SessionCount {
  active: number
  capped: number
  expired: number
  total: number
  timestamp: string
}

export default function AdminDashboard() {
  const [overview, setOverview] = useState<OverviewData | null>(null)
  const [signupData, setSignupData] = useState<SignupData | null>(null)
  const [sessionCount, setSessionCount] = useState<SessionCount | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Fetch overview data
    fetch('/api/admin/analytics/overview')
      .then(res => res.json())
      .then(data => {
        if (data.error) throw new Error(data.error)
        setOverview(data)
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))

    // Fetch signup trends
    fetch('/api/admin/analytics/signups?period=30d')
      .then(res => res.json())
      .then(data => {
        if (data.error) throw new Error(data.error)
        setSignupData(data)
      })
      .catch(err => console.error('Error fetching signups:', err))

    // Setup realtime session count SSE
    const eventSource = new EventSource('/api/admin/realtime/active-sessions')
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data)
      setSessionCount(data)
    }
    eventSource.onerror = () => {
      console.error('SSE connection error')
      eventSource.close()
    }

    return () => {
      eventSource.close()
    }
  }, [])

  if (loading && !overview) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-display font-semibold text-neutral-0">Dashboard</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <MetricCard key={i} title="" value="" icon={<div/>} loading />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-400 text-red-400 px-4 py-3 rounded-lg">
        Error loading dashboard: {error}
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Page Title */}
      <div className="border-b border-accent-500/20 pb-6">
        <h1 className="text-4xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-neutral-0 to-neutral-200">
          Admin Dashboard
        </h1>
        <p className="text-neutral-300 mt-2 text-lg">Monitor and manage your MinbarAI platform</p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Users"
          value={overview?.totalUsers || 0}
          color="blue"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          }
        />
        
        <MetricCard
          title="Active Subscriptions"
          value={overview?.activeSubscriptions || 0}
          color="green"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
            </svg>
          }
        />
        
        <MetricCard
          title="Monthly Revenue (MRR)"
          value={`$${(overview?.mrr || 0).toFixed(2)}`}
          color="purple"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        
        <MetricCard
          title="Active Sessions"
          value={sessionCount?.active || 0}
          color="orange"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          }
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Signup Trend Chart */}
        <div className="bg-gradient-to-br from-primary-700/30 to-primary-800/30 border border-accent-500/10 rounded-xl p-6 shadow-lg">
          <h2 className="text-neutral-0 font-display text-xl font-bold mb-6">Signup Trend (Last 30 Days)</h2>
          {signupData && signupData.signups.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={signupData.signups}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis 
                  dataKey="date" 
                  stroke="#9CA3AF"
                  tickFormatter={(value) => format(new Date(value), 'MMM d')}
                />
                <YAxis stroke="#9CA3AF" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1A2E35', 
                    border: '1px solid #55a39a',
                    borderRadius: '8px',
                  }}
                  labelStyle={{ color: '#F9FAFB' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="count" 
                  stroke="#55a39a" 
                  strokeWidth={2}
                  dot={{ fill: '#55a39a', r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-neutral-400">
              No data available
            </div>
          )}
        </div>

        {/* New Signups Breakdown */}
        <div className="bg-primary-700/30 border border-accent-500/20 rounded-lg p-6">
          <h2 className="text-neutral-0 font-display text-xl font-semibold mb-4">New Signups</h2>
          {overview ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-primary-800/50 rounded-lg">
                <span className="text-neutral-400">Today</span>
                <span className="text-neutral-0 text-2xl font-semibold">{overview.newSignups.today}</span>
              </div>
              <div className="flex items-center justify-between p-4 bg-primary-800/50 rounded-lg">
                <span className="text-neutral-400">This Week</span>
                <span className="text-neutral-0 text-2xl font-semibold">{overview.newSignups.thisWeek}</span>
              </div>
              <div className="flex items-center justify-between p-4 bg-primary-800/50 rounded-lg">
                <span className="text-neutral-400">This Month</span>
                <span className="text-neutral-0 text-2xl font-semibold">{overview.newSignups.thisMonth}</span>
              </div>
            </div>
          ) : (
            <div className="h-[260px] flex items-center justify-center text-neutral-400">
              Loading...
            </div>
          )}
        </div>
      </div>

      {/* Active Sessions with Detail */}
      <ActiveSessionsDetail />
    </div>
  )
}
