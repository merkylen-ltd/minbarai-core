'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import LoadingButton from '@/components/forms/LoadingButton'

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
}

interface CreateFormState {
  recipientEmail: string
  orgName: string
  amount: string
  currency: string
  description: string
  durationDays: string
  sessionLimitMinutes: string
  dueDate: string
  promoCodeId: string
  isLoading: boolean
  error: string
  success: false | string
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [formState, setFormState] = useState<CreateFormState>({
    recipientEmail: '',
    orgName: '',
    amount: '',
    currency: 'eur',
    description: '',
    durationDays: '30',
    sessionLimitMinutes: '120',
    dueDate: '',
    promoCodeId: '',
    isLoading: false,
    error: '',
    success: false,
  })

  useEffect(() => {
    fetchInvoices()
  }, [])

  // Set default due date to 7 days from now
  useEffect(() => {
    if (!formState.dueDate) {
      const dueDate = new Date()
      dueDate.setDate(dueDate.getDate() + 7)
      setFormState(prev => ({
        ...prev,
        dueDate: dueDate.toISOString().split('T')[0],
      }))
    }
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormState(prev => ({
      ...prev,
      [name]: value,
      error: '',
      success: false,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormState(prev => ({ ...prev, isLoading: true, error: '', success: false }))

    try {
      const daysUntilDue = Math.ceil(
        (new Date(formState.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      )

      const res = await fetch('/api/admin/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientEmail: formState.recipientEmail,
          orgName: formState.orgName || null,
          amount: parseFloat(formState.amount),
          currency: formState.currency,
          description: formState.description,
          durationDays: parseInt(formState.durationDays, 10),
          sessionLimitMinutes: parseInt(formState.sessionLimitMinutes, 10),
          dueDate: formState.dueDate,
          promoCodeId: formState.promoCodeId || null,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create invoice')
      }

      setFormState(prev => ({
        ...prev,
        success: `Invoice created successfully! URL: ${data.hostedInvoiceUrl}`,
        recipientEmail: '',
        orgName: '',
        amount: '',
        description: '',
        promoCodeId: '',
      }))

      // Refresh invoices
      await fetchInvoices()
      setTimeout(() => setShowForm(false), 2000)
    } catch (err) {
      setFormState(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to create invoice',
      }))
    } finally {
      setFormState(prev => ({ ...prev, isLoading: false }))
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
            <p className="text-neutral-300 mt-2">Manage custom invoices for organizations</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="btn-primary"
          >
            {showForm ? 'Cancel' : 'Create Invoice'}
          </button>
        </div>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="bg-primary-700/30 border border-accent-500/20 rounded-lg p-6 space-y-4">
          <h2 className="text-xl font-heading text-neutral-0">Create New Invoice</h2>
          
          {formState.error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-300 rounded-lg text-sm">
              {formState.error}
            </div>
          )}

          {formState.success && (
            <div className="p-3 bg-green-500/10 border border-green-500/20 text-green-300 rounded-lg text-sm">
              {formState.success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <input
                type="email"
                name="recipientEmail"
                placeholder="Recipient Email"
                value={formState.recipientEmail}
                onChange={handleInputChange}
                required
                className="input-field"
              />
              <input
                type="text"
                name="orgName"
                placeholder="Organization Name (optional)"
                value={formState.orgName}
                onChange={handleInputChange}
                className="input-field"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <input
                type="number"
                name="amount"
                placeholder="Amount (e.g., 150)"
                step="0.01"
                value={formState.amount}
                onChange={handleInputChange}
                required
                className="input-field"
              />
              <select
                name="currency"
                value={formState.currency}
                onChange={handleInputChange}
                className="input-field"
              >
                <option value="eur">EUR</option>
                <option value="usd">USD</option>
                <option value="gbp">GBP</option>
              </select>
              <input
                type="date"
                name="dueDate"
                value={formState.dueDate}
                onChange={handleInputChange}
                required
                className="input-field"
              />
            </div>

            <textarea
              name="description"
              placeholder="Invoice Description"
              value={formState.description}
              onChange={handleInputChange}
              required
              rows={2}
              className="input-field resize-none"
            />

            <div className="grid grid-cols-2 gap-4">
              <input
                type="number"
                name="durationDays"
                placeholder="Duration (days)"
                value={formState.durationDays}
                onChange={handleInputChange}
                required
                className="input-field"
              />
              <input
                type="number"
                name="sessionLimitMinutes"
                placeholder="Session Limit (minutes)"
                value={formState.sessionLimitMinutes}
                onChange={handleInputChange}
                required
                className="input-field"
              />
            </div>

            <input
              type="text"
              name="promoCodeId"
              placeholder="Promo Code ID (optional)"
              value={formState.promoCodeId}
              onChange={handleInputChange}
              className="input-field"
            />

            <LoadingButton
              onClick={() => {}}
              isLoading={formState.isLoading}
              className="btn-primary w-full"
              type="submit"
            >
              Create Invoice
            </LoadingButton>
          </form>
        </div>
      )}

      {/* Invoices Table */}
      <div className="bg-primary-700/30 border border-accent-500/20 rounded-lg p-6 overflow-hidden">
        <h2 className="text-xl font-heading text-neutral-0 mb-4">Recent Invoices</h2>

        {invoices.length === 0 ? (
          <div className="text-neutral-400 py-8 text-center">No invoices yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-primary-800/50 border-b border-accent-500/10">
                <tr>
                  <th className="px-4 py-3 text-left text-neutral-300 font-semibold">Email</th>
                  <th className="px-4 py-3 text-left text-neutral-300 font-semibold">Organization</th>
                  <th className="px-4 py-3 text-right text-neutral-300 font-semibold">Amount</th>
                  <th className="px-4 py-3 text-left text-neutral-300 font-semibold">Status</th>
                  <th className="px-4 py-3 text-left text-neutral-300 font-semibold">Created</th>
                  <th className="px-4 py-3 text-left text-neutral-300 font-semibold">Due</th>
                  <th className="px-4 py-3 text-left text-neutral-300 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-accent-500/10">
                {invoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-primary-700/20 transition-colors">
                    <td className="px-4 py-3 text-neutral-0 font-medium text-sm">{invoice.recipient_email}</td>
                    <td className="px-4 py-3 text-neutral-300 text-sm">{invoice.org_name || '-'}</td>
                    <td className="px-4 py-3 text-right font-mono text-neutral-0">
                      {(invoice.amount_cents / 100).toFixed(2)} {invoice.currency.toUpperCase()}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        invoice.status === 'paid' ? 'bg-green-500/20 text-green-300' :
                        invoice.status === 'void' ? 'bg-gray-500/20 text-gray-300' :
                        'bg-blue-500/20 text-blue-300'
                      }`}>
                        {invoice.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-neutral-300 text-xs">
                      {format(new Date(invoice.created_at), 'MMM d, HH:mm')}
                    </td>
                    <td className="px-4 py-3 text-neutral-300 text-xs">
                      {format(new Date(invoice.due_date), 'MMM d')}
                    </td>
                    <td className="px-4 py-3 text-sm space-x-2">
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
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-300 rounded-lg">
          {error}
        </div>
      )}
    </div>
  )
}
