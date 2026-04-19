'use client'

import { useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import LoadingButton from '@/components/forms/LoadingButton'

type Step = 1 | 2 | 3

interface AccountForm {
  email: string
  orgName: string
  durationDays: string
  sessionLimitMinutes: string
  sendWelcomeEmail: boolean
}

interface InvoiceForm {
  amount: string
  currency: string
  description: string
  durationDays: string
  sessionLimitMinutes: string
  dueDate: string
  promoCodeId: string
  discountPreview: { valid: boolean; savingsAmount: number; finalAmount: number } | null
}

interface AccountResult {
  userId: string
  email: string
  temporaryPassword: string
  existed: boolean
  orgName?: string
}

interface InvoiceResult {
  invoiceId: string
  stripeInvoiceUrl: string
}

interface PromoCode {
  id: string
  code: string
  amount_off_cents: number | null
  percent_off: number | null
  currency: string | null
  is_active: boolean
}

export default function SetupPage() {
  const [step, setStep] = useState<Step>(1)
  const [accountForm, setAccountForm] = useState<AccountForm>({
    email: '',
    orgName: '',
    durationDays: '30',
    sessionLimitMinutes: '120',
    sendWelcomeEmail: false,
  })
  const [invoiceForm, setInvoiceForm] = useState<InvoiceForm>({
    amount: '',
    currency: 'eur',
    description: '',
    durationDays: '30',
    sessionLimitMinutes: '120',
    dueDate: '',
    promoCodeId: '',
    discountPreview: null,
  })
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([])
  const [accountResult, setAccountResult] = useState<AccountResult | null>(null)
  const [invoiceResult, setInvoiceResult] = useState<InvoiceResult | null>(null)
  const [accountError, setAccountError] = useState('')
  const [invoiceError, setInvoiceError] = useState('')
  const [accountLoading, setAccountLoading] = useState(false)
  const [invoiceLoading, setInvoiceLoading] = useState(false)
  const [accountExists, setAccountExists] = useState(false)

  const handleAccountChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    setAccountForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }))
    setAccountError('')
  }

  const handleInvoiceChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setInvoiceForm(prev => ({ ...prev, [name]: value, discountPreview: null }))
    setInvoiceError('')
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
    if (!invoiceForm.promoCodeId || !invoiceForm.amount) return

    try {
      const amountCents = Math.round(parseFloat(invoiceForm.amount) * 100)
      const res = await fetch(
        `/api/admin/promo-codes/validate?code=${invoiceForm.promoCodeId}&currency=${invoiceForm.currency}&amountCents=${amountCents}`
      )
      const data = await res.json()
      if (data.valid) {
        setInvoiceForm(prev => ({
          ...prev,
          discountPreview: {
            valid: true,
            savingsAmount: data.savingsAmount,
            finalAmount: data.finalAmount,
          },
        }))
      } else {
        setInvoiceForm(prev => ({ ...prev, discountPreview: { valid: false, savingsAmount: 0, finalAmount: 0 } }))
      }
    } catch (err) {
      console.error('Failed to validate discount:', err)
    }
  }

  const handleAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setAccountLoading(true)
    setAccountError('')

    try {
      const res = await fetch('/api/admin/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: accountForm.email.toLowerCase(),
          organizationName: accountForm.orgName || null,
          durationDays: parseInt(accountForm.durationDays, 10),
          sessionLimitMinutes: parseInt(accountForm.sessionLimitMinutes, 10),
          sendWelcomeEmail: accountForm.sendWelcomeEmail,
        }),
      })

      const data = await res.json()

      if (res.status === 409) {
        setAccountExists(true)
        setAccountResult({
          email: accountForm.email.toLowerCase(),
          userId: data.userId,
          temporaryPassword: '',
          existed: true,
          orgName: accountForm.orgName,
        })
      } else if (!res.ok) {
        throw new Error(data.error || 'Failed to create account')
      } else {
        setAccountExists(false)
        setAccountResult({
          ...data,
          existed: false,
          orgName: accountForm.orgName,
        })
      }

      if (accountForm.sendWelcomeEmail) {
        setStep(3)
      } else {
        // Fetch promo codes for Step 2
        await fetchPromoCodes()
        // Set due date
        const dueDate = new Date()
        dueDate.setDate(dueDate.getDate() + 7)
        setInvoiceForm(prev => ({
          ...prev,
          durationDays: accountForm.durationDays,
          sessionLimitMinutes: accountForm.sessionLimitMinutes,
          dueDate: dueDate.toISOString().split('T')[0],
        }))
        setStep(2)
      }
    } catch (err) {
      setAccountError(err instanceof Error ? err.message : 'Failed to create account')
    } finally {
      setAccountLoading(false)
    }
  }

  const handleInvoiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setInvoiceLoading(true)
    setInvoiceError('')

    try {
      const res = await fetch('/api/admin/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientEmail: accountResult?.email,
          orgName: accountResult?.orgName || null,
          amount: parseFloat(invoiceForm.amount),
          currency: invoiceForm.currency,
          description: invoiceForm.description,
          durationDays: parseInt(invoiceForm.durationDays, 10),
          sessionLimitMinutes: parseInt(invoiceForm.sessionLimitMinutes, 10),
          dueDate: invoiceForm.dueDate,
          promoCodeId: invoiceForm.promoCodeId || null,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create invoice')
      }

      setInvoiceResult(data)
      setStep(3)
    } catch (err) {
      setInvoiceError(err instanceof Error ? err.message : 'Failed to create invoice')
    } finally {
      setInvoiceLoading(false)
    }
  }

  const resetWizard = () => {
    setStep(1)
    setAccountForm({
      email: '',
      orgName: '',
      durationDays: '30',
      sessionLimitMinutes: '120',
      sendWelcomeEmail: false,
    })
    setInvoiceForm({
      amount: '',
      currency: 'eur',
      description: '',
      durationDays: '30',
      sessionLimitMinutes: '120',
      dueDate: '',
      promoCodeId: '',
      discountPreview: null,
    })
    setAccountResult(null)
    setInvoiceResult(null)
    setAccountError('')
    setInvoiceError('')
    setAccountExists(false)
  }

  return (
    <div className="space-y-8">
      {/* Step Indicator */}
      <div className="flex items-center justify-center gap-4">
        <div
          className={`flex flex-col items-center ${step >= 1 ? 'opacity-100' : 'opacity-50'}`}
        >
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all ${
              step > 1 ? 'bg-green-500 text-neutral-0' : 'bg-accent-500 text-neutral-0'
            }`}
          >
            {step > 1 ? '✓' : '1'}
          </div>
          <p className="text-xs text-neutral-300 mt-2">Account</p>
        </div>

        <div
          className={`h-1 w-16 rounded-full transition-all ${
            step >= 2 ? 'bg-accent-500' : 'bg-primary-700'
          }`}
        />

        <div
          className={`flex flex-col items-center ${step >= 2 ? 'opacity-100' : 'opacity-50'}`}
        >
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all ${
              step > 2 ? 'bg-green-500 text-neutral-0' : step === 2 ? 'bg-accent-500 text-neutral-0' : 'bg-primary-700 text-neutral-400'
            }`}
          >
            {step > 2 ? '✓' : '2'}
          </div>
          <p className="text-xs text-neutral-300 mt-2">Invoice</p>
        </div>

        <div
          className={`h-1 w-16 rounded-full transition-all ${
            step >= 3 ? 'bg-green-500' : 'bg-primary-700'
          }`}
        />

        <div
          className={`flex flex-col items-center ${step >= 3 ? 'opacity-100' : 'opacity-50'}`}
        >
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all ${
              step === 3 ? 'bg-green-500 text-neutral-0' : 'bg-primary-700 text-neutral-400'
            }`}
          >
            ✓
          </div>
          <p className="text-xs text-neutral-300 mt-2">Done</p>
        </div>
      </div>

      {/* Step 1: Account */}
      {step === 1 && (
        <div className="bg-gradient-to-br from-primary-700/30 to-primary-800/30 border border-accent-500/10 rounded-xl p-8 space-y-6 shadow-lg">
          <h2 className="text-2xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-neutral-0 to-neutral-200">
            Step 1: Create Account
          </h2>
          <p className="text-neutral-400">Set up a new organization account</p>

          {accountError && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-300 rounded-lg text-sm flex items-start gap-3">
              <span className="text-lg">⚠️</span>
              <span>{accountError}</span>
            </div>
          )}

          {accountExists && (
            <div className="p-4 bg-blue-500/10 border border-blue-500/20 text-blue-300 rounded-lg text-sm flex items-start gap-3">
              <span className="text-lg">ℹ️</span>
              <span>Account already exists for {accountForm.email}. You can still create an invoice.</span>
            </div>
          )}

          <form onSubmit={handleAccountSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-neutral-300 mb-2">Email *</label>
                <input
                  type="email"
                  name="email"
                  placeholder="org@example.com"
                  value={accountForm.email}
                  onChange={handleAccountChange}
                  required
                  className="w-full px-4 py-3 bg-primary-800/50 border border-accent-500/20 rounded-lg text-neutral-0 placeholder-neutral-500 focus:outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm text-neutral-300 mb-2">Organization Name</label>
                <input
                  type="text"
                  name="orgName"
                  placeholder="Islamic Center"
                  value={accountForm.orgName}
                  onChange={handleAccountChange}
                  className="w-full px-4 py-3 bg-primary-800/50 border border-accent-500/20 rounded-lg text-neutral-0 placeholder-neutral-500 focus:outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-neutral-300 mb-2">Duration (Days) *</label>
                <input
                  type="number"
                  name="durationDays"
                  placeholder="30"
                  value={accountForm.durationDays}
                  onChange={handleAccountChange}
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
                  value={accountForm.sessionLimitMinutes}
                  onChange={handleAccountChange}
                  required
                  className="w-full px-4 py-3 bg-primary-800/50 border border-accent-500/20 rounded-lg text-neutral-0 placeholder-neutral-500 focus:outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 transition-all"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 bg-primary-700/20 border border-accent-500/10 rounded-lg">
              <input
                type="checkbox"
                name="sendWelcomeEmail"
                id="sendWelcomeEmail"
                checked={accountForm.sendWelcomeEmail}
                onChange={handleAccountChange}
                className="w-5 h-5 rounded border-accent-500/20 bg-primary-800/50 cursor-pointer"
              />
              <label htmlFor="sendWelcomeEmail" className="text-sm text-neutral-300 cursor-pointer flex-1">
                Send welcome email now (skip invoice)
              </label>
            </div>

            <LoadingButton
              isLoading={accountLoading}
              className="w-full px-6 py-3 rounded-lg font-body bg-accent-500 hover:bg-accent-400 text-neutral-0 transition-all duration-200 disabled:opacity-50"
              type="submit"
            >
              {accountLoading ? 'Creating...' : accountForm.sendWelcomeEmail ? 'Create & Send Email' : 'Continue to Invoice'}
            </LoadingButton>
          </form>
        </div>
      )}

      {/* Step 2: Invoice */}
      {step === 2 && accountResult && (
        <div className="bg-gradient-to-br from-primary-700/30 to-primary-800/30 border border-accent-500/10 rounded-xl p-8 space-y-6 shadow-lg">
          <h2 className="text-2xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-neutral-0 to-neutral-200">
            Step 2: Create Invoice
          </h2>
          <p className="text-neutral-400">Generate an invoice for {accountResult.email}</p>

          {invoiceError && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-300 rounded-lg text-sm flex items-start gap-3">
              <span className="text-lg">⚠️</span>
              <span>{invoiceError}</span>
            </div>
          )}

          <form onSubmit={handleInvoiceSubmit} className="space-y-6">
            {/* Read-only recipient */}
            <div className="p-4 bg-primary-800/30 border border-accent-500/20 rounded-lg">
              <p className="text-xs text-neutral-400 uppercase tracking-wide mb-2">Recipient</p>
              <p className="text-neutral-0 font-semibold">{accountResult.email}</p>
              {accountResult.orgName && <p className="text-sm text-neutral-300 mt-1">{accountResult.orgName}</p>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-neutral-300 mb-2">Amount *</label>
                <input
                  type="number"
                  name="amount"
                  placeholder="150"
                  step="0.01"
                  value={invoiceForm.amount}
                  onChange={e => {
                    handleInvoiceChange(e)
                    if (invoiceForm.promoCodeId) {
                      setTimeout(() => validateDiscount(), 0)
                    }
                  }}
                  required
                  className="w-full px-4 py-3 bg-primary-800/50 border border-accent-500/20 rounded-lg text-neutral-0 placeholder-neutral-500 focus:outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm text-neutral-300 mb-2">Currency *</label>
                <select
                  name="currency"
                  value={invoiceForm.currency}
                  onChange={e => {
                    handleInvoiceChange(e)
                    if (invoiceForm.promoCodeId) {
                      setTimeout(() => validateDiscount(), 0)
                    }
                  }}
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
                  value={invoiceForm.dueDate}
                  onChange={handleInvoiceChange}
                  required
                  className="w-full px-4 py-3 bg-primary-800/50 border border-accent-500/20 rounded-lg text-neutral-0 focus:outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-neutral-300 mb-2">Description *</label>
              <textarea
                name="description"
                placeholder="Service description for invoice..."
                value={invoiceForm.description}
                onChange={handleInvoiceChange}
                required
                rows={3}
                className="w-full px-4 py-3 bg-primary-800/50 border border-accent-500/20 rounded-lg text-neutral-0 placeholder-neutral-500 focus:outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 transition-all resize-none"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-neutral-300 mb-2">Duration (Days)</label>
                <input
                  type="number"
                  name="durationDays"
                  value={invoiceForm.durationDays}
                  onChange={handleInvoiceChange}
                  className="w-full px-4 py-3 bg-primary-800/50 border border-accent-500/20 rounded-lg text-neutral-0 focus:outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm text-neutral-300 mb-2">Session Limit (minutes/month)</label>
                <input
                  type="number"
                  name="sessionLimitMinutes"
                  value={invoiceForm.sessionLimitMinutes}
                  onChange={handleInvoiceChange}
                  className="w-full px-4 py-3 bg-primary-800/50 border border-accent-500/20 rounded-lg text-neutral-0 focus:outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-neutral-300 mb-2">Promo Code (optional)</label>
              <select
                name="promoCodeId"
                value={invoiceForm.promoCodeId}
                onChange={e => {
                  handleInvoiceChange(e)
                  if (e.target.value) {
                    setTimeout(() => validateDiscount(), 0)
                  }
                }}
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

            {invoiceForm.discountPreview?.valid && (
              <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg space-y-2">
                <div className="flex justify-between text-sm text-neutral-300">
                  <span>Subtotal:</span>
                  <span>{parseFloat(invoiceForm.amount).toFixed(2)} {invoiceForm.currency.toUpperCase()}</span>
                </div>
                <div className="flex justify-between text-sm text-green-300 font-semibold">
                  <span>Discount:</span>
                  <span>-{(invoiceForm.discountPreview.savingsAmount / 100).toFixed(2)} {invoiceForm.currency.toUpperCase()}</span>
                </div>
                <div className="border-t border-green-500/20 pt-2 flex justify-between text-base font-bold text-green-300">
                  <span>Total:</span>
                  <span>{(invoiceForm.discountPreview.finalAmount / 100).toFixed(2)} {invoiceForm.currency.toUpperCase()}</span>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-6 py-3 rounded-lg font-body bg-primary-700 hover:bg-primary-600 text-neutral-0 transition-all duration-200"
              >
                Back
              </button>
              <LoadingButton
                isLoading={invoiceLoading}
                className="flex-1 px-6 py-3 rounded-lg font-body bg-accent-500 hover:bg-accent-400 text-neutral-0 transition-all duration-200 disabled:opacity-50"
                type="submit"
              >
                {invoiceLoading ? 'Creating...' : 'Create Invoice'}
              </LoadingButton>
            </div>
          </form>
        </div>
      )}

      {/* Step 3: Success */}
      {step === 3 && (
        <div className="bg-gradient-to-br from-green-500/10 to-green-600/10 border border-green-500/20 rounded-xl p-8 space-y-6 shadow-lg">
          <div className="text-center space-y-2">
            <div className="text-5xl">✓</div>
            <h2 className="text-2xl font-display font-bold text-green-300">
              {accountForm.sendWelcomeEmail ? 'Credentials Sent!' : 'Setup Complete!'}
            </h2>
            <p className="text-neutral-300">
              {accountForm.sendWelcomeEmail
                ? `Welcome email with credentials sent to ${accountResult?.email}`
                : `Invoice created and sent to ${accountResult?.email}`}
            </p>
          </div>

          <div className="bg-primary-800/30 border border-accent-500/10 rounded-lg p-6 space-y-4">
            {accountResult && (
              <div>
                <p className="text-xs text-neutral-400 uppercase tracking-wide mb-2">Account</p>
                <p className="text-neutral-0 font-mono text-sm">{accountResult.email}</p>
                {accountResult.orgName && <p className="text-neutral-300 text-sm mt-1">{accountResult.orgName}</p>}
              </div>
            )}

            {invoiceResult && (
              <div className="pt-4 border-t border-accent-500/10">
                <p className="text-xs text-neutral-400 uppercase tracking-wide mb-2">Invoice</p>
                <p className="text-neutral-0 font-semibold">
                  {invoiceForm.amount} {invoiceForm.currency.toUpperCase()}
                </p>
                <p className="text-neutral-300 text-sm mt-1">Due: {format(new Date(invoiceForm.dueDate), 'MMM d, yyyy')}</p>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            {invoiceResult && (
              <Link
                href={`/admin/invoices/${invoiceResult.invoiceId}`}
                className="px-6 py-3 rounded-lg font-body bg-accent-500 hover:bg-accent-400 text-neutral-0 transition-all duration-200"
              >
                View Invoice
              </Link>
            )}
            <button
              onClick={resetWizard}
              className="px-6 py-3 rounded-lg font-body bg-primary-700 hover:bg-primary-600 text-neutral-0 transition-all duration-200"
            >
              Create Another
            </button>
            <Link
              href="/admin/invoices"
              className="px-6 py-3 rounded-lg font-body bg-primary-700 hover:bg-primary-600 text-neutral-0 transition-all duration-200"
            >
              Go to Invoices
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
