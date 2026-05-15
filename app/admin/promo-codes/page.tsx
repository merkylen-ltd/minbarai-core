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
  created_at: string
}

interface CreateFormState {
  code: string
  discountType: 'amount' | 'percent'
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
  const [codes, setCodes] = useState<PromoCode[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [formState, setFormState] = useState<CreateFormState>({
    code: '',
    discountType: 'amount',
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
      setCodes(data.promoCodes || data.codes || [])
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
      const body: Record<string, unknown> = {
        code: formState.code.toUpperCase().trim(),
        discountType: formState.discountType === 'amount' ? 'amount_off' : 'percent_off',
      }

      if (formState.discountType === 'amount') {
        const amountNum = parseFloat(formState.amount)
        if (!amountNum || amountNum <= 0) {
          throw new Error('Amount must be greater than 0')
        }
        body.amount = amountNum
        body.currency = formState.currency
      } else {
        const pctNum = parseFloat(formState.percent)
        if (!pctNum || pctNum <= 0 || pctNum > 100) {
          throw new Error('Percent must be between 0 and 100')
        }
        body.percent = pctNum
      }

      if (formState.maxRedemptions) {
        body.maxRedemptions = parseInt(formState.maxRedemptions, 10)
      }

      if (formState.expiresAt) {
        body.expiresAt = formState.expiresAt
      }

      const res = await fetch('/api/admin/promo-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create promo code')
      }

      setFormState(prev => ({
        ...prev,
        success: `✓ Promo code ${formState.code} created!`,
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

  const handleDeactivate = async (codeId: string) => {
    if (!confirm('Are you sure you want to deactivate this promo code?')) return

    try {
      const res = await fetch(`/api/admin/promo-codes/${codeId}/deactivate`, {
        method: 'POST',
      })

      if (!res.ok) {
        throw new Error('Failed to deactivate promo code')
      }

      await fetchPromoCodes()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to deactivate promo code')
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
              <p className="text-neutral-300 mt-2">Create and manage discount codes</p>
            </div>
            <button
              onClick={() => setShowForm(!showForm)}
              className="px-6 py-3 rounded-lg font-body bg-accent-500 hover:bg-accent-400 text-neutral-0 transition-all duration-200 shadow-lg"
            >
              {showForm ? 'Cancel' : '+ Create Code'}
            </button>
          </div>
        </div>

        {/* Stats */}
        {codes.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/10 border border-blue-500/20 rounded-xl p-4 shadow-lg">
              <div className="text-neutral-400 text-xs font-semibold uppercase tracking-wide">Total Codes</div>
              <div className="text-neutral-0 text-3xl font-display font-bold mt-2">{codes.length}</div>
            </div>
            <div className="bg-gradient-to-br from-green-500/10 to-green-600/10 border border-green-500/20 rounded-xl p-4 shadow-lg">
              <div className="text-neutral-400 text-xs font-semibold uppercase tracking-wide">Active</div>
              <div className="text-neutral-0 text-3xl font-display font-bold mt-2">
                {codes.filter(c => c.is_active).length}
              </div>
            </div>
            <div className="bg-gradient-to-br from-accent-500/10 to-accent-600/10 border border-accent-500/20 rounded-xl p-4 shadow-lg">
              <div className="text-neutral-400 text-xs font-semibold uppercase tracking-wide">Total Redemptions</div>
              <div className="text-neutral-0 text-3xl font-display font-bold mt-2">
                {codes.reduce((sum, c) => sum + c.redemptions_count, 0)}
              </div>
            </div>
          </div>
        )}

        {/* Create Form */}
        {showForm && (
          <div className="bg-gradient-to-br from-primary-700/30 to-primary-800/30 border border-accent-500/10 rounded-xl p-8 space-y-6 shadow-lg">
            <h2 className="text-xl font-heading text-neutral-0">Create Promo Code</h2>

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
                  <label className="block text-sm text-neutral-300 mb-2">Code *</label>
                  <input
                    type="text"
                    name="code"
                    placeholder="RAMADAN50"
                    value={formState.code}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-3 bg-primary-800/50 border border-accent-500/20 rounded-lg text-neutral-0 placeholder-neutral-500 focus:outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 transition-all uppercase font-mono"
                  />
                </div>
                <div>
                  <label className="block text-sm text-neutral-300 mb-2">Discount Type *</label>
                  <select
                    name="discountType"
                    value={formState.discountType}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 bg-primary-800/50 border border-accent-500/20 rounded-lg text-neutral-0 focus:outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 transition-all"
                  >
                    <option value="amount">Amount Off</option>
                    <option value="percent">Percent Off</option>
                  </select>
                </div>
              </div>

              {/* Row 2 */}
              {formState.discountType === 'amount' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-neutral-300 mb-2">Amount Off *</label>
                    <input
                      type="number"
                      name="amount"
                      placeholder="50"
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
                </div>
              ) : (
                <div>
                  <label className="block text-sm text-neutral-300 mb-2">Percent Off *</label>
                  <input
                    type="number"
                    name="percent"
                    placeholder="25"
                    step="0.01"
                    value={formState.percent}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-3 bg-primary-800/50 border border-accent-500/20 rounded-lg text-neutral-0 placeholder-neutral-500 focus:outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 transition-all"
                  />
                </div>
              )}

              {/* Row 3 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-neutral-300 mb-2">Max Redemptions (optional)</label>
                  <input
                    type="number"
                    name="maxRedemptions"
                    placeholder="10"
                    value={formState.maxRedemptions}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 bg-primary-800/50 border border-accent-500/20 rounded-lg text-neutral-0 placeholder-neutral-500 focus:outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm text-neutral-300 mb-2">Expires At (optional)</label>
                  <input
                    type="date"
                    name="expiresAt"
                    value={formState.expiresAt}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 bg-primary-800/50 border border-accent-500/20 rounded-lg text-neutral-0 focus:outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 transition-all"
                  />
                </div>
              </div>

              <LoadingButton
                onClick={() => {}}
                isLoading={formState.isLoading}
                className="w-full px-6 py-3 rounded-lg font-body bg-accent-500 hover:bg-accent-400 text-neutral-0 transition-all duration-200 disabled:opacity-50"
                type="submit"
              >
                {formState.isLoading ? 'Creating...' : 'Create Promo Code'}
              </LoadingButton>
            </form>
          </div>
        )}

        {/* Promo Codes Table */}
        <div className="bg-gradient-to-br from-primary-700/30 to-primary-800/30 border border-accent-500/10 rounded-xl shadow-lg overflow-hidden">
          <div className="p-6 border-b border-accent-500/10">
            <h2 className="text-xl font-heading text-neutral-0">Promo Codes</h2>
          </div>

          {codes.length === 0 ? (
            <div className="text-neutral-400 py-12 text-center">No promo codes created yet</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-primary-800/50 border-b border-accent-500/10">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-300 uppercase tracking-wider">Code</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-300 uppercase tracking-wider">Discount</th>
                    <th className="px-6 py-4 text-center text-xs font-semibold text-neutral-300 uppercase tracking-wider">Redemptions</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-300 uppercase tracking-wider">Expires</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-300 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-300 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-accent-500/10">
                  {codes.map((code) => (
                    <tr key={code.id} className="hover:bg-primary-700/20 transition-colors">
                      <td className="px-6 py-4 text-neutral-0 font-mono font-semibold text-sm">{code.code}</td>
                      <td className="px-6 py-4 text-neutral-300 text-sm">
                        {code.amount_off_cents
                          ? `${(code.amount_off_cents / 100).toFixed(2)} ${code.currency?.toUpperCase()}`
                          : `${code.percent_off}%`}
                      </td>
                      <td className="px-6 py-4 text-center text-neutral-300 text-sm">
                        {code.redemptions_count}
                        {code.max_redemptions && ` / ${code.max_redemptions}`}
                      </td>
                      <td className="px-6 py-4 text-neutral-300 text-xs">
                        {code.expires_at ? format(new Date(code.expires_at), 'MMM d, yyyy') : '∞'}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          code.is_active
                            ? 'bg-green-500/20 text-green-300'
                            : 'bg-gray-500/20 text-gray-300'
                        }`}>
                          {code.is_active ? '✓ Active' : '✗ Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {code.is_active && (
                          <button
                            onClick={() => handleDeactivate(code.id)}
                            className="text-red-400 hover:text-red-300 underline"
                          >
                            Deactivate
                          </button>
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
