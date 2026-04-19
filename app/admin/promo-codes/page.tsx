'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import LoadingButton from '@/components/forms/LoadingButton'

interface PromoCode {
  id: string
  code: string
  amount_off_cents: number | null
  percent_off: number | null
  currency: string | null
  max_redemptions: number | null
  redemptions_count: number
  expires_at: string | null
  is_active: boolean
  created_by_email: string
  created_at: string
}

interface CreateFormState {
  code: string
  discountType: 'amount_off' | 'percent_off'
  amount: string
  percent: string
  currency: string
  maxRedemptions: string
  expiresAt: string
  isLoading: boolean
  error: string
  success: false | string
}

export default function PromoCodesPage() {
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [formState, setFormState] = useState<CreateFormState>({
    code: '',
    discountType: 'percent_off',
    amount: '',
    percent: '',
    currency: 'eur',
    maxRedemptions: '',
    expiresAt: '',
    isLoading: false,
    error: '',
    success: false,
  })

  useEffect(() => {
    fetchPromoCodes()
  }, [])

  const fetchPromoCodes = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/admin/promo-codes')
      const data = await res.json()
      setPromoCodes(data.promoCodes || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch promo codes')
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
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
      const payload: any = {
        code: formState.code.toUpperCase(),
        discountType: formState.discountType,
      }

      if (formState.discountType === 'amount_off') {
        if (!formState.amount || !formState.currency) {
          throw new Error('Amount and currency required for amount_off')
        }
        payload.amount = parseFloat(formState.amount)
        payload.currency = formState.currency
      } else {
        if (!formState.percent) {
          throw new Error('Percent required for percent_off')
        }
        payload.percent = parseFloat(formState.percent)
      }

      if (formState.maxRedemptions) {
        payload.maxRedemptions = parseInt(formState.maxRedemptions, 10)
      }

      if (formState.expiresAt) {
        payload.expiresAt = formState.expiresAt
      }

      const res = await fetch('/api/admin/promo-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create promo code')
      }

      setFormState(prev => ({
        ...prev,
        success: 'Promo code created successfully!',
        code: '',
        amount: '',
        percent: '',
        maxRedemptions: '',
        expiresAt: '',
      }))

      await fetchPromoCodes()
      setTimeout(() => setShowForm(false), 2000)
    } catch (err) {
      setFormState(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to create promo code',
      }))
    } finally {
      setFormState(prev => ({ ...prev, isLoading: false }))
    }
  }

  const handleDeactivate = async (id: string, code: string) => {
    if (!confirm(`Deactivate code ${code}?`)) return

    try {
      const res = await fetch(`/api/admin/promo-codes/${id}/deactivate`, {
        method: 'POST',
      })

      if (!res.ok) {
        throw new Error('Failed to deactivate code')
      }

      await fetchPromoCodes()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to deactivate code')
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-display font-semibold text-neutral-0">Promo Codes</h1>
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
              Promo Codes
            </h1>
            <p className="text-neutral-300 mt-2">Manage discount codes for invoices</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="btn-primary"
          >
            {showForm ? 'Cancel' : 'Create Code'}
          </button>
        </div>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="bg-primary-700/30 border border-accent-500/20 rounded-lg p-6 space-y-4">
          <h2 className="text-xl font-heading text-neutral-0">Create New Promo Code</h2>

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
            <input
              type="text"
              name="code"
              placeholder="Code (e.g., SUMMER50)"
              value={formState.code}
              onChange={handleInputChange}
              required
              className="input-field"
            />

            <div className="space-y-2">
              <div className="text-neutral-300 text-sm">Discount Type</div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="discountType"
                    value="amount_off"
                    checked={formState.discountType === 'amount_off'}
                    onChange={handleInputChange}
                    className="rounded"
                  />
                  <span className="text-neutral-300">Amount Off</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="discountType"
                    value="percent_off"
                    checked={formState.discountType === 'percent_off'}
                    onChange={handleInputChange}
                    className="rounded"
                  />
                  <span className="text-neutral-300">Percent Off</span>
                </label>
              </div>
            </div>

            {formState.discountType === 'amount_off' ? (
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="number"
                  name="amount"
                  placeholder="Amount (e.g., 50)"
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
              </div>
            ) : (
              <input
                type="number"
                name="percent"
                placeholder="Percent (e.g., 50)"
                min="0"
                max="100"
                step="0.01"
                value={formState.percent}
                onChange={handleInputChange}
                required
                className="input-field"
              />
            )}

            <div className="grid grid-cols-2 gap-4">
              <input
                type="number"
                name="maxRedemptions"
                placeholder="Max Redemptions (optional)"
                value={formState.maxRedemptions}
                onChange={handleInputChange}
                className="input-field"
              />
              <input
                type="datetime-local"
                name="expiresAt"
                placeholder="Expires At (optional)"
                value={formState.expiresAt}
                onChange={handleInputChange}
                className="input-field"
              />
            </div>

            <LoadingButton
              onClick={() => {}}
              isLoading={formState.isLoading}
              className="btn-primary w-full"
              type="submit"
            >
              Create Promo Code
            </LoadingButton>
          </form>
        </div>
      )}

      {/* Codes Table */}
      <div className="bg-primary-700/30 border border-accent-500/20 rounded-lg p-6 overflow-hidden">
        <h2 className="text-xl font-heading text-neutral-0 mb-4">Active & Inactive Codes</h2>

        {promoCodes.length === 0 ? (
          <div className="text-neutral-400 py-8 text-center">No promo codes yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-primary-800/50 border-b border-accent-500/10">
                <tr>
                  <th className="px-4 py-3 text-left text-neutral-300 font-semibold">Code</th>
                  <th className="px-4 py-3 text-left text-neutral-300 font-semibold">Discount</th>
                  <th className="px-4 py-3 text-center text-neutral-300 font-semibold">Redemptions</th>
                  <th className="px-4 py-3 text-left text-neutral-300 font-semibold">Expires</th>
                  <th className="px-4 py-3 text-left text-neutral-300 font-semibold">Status</th>
                  <th className="px-4 py-3 text-left text-neutral-300 font-semibold">Created By</th>
                  <th className="px-4 py-3 text-left text-neutral-300 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-accent-500/10">
                {promoCodes.map((code) => {
                  const discountLabel = code.amount_off_cents
                    ? `€${(code.amount_off_cents / 100).toFixed(2)}`
                    : `${code.percent_off}%`

                  const isExpired = code.expires_at && new Date(code.expires_at) < new Date()
                  const isMaxReached = code.max_redemptions && code.redemptions_count >= code.max_redemptions

                  return (
                    <tr key={code.id} className="hover:bg-primary-700/20 transition-colors">
                      <td className="px-4 py-3 text-neutral-0 font-mono font-semibold">{code.code}</td>
                      <td className="px-4 py-3 text-neutral-300">
                        {code.amount_off_cents ? `${code.currency?.toUpperCase()}` : ''} {discountLabel}
                      </td>
                      <td className="px-4 py-3 text-center text-neutral-300 text-sm">
                        {code.redemptions_count}
                        {code.max_redemptions && ` / ${code.max_redemptions}`}
                      </td>
                      <td className="px-4 py-3 text-neutral-300 text-xs">
                        {code.expires_at ? format(new Date(code.expires_at), 'MMM d, yyyy') : 'Never'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            !code.is_active ? 'bg-gray-500/20 text-gray-300' :
                            isExpired ? 'bg-orange-500/20 text-orange-300' :
                            isMaxReached ? 'bg-orange-500/20 text-orange-300' :
                            'bg-green-500/20 text-green-300'
                          }`}>
                            {!code.is_active ? 'Inactive' : isExpired ? 'Expired' : isMaxReached ? 'Max Reached' : 'Active'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-neutral-400 text-xs font-mono">{code.created_by_email}</td>
                      <td className="px-4 py-3 text-sm">
                        {code.is_active && (
                          <button
                            onClick={() => handleDeactivate(code.id, code.code)}
                            className="text-red-400 hover:text-red-300 underline"
                          >
                            Deactivate
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
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
