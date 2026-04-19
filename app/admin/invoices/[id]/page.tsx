'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import LoadingButton from '@/components/forms/LoadingButton'

interface Invoice {
  id: string
  created_by_email: string
  recipient_email: string
  org_name: string | null
  amount_cents: number
  currency: string
  description: string
  duration_days: number
  session_limit_minutes: number
  discount_amount_cents: number
  final_amount_cents: number
  stripe_customer_id: string | null
  stripe_invoice_id: string
  stripe_invoice_url: string | null
  status: string
  activated_at: string | null
  supabase_user_id: string | null
  created_at: string
  due_date: string
  stripeStatus?: string
  stripePaid?: boolean
  stripeAmountDue?: number
}

export default function InvoiceDetailPage({ params }: { params: { id: string } }) {
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState('')
  const router = useRouter()

  useEffect(() => {
    fetchInvoice()
  }, [params.id])

  const fetchInvoice = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/admin/invoices/${params.id}`)
      if (!res.ok) {
        throw new Error('Invoice not found')
      }
      const data = await res.json()
      setInvoice(data.invoice)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch invoice')
    } finally {
      setLoading(false)
    }
  }

  const handleVoid = async () => {
    if (!confirm('Are you sure you want to void this invoice?')) return

    setActionLoading(true)
    setActionError('')

    try {
      const res = await fetch(`/api/admin/invoices/${params.id}/void`, {
        method: 'POST',
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to void invoice')
      }

      setActionLoading(false)
      await fetchInvoice()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to void invoice')
      setActionLoading(false)
    }
  }

  const handleResend = async () => {
    setActionLoading(true)
    setActionError('')

    try {
      const res = await fetch(`/api/admin/invoices/${params.id}/resend`, {
        method: 'POST',
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to resend invoice')
      }

      setActionError('Invoice resent successfully')
      setActionLoading(false)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to resend invoice')
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-display font-semibold text-neutral-0">Invoice Detail</h1>
        <div className="animate-pulse">Loading...</div>
      </div>
    )
  }

  if (!invoice || error) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-display font-semibold text-neutral-0">Invoice Detail</h1>
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-300 rounded-lg">
          {error || 'Invoice not found'}
        </div>
        <Link href="/admin/invoices" className="text-accent-400 hover:text-accent-300 underline">
          Back to Invoices
        </Link>
      </div>
    )
  }

  const discountPercent = invoice.amount_cents > 0 
    ? ((invoice.discount_amount_cents / invoice.amount_cents) * 100).toFixed(1)
    : '0'

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="border-b border-accent-500/20 pb-6 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-neutral-0 to-neutral-200">
            Invoice Details
          </h1>
          <p className="text-neutral-300 mt-2">ID: {invoice.id}</p>
        </div>
        <Link href="/admin/invoices" className="text-accent-400 hover:text-accent-300 underline">
          Back to List
        </Link>
      </div>

      {/* Status Badge */}
      <div className="flex items-center gap-4">
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
          invoice.status === 'paid' ? 'bg-green-500/20 text-green-300' :
          invoice.status === 'void' ? 'bg-gray-500/20 text-gray-300' :
          'bg-blue-500/20 text-blue-300'
        }`}>
          {invoice.status.toUpperCase()}
        </span>
        {invoice.activated_at && (
          <span className="px-3 py-1 rounded-full text-sm font-medium bg-accent-500/20 text-accent-300">
            Activated: {format(new Date(invoice.activated_at), 'MMM d, HH:mm')}
          </span>
        )}
      </div>

      {/* Error Message */}
      {actionError && (
        <div className={`p-4 rounded-lg border ${
          actionError.includes('successfully')
            ? 'bg-green-500/10 border-green-500/20 text-green-300'
            : 'bg-red-500/10 border-red-500/20 text-red-300'
        }`}>
          {actionError}
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Recipient & Amount */}
        <div className="bg-primary-700/30 border border-accent-500/20 rounded-lg p-6 space-y-4">
          <h2 className="text-lg font-heading text-neutral-0">Recipient</h2>
          
          <div>
            <div className="text-neutral-400 text-sm">Email</div>
            <div className="text-neutral-0 font-mono">{invoice.recipient_email}</div>
          </div>

          {invoice.org_name && (
            <div>
              <div className="text-neutral-400 text-sm">Organization</div>
              <div className="text-neutral-0">{invoice.org_name}</div>
            </div>
          )}

          <div className="border-t border-accent-500/10 pt-4">
            <div className="text-neutral-400 text-sm mb-2">Amount</div>
            <div className="text-3xl font-display text-neutral-0">
              {(invoice.final_amount_cents / 100).toFixed(2)} {invoice.currency.toUpperCase()}
            </div>
            {invoice.discount_amount_cents > 0 && (
              <div className="text-sm text-green-300 mt-1">
                {discountPercent}% discount ({(invoice.discount_amount_cents / 100).toFixed(2)} off)
              </div>
            )}
            <div className="text-xs text-neutral-500 mt-1">
              Original: {(invoice.amount_cents / 100).toFixed(2)} {invoice.currency.toUpperCase()}
            </div>
          </div>

          <div className="border-t border-accent-500/10 pt-4">
            <div className="text-neutral-400 text-sm mb-2">Description</div>
            <div className="text-neutral-0">{invoice.description}</div>
          </div>
        </div>

        {/* Right Column - Subscription & Dates */}
        <div className="bg-primary-700/30 border border-accent-500/20 rounded-lg p-6 space-y-4">
          <h2 className="text-lg font-heading text-neutral-0">Subscription Details</h2>
          
          <div>
            <div className="text-neutral-400 text-sm">Duration</div>
            <div className="text-neutral-0">{invoice.duration_days} days</div>
          </div>

          <div>
            <div className="text-neutral-400 text-sm">Session Limit</div>
            <div className="text-neutral-0">{invoice.session_limit_minutes} minutes/month</div>
          </div>

          <div className="border-t border-accent-500/10 pt-4">
            <div className="text-neutral-400 text-sm mb-2">Important Dates</div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-neutral-400">Created</span>
                <span className="text-neutral-0">{format(new Date(invoice.created_at), 'MMM d, yyyy HH:mm')}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-neutral-400">Due</span>
                <span className="text-neutral-0">{format(new Date(invoice.due_date), 'MMM d, yyyy')}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-neutral-400">Created By</span>
                <span className="text-neutral-0 font-mono">{invoice.created_by_email}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stripe Information */}
      <div className="bg-primary-700/30 border border-accent-500/20 rounded-lg p-6 space-y-4">
        <h2 className="text-lg font-heading text-neutral-0">Stripe Status</h2>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-neutral-400 text-sm">Invoice ID</div>
            <div className="text-neutral-0 font-mono text-xs break-all">{invoice.stripe_invoice_id}</div>
          </div>
          
          {invoice.stripe_customer_id && (
            <div>
              <div className="text-neutral-400 text-sm">Customer ID</div>
              <div className="text-neutral-0 font-mono text-xs">{invoice.stripe_customer_id}</div>
            </div>
          )}

          <div>
            <div className="text-neutral-400 text-sm">Stripe Status</div>
            <div className="text-neutral-0">{invoice.stripeStatus || 'Unknown'}</div>
          </div>

          {invoice.stripePaid !== undefined && (
            <div>
              <div className="text-neutral-400 text-sm">Paid</div>
              <div className={invoice.stripePaid ? 'text-green-300' : 'text-neutral-0'}>
                {invoice.stripePaid ? 'Yes' : 'No'}
              </div>
            </div>
          )}
        </div>

        {invoice.stripe_invoice_url && (
          <div className="pt-2">
            <a
              href={invoice.stripe_invoice_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent-400 hover:text-accent-300 underline text-sm"
            >
              View on Stripe Dashboard →
            </a>
          </div>
        )}
      </div>

      {/* Activation Status */}
      {invoice.activated_at && invoice.supabase_user_id && (
        <div className="bg-primary-700/30 border border-accent-500/20 rounded-lg p-6 space-y-4">
          <h2 className="text-lg font-heading text-neutral-0">Account Activation</h2>
          
          <div>
            <div className="text-neutral-400 text-sm">Activated At</div>
            <div className="text-neutral-0">{format(new Date(invoice.activated_at), 'MMM d, yyyy HH:mm:ss')}</div>
          </div>

          <div>
            <div className="text-neutral-400 text-sm">Supabase User ID</div>
            <div className="text-neutral-0 font-mono text-xs">{invoice.supabase_user_id}</div>
          </div>
        </div>
      )}

      {/* Actions */}
      {invoice.status === 'open' && (
        <div className="bg-primary-700/30 border border-accent-500/20 rounded-lg p-6 space-y-4">
          <h2 className="text-lg font-heading text-neutral-0">Actions</h2>
          
          <div className="flex gap-3">
            <LoadingButton
              onClick={handleResend}
              isLoading={actionLoading}
              className="btn-primary"
            >
              Resend Email
            </LoadingButton>

            <button
              onClick={handleVoid}
              disabled={actionLoading}
              className="px-4 py-2 rounded-lg font-body bg-red-500/20 text-red-300 hover:bg-red-500/30 transition-colors disabled:opacity-50"
            >
              Void Invoice
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
