'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'

export default function PaymentsPage() {
  const [webhookStatus, setWebhookStatus] = useState<any>(null)
  const [failedPayments, setFailedPayments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/payments/webhook-status').then(r => r.json()),
      fetch('/api/admin/payments/failed').then(r => r.json()),
    ]).then(([status, failed]) => {
      setWebhookStatus(status)
      setFailedPayments(failed.failedPayments || [])
      setError(null)
    }).catch((err) => {
      setError('Failed to load payment data. Please try again.')
      console.error('Payment data fetch error:', err)
    }).finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="border-b border-accent-500/20 pb-6">
        <h1 className="text-4xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-neutral-0 to-neutral-200">
          Payment Monitoring
        </h1>
        <p className="text-neutral-300 mt-2 text-lg">Track payment issues and webhook health</p>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start space-x-3">
          <div className="text-red-400 mt-0.5">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <div className="text-red-200 font-medium">{error}</div>
          </div>
        </div>
      )}

      {/* Webhook Status */}
      {webhookStatus && (
        <div className={`p-6 rounded-xl border shadow-lg ${
          webhookStatus.healthy 
            ? 'bg-gradient-to-br from-green-500/10 to-green-600/10 border-green-500/20' 
            : 'bg-gradient-to-br from-red-500/10 to-red-600/10 border-red-500/20'
        }`}>
          <div className="flex items-center space-x-3 mb-3">
            <div className={`w-4 h-4 rounded-full ${
              webhookStatus.healthy ? 'bg-green-400 animate-pulse' : 'bg-red-400'
            }`} />
            <span className="text-neutral-0 font-semibold text-xl">
              Stripe Webhook Status: {webhookStatus.healthy ? 'Healthy' : 'Issues Detected'}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div className="bg-primary-800/30 rounded-lg p-4">
              <div className="text-neutral-400 text-sm uppercase tracking-wide">Success Rate</div>
              <div className="text-neutral-0 text-3xl font-display font-bold mt-1">
                {webhookStatus.successRate}%
              </div>
            </div>
            <div className="bg-primary-800/30 rounded-lg p-4">
              <div className="text-neutral-400 text-sm uppercase tracking-wide">Recent Events</div>
              <div className="text-neutral-0 text-3xl font-display font-bold mt-1">
                {webhookStatus.recentEventsCount}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Failed Payments */}
      <div className="bg-gradient-to-br from-primary-700/30 to-primary-800/30 border border-accent-500/10 rounded-xl p-6 shadow-lg">
        <h2 className="text-neutral-0 font-display text-2xl font-bold mb-6">Failed Payments</h2>
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-8 text-neutral-400">
              <div className="flex items-center justify-center space-x-2">
                <div className="w-2 h-2 bg-accent-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-accent-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-accent-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                <span className="ml-2">Loading payments...</span>
              </div>
            </div>
          ) : failedPayments.length === 0 ? (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10 border border-green-500/20 mb-4">
                <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="text-neutral-300 font-medium text-lg">No failed payments!</div>
              <div className="text-neutral-400 text-sm mt-1">All transactions are processing successfully</div>
            </div>
          ) : (
            failedPayments.map((payment) => (
              <div key={payment.id} className="p-5 bg-gradient-to-br from-red-500/5 to-red-600/5 border border-red-500/20 rounded-lg hover:border-red-500/40 transition-all">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <div className="w-2 h-2 rounded-full bg-red-400"></div>
                      <div className="text-neutral-0 font-semibold">{payment.customerEmail || 'Unknown Customer'}</div>
                    </div>
                    <div className="text-red-300 text-sm bg-red-500/10 px-3 py-1 rounded-lg inline-block">
                      {payment.failureMessage}
                    </div>
                  </div>
                  <div className="text-neutral-400 text-sm whitespace-nowrap ml-4">
                    {format(new Date(payment.createdAt), 'PPp')}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
