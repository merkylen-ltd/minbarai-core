'use client'

import { useEffect, useState } from 'react'
import { formatDistanceToNow, format } from 'date-fns'

interface Notification {
  id: string
  type: string
  title: string
  message: string | null
  actor_email: string | null
  target_email: string | null
  metadata: Record<string, unknown>
  created_at: string
}

const iconForType = (type: string): string => {
  if (type.startsWith('invoice_paid')) return '💰'
  if (type.startsWith('invoice_voided')) return '❌'
  if (type.startsWith('invoice_')) return '🧾'
  if (type.startsWith('accounts_bulk')) return '👥'
  if (type.startsWith('account_')) return '👤'
  if (type.startsWith('promo_')) return '🎟️'
  if (type.startsWith('email_')) return '📧'
  if (type.startsWith('subscription_')) return '🔄'
  return '🔔'
}

const colorForType = (type: string): string => {
  if (type.includes('paid')) return 'bg-green-500/10 border-green-500/20 text-green-300'
  if (type.includes('voided') || type.includes('deleted') || type.includes('suspended')) return 'bg-red-500/10 border-red-500/20 text-red-300'
  if (type.includes('created') || type.includes('extended')) return 'bg-blue-500/10 border-blue-500/20 text-blue-300'
  return 'bg-accent-500/10 border-accent-500/20 text-accent-300'
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<string>('all')

  useEffect(() => {
    fetchNotifications()
  }, [])

  const fetchNotifications = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/admin/notifications?limit=200')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load activity')
      setNotifications(data.notifications || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load activity')
    } finally {
      setLoading(false)
    }
  }

  const filtered = filter === 'all'
    ? notifications
    : notifications.filter(n => n.type.startsWith(filter))

  const filterOptions = [
    { value: 'all', label: 'All' },
    { value: 'invoice_', label: 'Invoices' },
    { value: 'account_', label: 'Accounts' },
    { value: 'promo_', label: 'Promo Codes' },
    { value: 'email_', label: 'Emails' },
    { value: 'subscription_', label: 'Subscriptions' },
  ]

  return (
    <div className="space-y-8">
      <div className="border-b border-accent-500/20 pb-6">
        <h1 className="text-4xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-neutral-0 to-neutral-200">
          Activity Log
        </h1>
        <p className="text-neutral-300 mt-2 text-lg">
          Audit trail of all admin actions and system events
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {filterOptions.map(opt => (
          <button
            key={opt.value}
            onClick={() => setFilter(opt.value)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              filter === opt.value
                ? 'bg-accent-500 text-neutral-0 shadow'
                : 'bg-primary-700/50 text-neutral-300 hover:bg-primary-700'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-300 rounded-lg">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-3 animate-pulse">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-16 bg-primary-700/30 rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-gradient-to-br from-primary-700/30 to-primary-800/30 border border-accent-500/10 rounded-xl p-12 text-center">
          <p className="text-neutral-400">No activity to show</p>
        </div>
      ) : (
        <div className="bg-gradient-to-br from-primary-700/30 to-primary-800/30 border border-accent-500/10 rounded-xl divide-y divide-accent-500/10 overflow-hidden">
          {filtered.map(n => (
            <div key={n.id} className="p-4 hover:bg-primary-700/30 transition-colors">
              <div className="flex items-start gap-4">
                <span className="text-2xl leading-none pt-0.5">{iconForType(n.type)}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <p className="text-neutral-0 font-medium">{n.title}</p>
                      {n.message && (
                        <p className="text-neutral-400 text-sm mt-1">{n.message}</p>
                      )}
                    </div>
                    <span className={`px-2 py-1 rounded text-[11px] font-semibold border whitespace-nowrap ${colorForType(n.type)}`}>
                      {n.type.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-neutral-500 mt-2">
                    <span title={format(new Date(n.created_at), 'PPpp')}>
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                    </span>
                    {n.actor_email && <span>· {n.actor_email}</span>}
                    {n.target_email && <span>· → {n.target_email}</span>}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
