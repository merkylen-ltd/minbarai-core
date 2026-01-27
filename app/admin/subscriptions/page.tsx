'use client'

import { useEffect, useState } from 'react'
import StatusBadge from '@/components/admin/StatusBadge'
import { format } from 'date-fns'

export default function SubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'canceled'>('all')

  useEffect(() => {
    fetch('/api/admin/subscriptions')
      .then(res => res.json())
      .then(data => {
        if (!data.error) setSubscriptions(data.subscriptions)
      })
      .finally(() => setLoading(false))
  }, [])

  const filteredSubscriptions = subscriptions.filter(sub => {
    if (activeTab === 'active') return sub.subscription_status === 'active'
    if (activeTab === 'canceled') return sub.subscription_status === 'canceled'
    return true
  })

  const statusCounts = {
    all: subscriptions.length,
    active: subscriptions.filter(s => s.subscription_status === 'active').length,
    canceled: subscriptions.filter(s => s.subscription_status === 'canceled').length,
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="border-b border-accent-500/20 pb-6">
        <h1 className="text-4xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-neutral-0 to-neutral-200">
          Subscriptions
        </h1>
        <p className="text-neutral-300 mt-2 text-lg">Monitor and manage user subscriptions</p>
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 bg-primary-800/30 p-2 rounded-xl border border-accent-500/10 w-fit">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-6 py-2.5 rounded-lg font-medium transition-all duration-200 ${
            activeTab === 'all'
              ? 'bg-accent-500 text-neutral-0 shadow-lg'
              : 'text-neutral-400 hover:text-neutral-0 hover:bg-primary-700/50'
          }`}
        >
          All ({statusCounts.all})
        </button>
        <button
          onClick={() => setActiveTab('active')}
          className={`px-6 py-2.5 rounded-lg font-medium transition-all duration-200 ${
            activeTab === 'active'
              ? 'bg-green-500 text-neutral-0 shadow-lg'
              : 'text-neutral-400 hover:text-neutral-0 hover:bg-primary-700/50'
          }`}
        >
          Active ({statusCounts.active})
        </button>
        <button
          onClick={() => setActiveTab('canceled')}
          className={`px-6 py-2.5 rounded-lg font-medium transition-all duration-200 ${
            activeTab === 'canceled'
              ? 'bg-orange-500 text-neutral-0 shadow-lg'
              : 'text-neutral-400 hover:text-neutral-0 hover:bg-primary-700/50'
          }`}
        >
          Canceled ({statusCounts.canceled})
        </button>
      </div>
      
      {/* Subscriptions Table */}
      <div className="bg-gradient-to-br from-primary-700/30 to-primary-800/30 border border-accent-500/10 rounded-xl shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-primary-800/50 border-b border-accent-500/10">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-neutral-200 uppercase tracking-wider">User Email</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-neutral-200 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-neutral-200 uppercase tracking-wider">Period End</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-neutral-200 uppercase tracking-wider">Customer ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-accent-500/10">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-neutral-400">
                    <div className="flex items-center justify-center space-x-2">
                      <div className="w-2 h-2 bg-accent-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-accent-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-accent-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      <span className="ml-2">Loading subscriptions...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredSubscriptions.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-neutral-400">
                    No subscriptions found for this filter
                  </td>
                </tr>
              ) : (
                filteredSubscriptions.map((sub) => (
                  <tr key={sub.id} className="hover:bg-primary-700/20 transition-colors">
                    <td className="px-6 py-4">
                      <div className="text-neutral-0 font-medium">{sub.email}</div>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={sub.subscription_status} />
                    </td>
                    <td className="px-6 py-4 text-neutral-300">
                      {sub.subscription_period_end ? format(new Date(sub.subscription_period_end), 'PPP') : 'N/A'}
                    </td>
                    <td className="px-6 py-4">
                      {sub.customer_id ? (
                        <a
                          href={`https://dashboard.stripe.com/customers/${sub.customer_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-accent-400 hover:text-accent-300 text-sm font-mono"
                        >
                          {sub.customer_id.slice(0, 20)}...
                        </a>
                      ) : (
                        <span className="text-neutral-500">N/A</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
