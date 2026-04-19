'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { ArrowLeft } from 'lucide-react'
import LoadingButton from '@/components/forms/LoadingButton'
import AdminLayout from '@/components/admin/AdminLayout'

interface InvoiceDetail {
  id: string
  recipient_email: string
  org_name: string | null
  amount_cents: number
  currency: string
  description: string
  duration_days: number
  session_limit_minutes: number
  status: string
  created_at: string
  due_date: string
  stripe_invoice_url: string | null
  stripe_invoice_id: string | null
  discount_amount_cents: number
  final_amount_cents: number
  activated_at: string | null
  supabase_user_id: string | null
}

export default function InvoiceDetailPage({ params }: { params: { id: string } }) {
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [action, setAction] = useState<'resend' | 'void' | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    fetchInvoice()
  }, [])

  const fetchInvoice = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/admin/invoices/${params.id}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to fetch invoice')
      setInvoice(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch invoice')
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    if (!confirm('Resend invoice email to recipient?')) return
    setActionLoading(true)
    try {
      const res = await fetch(`/api/admin/invoices/${params.id}/resend`, {
        method: 'POST',
      })
      if (!res.ok) throw new Error('Failed to resend invoice')
      alert('Invoice email sent successfully')
      await fetchInvoice()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to resend invoice')
    } finally {
      setActionLoading(false)
    }
  }

  const handleVoid = async () => {
    if (!confirm('Void this invoice? This cannot be undone.')) return
    setActionLoading(true)
    try {
      const res = await fetch(`/api/admin/invoices/${params.id}/void`, {
        method: 'POST',
      })
      if (!res.ok) throw new Error('Failed to void invoice')
      alert('Invoice voided successfully')
      await fetchInvoice()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to void invoice')
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="space-y-6">
          <Link
            href="/admin/invoices"
            className="inline-flex items-center gap-2 text-accent-400 hover:text-accent-300"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Invoices
          </Link>
          <div className="animate-pulse">Loading...</div>
        </div>
      </AdminLayout>
    )
  }

  if (!invoice) {
    return (
      <AdminLayout>
        <div className="space-y-6">
          <Link
            href="/admin/invoices"
            className="inline-flex items-center gap-2 text-accent-400 hover:text-accent-300"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Invoices
          </Link>
          <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-300 rounded-lg">
            Invoice not found or failed to load
          </div>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <Link
            href="/admin/invoices"
            className="inline-flex items-center gap-2 text-accent-400 hover:text-accent-300 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Invoices
          </Link>
          <div className="border-b border-accent-500/20 pb-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-4xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-neutral-0 to-neutral-200">
                  Invoice {invoice.id.slice(0, 8)}
                </h1>
                <p className="text-neutral-300 mt-2">{invoice.recipient_email}</p>
              </div>
              <div className="text-right">
                <div className={`px-4 py-2 rounded-full font-semibold inline-block ${
                  invoice.status === 'paid' ? 'bg-green-500/20 text-green-300' :
                  invoice.status === 'void' ? 'bg-gray-500/20 text-gray-300' :
                  'bg-blue-500/20 text-blue-300'
                }`}>
                  {invoice.status === 'paid' ? '✓ Paid' : invoice.status === 'void' ? '✗ Void' : '○ Open'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-300 rounded-lg flex items-start gap-3">
            <span className="text-lg">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Recipient Info */}
          <div className="bg-gradient-to-br from-primary-700/30 to-primary-800/30 border border-accent-500/10 rounded-xl p-6">
            <h2 className="text-lg font-heading text-neutral-0 mb-4">Recipient</h2>
            <div className="space-y-3">
              <div>
                <span className="text-neutral-400 text-sm">Email</span>
                <div className="text-neutral-0 font-mono">{invoice.recipient_email}</div>
              </div>
              {invoice.org_name && (
                <div>
                  <span className="text-neutral-400 text-sm">Organization</span>
                  <div className="text-neutral-0">{invoice.org_name}</div>
                </div>
              )}
            </div>
          </div>

          {/* Amount Info */}
          <div className="bg-gradient-to-br from-primary-700/30 to-primary-800/30 border border-accent-500/10 rounded-xl p-6">
            <h2 className="text-lg font-heading text-neutral-0 mb-4">Amount</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-neutral-400">Subtotal</span>
                <span className="text-neutral-0 font-mono">
                  {(invoice.amount_cents / 100).toFixed(2)} {invoice.currency.toUpperCase()}
                </span>
              </div>
              {invoice.discount_amount_cents > 0 && (
                <div className="flex justify-between text-green-300">
                  <span>Discount</span>
                  <span className="font-mono">-{(invoice.discount_amount_cents / 100).toFixed(2)}</span>
                </div>
              )}
              <div className="border-t border-accent-500/20 pt-3 flex justify-between font-bold text-lg">
                <span>Total</span>
                <span className="text-neutral-0 font-mono">
                  {(invoice.final_amount_cents / 100).toFixed(2)} {invoice.currency.toUpperCase()}
                </span>
              </div>
            </div>
          </div>

          {/* Service Details */}
          <div className="bg-gradient-to-br from-primary-700/30 to-primary-800/30 border border-accent-500/10 rounded-xl p-6">
            <h2 className="text-lg font-heading text-neutral-0 mb-4">Service</h2>
            <div className="space-y-3">
              <div>
                <span className="text-neutral-400 text-sm">Description</span>
                <div className="text-neutral-0">{invoice.description}</div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-neutral-400 text-sm">Duration</span>
                  <div className="text-neutral-0">{invoice.duration_days} days</div>
                </div>
                <div>
                  <span className="text-neutral-400 text-sm">Session Limit</span>
                  <div className="text-neutral-0">{invoice.session_limit_minutes} min/month</div>
                </div>
              </div>
            </div>
          </div>

          {/* Dates */}
          <div className="bg-gradient-to-br from-primary-700/30 to-primary-800/30 border border-accent-500/10 rounded-xl p-6">
            <h2 className="text-lg font-heading text-neutral-0 mb-4">Dates</h2>
            <div className="space-y-3">
              <div>
                <span className="text-neutral-400 text-sm">Created</span>
                <div className="text-neutral-0">{format(new Date(invoice.created_at), 'MMM d, yyyy')}</div>
              </div>
              <div>
                <span className="text-neutral-400 text-sm">Due</span>
                <div className="text-neutral-0">{format(new Date(invoice.due_date), 'MMM d, yyyy')}</div>
              </div>
              {invoice.activated_at && (
                <div>
                  <span className="text-neutral-400 text-sm">Activated</span>
                  <div className="text-green-300">{format(new Date(invoice.activated_at), 'MMM d, yyyy')}</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Stripe Link */}
        {invoice.stripe_invoice_url && (
          <div className="bg-gradient-to-br from-primary-700/30 to-primary-800/30 border border-accent-500/10 rounded-xl p-6">
            <h2 className="text-lg font-heading text-neutral-0 mb-4">Stripe</h2>
            <a
              href={invoice.stripe_invoice_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-4 py-2 bg-accent-500 hover:bg-accent-400 text-neutral-0 rounded-lg transition-colors"
            >
              View on Stripe Dashboard →
            </a>
          </div>
        )}

        {/* Actions */}
        {invoice.status === 'open' && (
          <div className="bg-gradient-to-br from-primary-700/30 to-primary-800/30 border border-accent-500/10 rounded-xl p-6 space-y-4">
            <h2 className="text-lg font-heading text-neutral-0">Actions</h2>
            <div className="flex gap-3">
              <LoadingButton
                isLoading={actionLoading && action === 'resend'}
                onClick={handleResend}
                className="px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-400 text-neutral-0 transition-colors"
              >
                Resend Email
              </LoadingButton>
              <LoadingButton
                isLoading={actionLoading && action === 'void'}
                onClick={handleVoid}
                className="px-4 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 transition-colors"
              >
                Void Invoice
              </LoadingButton>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
