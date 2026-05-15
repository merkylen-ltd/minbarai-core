'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import StatusBadge from '@/components/admin/StatusBadge'

interface User {
  id: string
  email: string
  subscription_status: string
  created_at: string
  customer_id?: string
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [stats, setStats] = useState<any>(null)

  useEffect(() => {
    // Load user stats
    fetch('/api/admin/users/stats')
      .then(res => res.json())
      .then(data => {
        if (!data.error) setStats(data)
      })
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: '20',
      enrich_stripe: 'true',
      ...(debouncedSearch && { search: debouncedSearch }),
      ...(statusFilter && { subscription_status: statusFilter }),
    })

    fetch(`/api/admin/users?${params}`)
      .then(res => res.json())
      .then(data => {
        if (!data.error) {
          setUsers(data.users)
          setTotalPages(data.pagination.totalPages)
        }
      })
      .finally(() => setLoading(false))
  }, [page, debouncedSearch, statusFilter])

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="border-b border-accent-500/20 pb-6">
        <h1 className="text-4xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-neutral-0 to-neutral-200">
          User Management
        </h1>
        <p className="text-neutral-300 mt-2 text-lg">View and manage all platform users</p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/10 border border-blue-500/20 rounded-xl p-6 shadow-lg hover:border-blue-500/40 transition-all duration-200">
            <div className="text-neutral-300 text-sm font-semibold uppercase tracking-wide">Active</div>
            <div className="text-neutral-0 text-4xl font-display font-bold mt-2">{stats.statusBreakdown.active || 0}</div>
          </div>
          <div className="bg-gradient-to-br from-orange-500/10 to-orange-600/10 border border-orange-500/20 rounded-xl p-6 shadow-lg hover:border-orange-500/40 transition-all duration-200">
            <div className="text-neutral-300 text-sm font-semibold uppercase tracking-wide">Canceled</div>
            <div className="text-neutral-0 text-4xl font-display font-bold mt-2">{stats.statusBreakdown.canceled || 0}</div>
          </div>
          <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/10 border border-purple-500/20 rounded-xl p-6 shadow-lg hover:border-purple-500/40 transition-all duration-200">
            <div className="text-neutral-300 text-sm font-semibold uppercase tracking-wide">Incomplete</div>
            <div className="text-neutral-0 text-4xl font-display font-bold mt-2">{stats.statusBreakdown.incomplete || 0}</div>
          </div>
          <div className="bg-gradient-to-br from-green-500/10 to-green-600/10 border border-green-500/20 rounded-xl p-6 shadow-lg hover:border-green-500/40 transition-all duration-200">
            <div className="text-neutral-300 text-sm font-semibold uppercase tracking-wide">Active Last 7 Days</div>
            <div className="text-neutral-0 text-4xl font-display font-bold mt-2">{stats.activeLastWeek}</div>
          </div>
        </div>
      )}

      {/* Search and Filters */}
      <div className="bg-gradient-to-br from-primary-700/30 to-primary-800/30 border border-accent-500/10 rounded-xl p-6 shadow-lg">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <input
            type="text"
            placeholder="🔍 Search by email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="md:col-span-2 px-4 py-3 bg-primary-800/50 border border-accent-500/20 rounded-lg text-neutral-0 placeholder-neutral-400 focus:outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 transition-all"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-3 bg-primary-800/50 border border-accent-500/20 rounded-lg text-neutral-0 focus:outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 transition-all"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="canceled">Canceled</option>
            <option value="incomplete">Incomplete</option>
            <option value="past_due">Past Due</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-gradient-to-br from-primary-700/30 to-primary-800/30 border border-accent-500/10 rounded-xl shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-primary-800/50 border-b border-accent-500/10">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-neutral-200 uppercase tracking-wider">User</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-neutral-200 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-neutral-200 uppercase tracking-wider">Joined</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-neutral-200 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-accent-500/10">
              {loading ? (
                // Skeleton loading state
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={`skeleton-${idx}`} className="animate-pulse">
                    <td className="px-6 py-4">
                      <div className="h-4 bg-primary-700/30 rounded w-40"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-6 bg-primary-700/30 rounded w-20"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 bg-primary-700/30 rounded w-24"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-10 bg-primary-700/30 rounded w-32"></div>
                    </td>
                  </tr>
                ))
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center">
                    <div className="text-neutral-400">
                      {search || statusFilter ? `No users found${search ? ` matching "${search}"` : ''}` : 'No users available'}
                    </div>
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-primary-700/20 transition-colors">
                    <td className="px-6 py-4">
                      <div className="text-neutral-0 font-medium">{user.email}</div>
                      {user.customer_id && (
                        <div className="text-neutral-400 text-sm mt-1">ID: {user.id.slice(0, 8)}...</div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={user.subscription_status} />
                    </td>
                    <td className="px-6 py-4 text-neutral-300">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <Link
                        href={`/admin/users/${user.id}`}
                        className="inline-flex items-center px-4 py-2 rounded-lg bg-accent-500/20 text-accent-300 border border-accent-500/30 hover:bg-accent-500/30 hover:border-accent-500/50 transition-all duration-200 font-medium"
                      >
                        View Details
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 bg-primary-800/30 border-t border-accent-500/10 flex items-center justify-between">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 rounded-lg bg-primary-700 text-neutral-0 hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              ← Previous
            </button>
            <span className="text-neutral-300 font-medium">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 rounded-lg bg-primary-700 text-neutral-0 hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
