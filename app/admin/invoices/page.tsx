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
  discount_amount_cents: number
  final_amount_cents: number
}

interface PromoCode {
  id: string
  code: string
  amount_off_cents: number | null
  percent_off: number | null
  currency: string | null
  is_active: boolean
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
  discountPreview: { valid: boolean; savingsAmount: number; finalAmount: number } | null
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([])
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
    discountPreview: null,
  })

  useEffect(() => {
    fetchInvoices()
    fetchPromoCodes()
  }, [])

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

  useEffect(() => {
    if (formState.promoCodeId && formState.amount) {
      validateDiscount()
    } else {
      setFormState(prev => ({ ...prev, discountPreview: null }))
    }
  }, [formState.promoCodeId, formState.amount, formState.currency])

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

  const fetchPromoCodes = async () => {
    try {
      const res = await fetch('/api/admin/promo-codes')
      const data = await res.json()
      setPromoCodes(data.codes || [])
    } catch (err) {
      console.error('Failed to fetch promo codes:', err)
    }
  }

  const validateDiscount = async () => {
    try {
      const amountCents = Math.round(parseFloat(formState.amount) * 100)
      const res = await fetch(
        `/api/admin/promo-codes/validate?code=${formState.promoCodeId}&currency=${formState.currency}&amountCents=${amountCents}`
      )
      const data = await res.json()
      if (data.valid) {
        setFormState(prev => ({
          ...prev,
          discountPreview: {
            valid: true,
            savingsAmount: data.savingsAmount,
            finalAmount: data.finalAmount,
          },
        }))
      } else {
        setFormState(prev => ({ ...prev, discountPreview: { valid: false, savingsAmount: 0, finalAmount: 0 } }))
      }
    } catch (err) {
      console.error('Failed to validate discount:', err)
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
        success: `✓ Invoice created successfully!`,
        recipientEmail: '',
        orgName: '',
        amount: '',
        description: '',
        promoCodeId: '',
      }))

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
            className="px-6 py-3 rounded-lg font-body bg-accent-500 hover:bg-accent-400 text-neutral-0 transition-all duration-200 shadow-lg"
          >
            {showForm ? 'Cancel' : '+ Create Invoice'}
          </button>
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
            <div className="text-neutral-0 text-3xl font-display font-bold mt-2">{invoices.filter(i => i.status === 'paid').length}</div>
          </div>
          <div className="bg-gradient-to-br from-orange-500/10 to-orange-600/10 border border-orange-500/20 rounded-xl p-4 shadow-lg">
            <div className="text-neutral-400 text-xs font-semibold uppercase tracking-wide">Open</div>
            <div className="text-neutral-0 text-3xl font-display font-bold mt-2">{invoices.filter(i => i.status === 'open').length}</div>
          </div>
          <div className="bg-gradient-to-br from-accent-500/10 to-accent-600/10 border border-accent-500/20 rounded-xl p-4 shadow-lg">
            <div className="text-neutral-400 text-xs font-semibold uppercase tracking-wide">Total Revenue</div>
            <div className="text-neutral-0 text-3xl font-display font-bold mt-2">
              {(invoices.reduce((sum, i) => sum + i.final_amount_cents, 0) / 100).toFixed(0)}
            </div>
          </div>
        </div>
      )}

      {/* Create Form */}
      {showForm && (
        <div className="bg-gradient-to-br from-primary-700/30 to-primary-800/30 border border-accent-500/10 rounded-xl p-8 space-y-6 shadow-lg">
          <h2 className="text-xl font-heading text-neutral-0">Create New Invoice</h2>

          {formState.error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-300 rounded-lg text-sm flex items-start gap-3">
              <span className="text-lg">⚠️</span>
              <span>{formState.error}</span>
            </div>
          )}

          {formState.success && (
            <div className="p-4 bg-green-500/10 border border-green-500/20 text-green-300 rounded-lg text-sm flex items-start gap-3">
              <span className="text-lg">{formState.success}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Row 1 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-neutral-300 mb-2">Recipient Email *</label>
                <input
                  type="email"
                  name="recipientEmail"
                  placeholder="test@mosque.org"
                  value={formState.recipientEmail}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-3 bg-primary-800/50 border border-accent-500/20 rounded-lg text-neutral-0 placeholder-neutral-500 focus:outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm text-neutral-300 mb-2">Organization Name</label>
                <input
                  type="text"
                  name="orgName"
                  placeholder="Mosque of Peace"
                  value={formState.orgName}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-primary-800/50 border border-accent-500/20 rounded-lg text-neutral-0 placeholder-neutral-500 focus:outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 transition-all"
                />
              </div>
            </div>

            {/* Row 2 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-neutral-300 mb-2">Amount *</label>
                <input
                  type="number"
                  name="amount"
                  placeholder="150"
                  step="0.01"
                  value={formState.amount}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-3 bg-primary-800/50 border border-accent-500/20 rounded-lg text-neutral-0 placeholder-neutral-500 focus:outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm text-neutral-300 mb-2">Currency *</label>
                <select
                  name="currency"
                  value={formState.currency}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-primary-800/50 border border-accent-500/20 rounded-lg text-neutral-0 focus:outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 transition-all"
                >
                  <option value="eur">EUR (€)</option>
                  <option value="usd">USD ($)</option>
                  <option value="gbp">GBP (£)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-neutral-300 mb-2">Due Date *</label>
                <input
                  type="date"
                  name="dueDate"
                  value={formState.dueDate}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-3 bg-primary-800/50 border border-accent-500/20 rounded-lg text-neutral-0 focus:outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 transition-all"
                />
              </div>
            </div>

            {/* Row 3 */}
            <div>
              <label className="block text-sm text-neutral-300 mb-2">Description *</label>
              <textarea
                name="description"
                placeholder="Describe what this invoice is for..."
                value={formState.description}
                onChange={handleInputChange}
                required
                rows={3}
                className="w-full px-4 py-3 bg-primary-800/50 border border-accent-500/20 rounded-lg text-neutral-0 placeholder-neutral-500 focus:outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 transition-all resize-none"
              />
            </div>

            {/* Row 4 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-neutral-300 mb-2">Duration (Days) *</label>
                <input
                  type="number"
                  name="durationDays"
                  placeholder="30"
                  value={formState.durationDays}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-3 bg-primary-800/50 border border-accent-500/20 rounded-lg text-neutral-0 placeholder-neutral-500 focus:outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm text-neutral-300 mb-2">Session Limit (minutes/month) *</label>
                <input
                  type="number"
                  name="sessionLimitMinutes"
                  placeholder="120"
                  value={formState.sessionLimitMinutes}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-3 bg-primary-800/50 border border-accent-500/20 rounded-lg text-neutral-0 placeholder-neutral-500 focus:outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 transition-all"
                />
              </div>
            </div>

            {/* Row 5 */}
            <div>
              <label className="block text-sm text-neutral-300 mb-2">Promo Code (optional)</label>
              <select
                name="promoCodeId"
                value={formState.promoCodeId}
                onChange={handleInputChange}
                className="w-full px-4 py-3 bg-primary-800/50 border border-accent-500/20 rounded-lg text-neutral-0 focus:outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 transition-all"
              >
                <option value="">No promo code</option>
                {promoCodes.filter(c => c.is_active).map(code => (
                  <option key={code.id} value={code.id}>
                    {code.code} {code.amount_off_cents
                      ? `- Save ${(code.amount_off_cents / 100).toFixed(2)} ${code.currency?.toUpperCase()}`
                      : `- Save ${code.percent_off}%`}
                  </option>
                ))}
              </select>
            </div>

            {formState.discountPreview?.valid && (
              <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg space-y-2">
                <div className="flex justify-between text-sm text-neutral-300">
                  <span>Subtotal:</span>
                  <span>{parseFloat(formState.amount).toFixed(2)} {formState.currency.toUpperCase()}</span>
                </div>
                <div className="flex justify-between text-sm text-green-300 font-semibold">
                  <span>Discount:</span>
                  <span>-{(formState.discountPreview.savingsAmount / 100).toFixed(2)} {formState.currency.toUpperCase()}</span>
                </div>
                <div className="border-t border-green-500/20 pt-2 flex justify-between text-base font-bold text-green-300">
                  <span>Total:</span>
                  <span>{(formState.discountPreview.finalAmount / 100).toFixed(2)} {formState.currency.toUpperCase()}</span>
                </div>
              </div>
            )}

            <LoadingButton
              onClick={() => {}}
              isLoading={formState.isLoading}
              className="w-full px-6 py-3 rounded-lg font-body bg-accent-500 hover:bg-accent-400 text-neutral-0 transition-all duration-200 disabled:opacity-50"
              type="submit"
            >
              {formState.isLoading ? 'Creating...' : 'Create Invoice'}
            </LoadingButton>
          </form>
        </div>
      )}

      {/* Invoices Table */}
      <div className="bg-gradient-to-br from-primary-700/30 to-primary-800/30 border border-accent-500/10 rounded-xl shadow-lg overflow-hidden">
        <div className="p-6 border-b border-accent-500/10">
          <h2 className="text-xl font-heading text-neutral-0">Recent Invoices</h2>
        </div>

        {invoices.length === 0 ? (
          <div className="text-neutral-400 py-12 text-center">No invoices yet</div>
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
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        invoice.status === 'paid' ? 'bg-green-500/20 text-green-300' :
                        invoice.status === 'void' ? 'bg-gray-500/20 text-gray-300' :
                        'bg-blue-500/20 text-blue-300'
                      }`}>
                        {invoice.status === 'paid' ? '✓ Paid' : invoice.status === 'void' ? '✗ Void' : '○ Open'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-neutral-300 text-xs">
                      {format(new Date(invoice.created_at), 'MMM d')}
                    </td>
                    <td className="px-6 py-4 text-neutral-300 text-xs">
                      {format(new Date(invoice.due_date), 'MMM d')}
                    </td>
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
