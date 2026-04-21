'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { Bell } from 'lucide-react'

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

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [recentCount, setRecentCount] = useState(0)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  const fetchNotifications = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/admin/notifications?limit=15')
      if (!res.ok) return
      const data = await res.json()
      setNotifications(data.notifications || [])
      setRecentCount(data.recentCount || 0)
    } catch (err) {
      console.error('Failed to fetch notifications:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 60_000) // poll every 60s
    return () => clearInterval(interval)
  }, [])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => {
          setOpen(o => !o)
          if (!open) fetchNotifications()
        }}
        className="relative p-2 rounded-lg bg-primary-700/50 border border-accent-500/10 hover:bg-primary-700/70 transition-colors"
        aria-label="Activity notifications"
        title="Activity"
      >
        <Bell className="w-5 h-5 text-neutral-300" />
        {recentCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-accent-500 text-neutral-0 text-[10px] font-bold flex items-center justify-center shadow">
            {recentCount > 99 ? '99+' : recentCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-96 max-h-[70vh] overflow-hidden rounded-xl bg-primary-800 border border-accent-500/20 shadow-2xl z-50 flex flex-col">
          <div className="px-4 py-3 border-b border-accent-500/10 flex items-center justify-between">
            <h3 className="text-neutral-0 font-semibold">Activity</h3>
            <Link
              href="/admin/notifications"
              onClick={() => setOpen(false)}
              className="text-accent-400 hover:text-accent-300 text-xs"
            >
              View all
            </Link>
          </div>

          <div className="overflow-y-auto flex-1">
            {loading && notifications.length === 0 ? (
              <div className="p-6 text-center text-neutral-400 text-sm">Loading…</div>
            ) : notifications.length === 0 ? (
              <div className="p-6 text-center text-neutral-500 text-sm">No activity yet</div>
            ) : (
              <ul className="divide-y divide-accent-500/10">
                {notifications.map(n => (
                  <li key={n.id} className="px-4 py-3 hover:bg-primary-700/30 transition-colors">
                    <div className="flex items-start gap-3">
                      <span className="text-lg leading-none">{iconForType(n.type)}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-neutral-0 text-sm font-medium truncate">{n.title}</p>
                        {n.message && (
                          <p className="text-neutral-400 text-xs mt-0.5 line-clamp-2">{n.message}</p>
                        )}
                        <p className="text-neutral-500 text-[11px] mt-1">
                          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                          {n.actor_email ? ` · ${n.actor_email}` : ''}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
