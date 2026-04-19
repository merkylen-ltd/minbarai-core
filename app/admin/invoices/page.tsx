'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'

interface Invoice {
  id: string
  recipient_email: string
  org_name: string | null
  amount_cents: number
  currency: string
  status: string
  created_at: string
  due_date: string
  stripe_invoice_url: string | null
  discount_amount_cents: number
  final_amount_cents: number
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchInvoices()
  }, [])

  const fetchInvoices = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/admin/invoices')
      const data = await res.json()
      setInvoices(data.invoices || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch invoices')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-display font-semibold text-neutral-0">Invoices</h1>
        <div className="animate-pulse">Loading...</div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="border-b border-accent-500/20 pb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-neutral-0 to-neutral-200">
              Invoices
            </h1>
            <p className="text-neutral-300 mt-2">Manage and view all invoices</p>
          </div>
          <Link
            href="/admin/setup"
            className="px-6 py-3 rounded-lg font-body bg-accent-500 hover:bg-accent-400 text-neutral-0 transition-all duration-200 shadow-lg"
          >
            + New Client
          </Link>
        </div>
      </div>

      {/* Stats */}
      {invoices.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/10 border border-blue-500/20 rounded-xl p-4 shadow-lg">
            <div className="text-neutral-400 text-xs font-semibold uppercase tracking-wide">Total Invoices</div>
            <div className="text-neutral-0 text-3xl font-display font-bold mt-2">{invoices.length}</div>
          </div>
          <div className="bg-gradient-to-br from-green-500/10 to-green-600/10 border border-green-500/20 rounded-xl p-4 shadow-lg">
            <div className="text-neutral-400 text-xs font-semibold uppercase tracking-wide">Paid</div>
            <div className="text-neutral-0 text-3xl font-display font-bold mt-2">
              {invoices.filter(i => i.status === 'paid').length}
            </div>
          </div>
          <div className="bg-gradient-to-br from-orange-500/10 to-orange-600/10 border border-orange-500/20 rounded-xl p-4 shadow-lg">
            <div className="text-neutral-400 text-xs font-semibold uppercase tracking-wide">Open</div>
            <div className="text-neutral-0 text-3xl font-display font-bold mt-2">
              {invoices.filter(i => i.status === 'open').length}
            </div>
          </div>
          <div className="bg-gradient-to-br from-accent-500/10 to-accent-600/10 border border-accent-500/20 rounded-xl p-4 shadow-lg">
            <div className="text-neutral-400 text-xs font-semibold uppercase tracking-wide">Total Revenue</div>
            <div className="text-neutral-0 text-3xl font-display font-bold mt-2">
              {(invoices.reduce((sum, i) => sum + i.final_amount_cents, 0) / 100).toFixed(0)}
            </div>
          </div>
        </div>
      )}

      {/* Invoices Table */}
      <div className="bg-gradient-to-br from-primary-700/30 to-primary-800/30 border border-accent-500/10 rounded-xl shadow-lg overflow-hidden">
        <div className="p-6 border-b border-accent-500/10">
          <h2 className="text-xl font-heading text-neutral-0">Recent Invoices</h2>
        </div>

        {invoices.length === 0 ? (
          <div className="text-neutral-400 py-12 text-center">
            <p className="mb-4">No invoices yet</p>
            <Link
              href="/admin/setup"
              className="inline-block px-6 py-2 rounded-lg bg-accent-500 hover:bg-accent-400 text-neutral-0 transition-colors"
            >
              Create Your First Invoice
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-primary-800/50 border-b border-accent-500/10">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-300 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-300 uppercase tracking-wider">Org</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-neutral-300 uppercase tracking-wider">Amount</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-300 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-300 uppercase tracking-wider">Created</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-300 uppercase tracking-wider">Due</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-300 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-accent-500/10">
                {invoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-primary-700/20 transition-colors">
                    <td className="px-6 py-4 text-neutral-0 font-medium text-sm">{invoice.recipient_email}</td>
                    <td className="px-6 py-4 text-neutral-300 text-sm">{invoice.org_name || '–'}</td>
                    <td className="px-6 py-4 text-right font-mono text-neutral-0 text-sm">
                      {(invoice.final_amount_cents / 100).toFixed(2)} {invoice.currency.toUpperCase()}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          invoice.status === 'paid'
                            ? 'bg-green-500/20 text-green-300'
                            : invoice.status === 'void'
                              ? 'bg-gray-500/20 text-gray-300'
                              : 'bg-blue-500/20 text-blue-300'
                        }`}
                      >
                        {invoice.status === 'paid' ? '✓ Paid' : invoice.status === 'void' ? '✗ Void' : '○ Open'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-neutral-300 text-xs">{format(new Date(invoice.created_at), 'MMM d')}</td>
                    <td className="px-6 py-4 text-neutral-300 text-xs">{format(new Date(invoice.due_date), 'MMM d')}</td>
                    <td className="px-6 py-4 text-sm space-x-2">
                      <Link
                        href={`/admin/invoices/${invoice.id}`}
                        className="text-accent-400 hover:text-accent-300 underline"
                      >
                        View
                      </Link>
                      {invoice.stripe_invoice_url && (
                        <a
                          href={invoice.stripe_invoice_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-accent-400 hover:text-accent-300 underline"
                        >
                          Stripe
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-300 rounded-lg flex items-start gap-3">
          <span className="text-lg">⚠️</span>
          <span>{error}</span>
        </div>
      )}
    </div>
  )
}
