'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { ArrowLeft } from 'lucide-react'
import LoadingButton from '@/components/forms/LoadingButton'

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
  const [stripeStatus, setStripeStatus] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [action, setAction] = useState<'resend' | 'void' | 'sync' | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)

  useEffect(() => {
    fetchInvoice()
  }, [])

  const fetchInvoice = async () => {
    try {
      setLoading(true)
      setError('')
      const res = await fetch(`/api/admin/invoices/${params.id}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to fetch invoice')
      // API returns { invoice: {...} } — unwrap it.
      const payload = data.invoice ?? data
      if (!payload || !payload.id) {
        throw new Error('Invoice not found')
      }
      setInvoice(payload as InvoiceDetail)
      setStripeStatus(payload.stripeStatus ?? null)
      if (payload.reconciled) {
        setSyncMessage('✓ Status auto-reconciled from Stripe (open → paid)')
        setTimeout(() => setSyncMessage(null), 5000)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch invoice')
      setInvoice(null)
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    if (!confirm('Resend invoice email to recipient?')) return
    setAction('resend')
    setActionLoading(true)
    try {
      const res = await fetch(`/api/admin/invoices/${params.id}/resend`, {
        method: 'POST',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to resend invoice')
      alert('Invoice email sent successfully')
      await fetchInvoice()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to resend invoice')
    } finally {
      setActionLoading(false)
      setAction(null)
    }
  }

  const handleVoid = async () => {
    if (!confirm('Void this invoice? This cannot be undone.')) return
    setAction('void')
    setActionLoading(true)
    try {
      const res = await fetch(`/api/admin/invoices/${params.id}/void`, {
        method: 'POST',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to void invoice')
      const detail = data.isBulk
        ? `Invoice voided. Suspended ${data.suspendedCount} child account(s).`
        : 'Invoice voided successfully.'
      alert(detail)
      await fetchInvoice()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to void invoice')
    } finally {
      setActionLoading(false)
      setAction(null)
    }
  }

  const handleSync = async () => {
    setAction('sync')
    setActionLoading(true)
    setSyncMessage(null)
    try {
      const res = await fetch(`/api/admin/invoices/${params.id}/sync`, {
        method: 'POST',
      })
      const data = await res.json().catch(() => ({}))
      if (res.status === 409) {
        setSyncMessage(`⚠ ${data.message || 'Status mismatch — manual review required'}`)
        return
      }
      if (!res.ok) {
        throw new Error(data.error || 'Failed to sync invoice')
      }
      if (data.alreadyInSync) {
        setSyncMessage(`✓ Already in sync (${data.dbStatus})`)
      } else if (data.reconciled) {
        setSyncMessage(
          `✓ Reconciled. Activated ${data.newlyActivated?.length || 0} account(s)${
            data.failed?.length ? `, ${data.failed.length} failed` : ''
          }`,
        )
      }
      await fetchInvoice()
    } catch (err) {
      setSyncMessage(`✗ ${err instanceof Error ? err.message : 'Sync failed'}`)
    } finally {
      setActionLoading(false)
      setAction(null)
    }
  }

  if (loading) {
    return (
      <div className="space-y-8">
        <Link
          href="/admin/invoices"
          className="inline-flex items-center gap-2 text-accent-400 hover:text-accent-300"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Invoices
        </Link>
        <div className="border-b border-accent-500/20 pb-6 animate-pulse">
          <div className="h-10 w-72 bg-primary-700/50 rounded-lg mb-3" />
          <div className="h-4 w-48 bg-primary-700/40 rounded" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-pulse">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="bg-gradient-to-br from-primary-700/30 to-primary-800/30 border border-accent-500/10 rounded-xl p-6 space-y-3"
            >
              <div className="h-5 w-24 bg-primary-700/50 rounded" />
              <div className="h-4 w-full bg-primary-700/40 rounded" />
              <div className="h-4 w-3/4 bg-primary-700/40 rounded" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!invoice) {
    return (
      <div className="space-y-6">
        <Link
          href="/admin/invoices"
          className="inline-flex items-center gap-2 text-accent-400 hover:text-accent-300"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Invoices
        </Link>
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-300 rounded-lg flex items-start gap-3">
          <span className="text-lg">⚠️</span>
          <span>{error || 'Invoice not found or failed to load'}</span>
        </div>
      </div>
    )
  }

  return (
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

        {/* Sync message */}
        {syncMessage && (
          <div className={`p-4 rounded-lg flex items-start gap-3 border ${
            syncMessage.startsWith('✓')
              ? 'bg-green-500/10 border-green-500/20 text-green-300'
              : syncMessage.startsWith('⚠')
              ? 'bg-amber-500/10 border-amber-500/20 text-amber-300'
              : 'bg-red-500/10 border-red-500/20 text-red-300'
          }`}>
            <span className="text-sm">{syncMessage}</span>
          </div>
        )}

        {/* Stripe status mismatch warning */}
        {stripeStatus && stripeStatus !== invoice.status && (
          <div className="p-4 bg-amber-500/10 border border-amber-500/20 text-amber-300 rounded-lg flex items-start gap-3">
            <span className="text-lg">⚠️</span>
            <div className="flex-1">
              <p className="font-semibold">Status mismatch</p>
              <p className="text-sm mt-1">
                MinbarAI shows <strong>{invoice.status}</strong> but Stripe shows <strong>{stripeStatus}</strong>.
                Click <strong>Sync from Stripe</strong> below to reconcile.
              </p>
            </div>
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
        <div className="bg-gradient-to-br from-primary-700/30 to-primary-800/30 border border-accent-500/10 rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-heading text-neutral-0">Actions</h2>
          <div className="flex gap-3 flex-wrap">
            <LoadingButton
              isLoading={actionLoading && action === 'sync'}
              onClick={handleSync}
              className="px-4 py-2 rounded-lg bg-primary-700 hover:bg-primary-600 text-neutral-100 border border-accent-500/20 transition-colors"
            >
              {actionLoading && action === 'sync' ? 'Syncing…' : '🔄 Sync from Stripe'}
            </LoadingButton>
            {invoice.status === 'open' && (
              <>
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
              </>
            )}
          </div>
        </div>
      </div>
  )
}
