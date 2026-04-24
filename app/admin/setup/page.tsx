'use client'

import { useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import LoadingButton from '@/components/forms/LoadingButton'

type Step = 1 | 2 | 3
type Mode = 'single' | 'bulk'

interface SingleAccountForm {
  email: string
  orgName: string
  durationDays: string
  sessionLimitMinutes: string
  sendWelcomeEmail: boolean
}

interface BulkAccountForm {
  orgName: string
  billingEmail: string
  emailPrefix: string
  emailDomain: string
  count: string
  password: string
  durationDays: string
  sessionLimitMinutes: string
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

interface BulkAccountResult {
  orgName: string
  billingEmail: string
  password: string
  accounts: Array<{ email: string; userId?: string; success: boolean; error?: string }>
  created: number
  total: number
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

const todayIso = () => new Date().toISOString().split('T')[0]

function CopyRow({ label, value, sensitive = false }: { label: string; value: string; sensitive?: boolean }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <div>
      <p className="text-xs text-neutral-400 uppercase tracking-wide mb-1">{label}</p>
      <div className="flex items-center gap-2">
        <span className={`flex-1 font-mono text-sm bg-primary-900/40 border border-accent-500/10 px-3 py-2 rounded-lg text-neutral-0 select-all ${sensitive ? 'tracking-widest' : ''}`}>
          {value}
        </span>
        <button
          type="button"
          onClick={copy}
          className="px-3 py-2 rounded-lg bg-primary-700 hover:bg-primary-600 text-xs font-medium transition-colors min-w-[60px]"
        >
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
    </div>
  )
}

const generatePassword = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%^&*'
  let pw = ''
  for (let i = 0; i < 14; i++) pw += chars.charAt(Math.floor(Math.random() * chars.length))
  return pw
}

export default function SetupPage() {
  const [mode, setMode] = useState<Mode>('single')
  const [step, setStep] = useState<Step>(1)

  const [singleForm, setSingleForm] = useState<SingleAccountForm>({
    email: '',
    orgName: '',
    durationDays: '30',
    sessionLimitMinutes: '120',
    sendWelcomeEmail: false,
  })

  const [bulkForm, setBulkForm] = useState<BulkAccountForm>({
    orgName: '',
    billingEmail: '',
    emailPrefix: 'seat',
    emailDomain: 'example.org',
    count: '5',
    password: '',
    durationDays: '30',
    sessionLimitMinutes: '120',
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
  const [bulkResult, setBulkResult] = useState<BulkAccountResult | null>(null)
  const [invoiceResult, setInvoiceResult] = useState<InvoiceResult | null>(null)
  const [accountError, setAccountError] = useState('')
  const [invoiceError, setInvoiceError] = useState('')
  const [accountLoading, setAccountLoading] = useState(false)
  const [invoiceLoading, setInvoiceLoading] = useState(false)
  const [accountExists, setAccountExists] = useState(false)

  const handleSingleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    setSingleForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }))
    setAccountError('')
  }

  const handleBulkChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setBulkForm(prev => ({ ...prev, [name]: value }))
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
      setPromoCodes(data.promoCodes || data.codes || [])
    } catch (err) {
      console.error('Failed to fetch promo codes:', err)
    }
  }

  const validateDiscount = async () => {
    if (!invoiceForm.promoCodeId || !invoiceForm.amount) return
    const selected = promoCodes.find(p => p.id === invoiceForm.promoCodeId)
    if (!selected) return

    try {
      const amountCents = Math.round(parseFloat(invoiceForm.amount) * 100)
      const params = new URLSearchParams({
        code: selected.code,
        currency: invoiceForm.currency,
        amountCents: String(amountCents),
      })
      const res = await fetch(`/api/admin/promo-codes/validate?${params.toString()}`)
      const data = await res.json()
      if (data.valid) {
        setInvoiceForm(prev => ({
          ...prev,
          discountPreview: {
            valid: true,
            savingsAmount: data.savings ?? data.savingsAmount ?? data.discountAmount ?? 0,
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

  const prepareInvoiceStep = (durationDays: string, sessionLimitMinutes: string, defaultDesc: string) => {
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + 7)
    setInvoiceForm(prev => ({
      ...prev,
      durationDays,
      sessionLimitMinutes,
      dueDate: dueDate.toISOString().split('T')[0],
      description: prev.description || defaultDesc,
    }))
  }

  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setAccountLoading(true)
    setAccountError('')

    try {
      const res = await fetch('/api/admin/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: singleForm.email.toLowerCase(),
          organizationName: singleForm.orgName || null,
          durationDays: parseInt(singleForm.durationDays, 10),
          sessionLimitMinutes: parseInt(singleForm.sessionLimitMinutes, 10),
          sendWelcomeEmail: singleForm.sendWelcomeEmail,
        }),
      })
      const data = await res.json()

      if (res.status === 409) {
        setAccountExists(true)
        setAccountResult({
          email: singleForm.email.toLowerCase(),
          userId: data.userId,
          temporaryPassword: '',
          existed: true,
          orgName: singleForm.orgName,
        })
      } else if (!res.ok) {
        throw new Error(data.error || 'Failed to create account')
      } else {
        setAccountExists(false)
        setAccountResult({ ...data, existed: false, orgName: singleForm.orgName })
      }

      if (singleForm.sendWelcomeEmail) {
        setStep(3)
      } else {
        await fetchPromoCodes()
        prepareInvoiceStep(
          singleForm.durationDays,
          singleForm.sessionLimitMinutes,
          `MinbarAI license for ${singleForm.orgName || singleForm.email}`,
        )
        setStep(2)
      }
    } catch (err) {
      setAccountError(err instanceof Error ? err.message : 'Failed to create account')
    } finally {
      setAccountLoading(false)
    }
  }

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setAccountLoading(true)
    setAccountError('')

    const count = parseInt(bulkForm.count, 10)
    if (!count || count < 1 || count > 50) {
      setAccountError('Count must be between 1 and 50')
      setAccountLoading(false)
      return
    }
    if (!bulkForm.billingEmail) {
      setAccountError('Billing email is required for bulk invoices')
      setAccountLoading(false)
      return
    }
    if (!bulkForm.password || bulkForm.password.length < 8) {
      setAccountError('Password must be at least 8 characters')
      setAccountLoading(false)
      return
    }

    try {
      const res = await fetch('/api/admin/marketing/bulk-seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailPrefix: bulkForm.emailPrefix,
          emailDomain: bulkForm.emailDomain,
          count,
          password: bulkForm.password,
          sessionLimitMinutes: parseInt(bulkForm.sessionLimitMinutes, 10),
          withSubscription: false,
        }),
      })
      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to create bulk accounts')
      }

      setBulkResult({
        orgName: bulkForm.orgName,
        billingEmail: bulkForm.billingEmail,
        password: bulkForm.password,
        accounts: data.accounts,
        created: data.created,
        total: data.total,
      })

      await fetchPromoCodes()
      const successfulEmails = data.accounts.filter((a: { success: boolean }) => a.success).length
      prepareInvoiceStep(
        bulkForm.durationDays,
        bulkForm.sessionLimitMinutes,
        `MinbarAI bulk license: ${successfulEmails} seats for ${bulkForm.orgName || bulkForm.billingEmail}`,
      )
      setStep(2)
    } catch (err) {
      setAccountError(err instanceof Error ? err.message : 'Failed to create bulk accounts')
    } finally {
      setAccountLoading(false)
    }
  }

  const handleInvoiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setInvoiceLoading(true)
    setInvoiceError('')

    try {
      const isBulk = mode === 'bulk' && bulkResult
      const recipientEmail = isBulk ? bulkResult!.billingEmail : accountResult?.email
      const orgName = isBulk ? bulkResult!.orgName : accountResult?.orgName
      const accountEmails = isBulk
        ? bulkResult!.accounts.filter(a => a.success).map(a => a.email)
        : undefined

      if (!recipientEmail) {
        throw new Error('Missing recipient email')
      }

      const res = await fetch('/api/admin/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientEmail,
          orgName: orgName || null,
          amount: parseFloat(invoiceForm.amount),
          currency: invoiceForm.currency,
          description: invoiceForm.description,
          durationDays: parseInt(invoiceForm.durationDays, 10),
          sessionLimitMinutes: parseInt(invoiceForm.sessionLimitMinutes, 10),
          dueDate: invoiceForm.dueDate,
          promoCodeId: invoiceForm.promoCodeId || null,
          accountEmails,
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
    setSingleForm({
      email: '',
      orgName: '',
      durationDays: '30',
      sessionLimitMinutes: '120',
      sendWelcomeEmail: false,
    })
    setBulkForm({
      orgName: '',
      billingEmail: '',
      emailPrefix: 'seat',
      emailDomain: 'example.org',
      count: '5',
      password: '',
      durationDays: '30',
      sessionLimitMinutes: '120',
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
    setBulkResult(null)
    setInvoiceResult(null)
    setAccountError('')
    setInvoiceError('')
    setAccountExists(false)
  }

  const recipientSummary = mode === 'bulk' && bulkResult
    ? { email: bulkResult.billingEmail, org: bulkResult.orgName, seats: bulkResult.accounts.filter(a => a.success).length }
    : accountResult
      ? { email: accountResult.email, org: accountResult.orgName || '', seats: 1 }
      : null

  return (
    <div className="space-y-8">
      {/* Mode Toggle - only shown on step 1 */}
      {step === 1 && (
        <div className="flex items-center justify-center gap-2 bg-primary-800/30 border border-accent-500/10 rounded-lg p-1 max-w-md mx-auto">
          <button
            type="button"
            onClick={() => setMode('single')}
            className={`flex-1 px-4 py-2 rounded-md text-sm font-semibold transition-all ${
              mode === 'single' ? 'bg-accent-500 text-neutral-0 shadow' : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Single Account
          </button>
          <button
            type="button"
            onClick={() => setMode('bulk')}
            className={`flex-1 px-4 py-2 rounded-md text-sm font-semibold transition-all ${
              mode === 'bulk' ? 'bg-accent-500 text-neutral-0 shadow' : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Bulk (Multi-Seat)
          </button>
        </div>
      )}

      {/* Step Indicator */}
      <div className="flex items-center justify-center gap-4">
        <div className={`flex flex-col items-center ${step >= 1 ? 'opacity-100' : 'opacity-50'}`}>
          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all ${
            step > 1 ? 'bg-green-500 text-neutral-0' : 'bg-accent-500 text-neutral-0'
          }`}>
            {step > 1 ? '✓' : '1'}
          </div>
          <p className="text-xs text-neutral-300 mt-2">{mode === 'bulk' ? 'Accounts' : 'Account'}</p>
        </div>

        <div className={`h-1 w-16 rounded-full transition-all ${step >= 2 ? 'bg-accent-500' : 'bg-primary-700'}`} />

        <div className={`flex flex-col items-center ${step >= 2 ? 'opacity-100' : 'opacity-50'}`}>
          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all ${
            step > 2 ? 'bg-green-500 text-neutral-0' : step === 2 ? 'bg-accent-500 text-neutral-0' : 'bg-primary-700 text-neutral-400'
          }`}>
            {step > 2 ? '✓' : '2'}
          </div>
          <p className="text-xs text-neutral-300 mt-2">Invoice</p>
        </div>

        <div className={`h-1 w-16 rounded-full transition-all ${step >= 3 ? 'bg-green-500' : 'bg-primary-700'}`} />

        <div className={`flex flex-col items-center ${step >= 3 ? 'opacity-100' : 'opacity-50'}`}>
          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all ${
            step === 3 ? 'bg-green-500 text-neutral-0' : 'bg-primary-700 text-neutral-400'
          }`}>
            ✓
          </div>
          <p className="text-xs text-neutral-300 mt-2">Done</p>
        </div>
      </div>

      {/* Step 1: Single Account */}
      {step === 1 && mode === 'single' && (
        <div className="bg-gradient-to-br from-primary-700/30 to-primary-800/30 border border-accent-500/10 rounded-xl p-8 space-y-6 shadow-lg">
          <h2 className="text-2xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-neutral-0 to-neutral-200">
            Step 1: Create Account
          </h2>
          <p className="text-neutral-400">Set up a single organization account</p>

          {accountError && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-300 rounded-lg text-sm flex items-start gap-3">
              <span className="text-lg">⚠️</span>
              <span>{accountError}</span>
            </div>
          )}

          {accountExists && (
            <div className="p-4 bg-blue-500/10 border border-blue-500/20 text-blue-300 rounded-lg text-sm flex items-start gap-3">
              <span className="text-lg">ℹ️</span>
              <span>Account already exists for {singleForm.email}. You can still create an invoice.</span>
            </div>
          )}

          <form onSubmit={handleSingleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-neutral-300 mb-2">Email *</label>
                <input
                  type="email"
                  name="email"
                  placeholder="org@example.com"
                  value={singleForm.email}
                  onChange={handleSingleChange}
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
                  value={singleForm.orgName}
                  onChange={handleSingleChange}
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
                  min="1"
                  placeholder="30"
                  value={singleForm.durationDays}
                  onChange={handleSingleChange}
                  required
                  className="w-full px-4 py-3 bg-primary-800/50 border border-accent-500/20 rounded-lg text-neutral-0 placeholder-neutral-500 focus:outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm text-neutral-300 mb-2">Session Limit (minutes/month) *</label>
                <input
                  type="number"
                  name="sessionLimitMinutes"
                  min="10"
                  placeholder="120"
                  value={singleForm.sessionLimitMinutes}
                  onChange={handleSingleChange}
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
                checked={singleForm.sendWelcomeEmail}
                onChange={handleSingleChange}
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
              {accountLoading ? 'Creating...' : singleForm.sendWelcomeEmail ? 'Create & Send Email' : 'Continue to Invoice'}
            </LoadingButton>
          </form>
        </div>
      )}

      {/* Step 1: Bulk Accounts */}
      {step === 1 && mode === 'bulk' && (
        <div className="bg-gradient-to-br from-primary-700/30 to-primary-800/30 border border-accent-500/10 rounded-xl p-8 space-y-6 shadow-lg">
          <div>
            <h2 className="text-2xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-neutral-0 to-neutral-200">
              Step 1: Create Multi-Seat Accounts
            </h2>
            <p className="text-neutral-400 mt-1">
              Create N pre-provisioned child accounts that share one invoice. The billing email pays; each seat gets its own login.
            </p>
          </div>

          {accountError && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-300 rounded-lg text-sm flex items-start gap-3">
              <span className="text-lg">⚠️</span>
              <span>{accountError}</span>
            </div>
          )}

          <form onSubmit={handleBulkSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-neutral-300 mb-2">Organization Name</label>
                <input
                  type="text"
                  name="orgName"
                  placeholder="Islamic Center"
                  value={bulkForm.orgName}
                  onChange={handleBulkChange}
                  className="w-full px-4 py-3 bg-primary-800/50 border border-accent-500/20 rounded-lg text-neutral-0 placeholder-neutral-500 focus:outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm text-neutral-300 mb-2">Billing Email *</label>
                <input
                  type="email"
                  name="billingEmail"
                  placeholder="billing@islamic-center.org"
                  value={bulkForm.billingEmail}
                  onChange={handleBulkChange}
                  required
                  className="w-full px-4 py-3 bg-primary-800/50 border border-accent-500/20 rounded-lg text-neutral-0 placeholder-neutral-500 focus:outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 transition-all"
                />
                <p className="text-xs text-neutral-500 mt-1">Single invoice is sent here</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-neutral-300 mb-2">Email Prefix *</label>
                <input
                  type="text"
                  name="emailPrefix"
                  placeholder="seat"
                  value={bulkForm.emailPrefix}
                  onChange={handleBulkChange}
                  required
                  className="w-full px-4 py-3 bg-primary-800/50 border border-accent-500/20 rounded-lg text-neutral-0 placeholder-neutral-500 focus:outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm text-neutral-300 mb-2">Email Domain *</label>
                <input
                  type="text"
                  name="emailDomain"
                  placeholder="example.org"
                  value={bulkForm.emailDomain}
                  onChange={handleBulkChange}
                  required
                  className="w-full px-4 py-3 bg-primary-800/50 border border-accent-500/20 rounded-lg text-neutral-0 placeholder-neutral-500 focus:outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm text-neutral-300 mb-2">Seat Count *</label>
                <input
                  type="number"
                  name="count"
                  min="1"
                  max="50"
                  value={bulkForm.count}
                  onChange={handleBulkChange}
                  required
                  className="w-full px-4 py-3 bg-primary-800/50 border border-accent-500/20 rounded-lg text-neutral-0 focus:outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 transition-all"
                />
              </div>
            </div>

            <p className="text-xs text-neutral-500">
              Preview: {bulkForm.emailPrefix}+1@{bulkForm.emailDomain}, {bulkForm.emailPrefix}+2@{bulkForm.emailDomain}, …
            </p>

            <div>
              <label className="block text-sm text-neutral-300 mb-2">Shared Password *</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  name="password"
                  placeholder="Min 8 characters"
                  value={bulkForm.password}
                  onChange={handleBulkChange}
                  required
                  minLength={8}
                  className="flex-1 px-4 py-3 bg-primary-800/50 border border-accent-500/20 rounded-lg text-neutral-0 placeholder-neutral-500 focus:outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 transition-all font-mono"
                />
                <button
                  type="button"
                  onClick={() => setBulkForm(prev => ({ ...prev, password: generatePassword() }))}
                  className="px-4 py-3 bg-primary-700 hover:bg-primary-600 text-neutral-100 rounded-lg transition-colors font-medium text-sm"
                >
                  Generate
                </button>
              </div>
              <p className="text-xs text-neutral-500 mt-1">All child accounts use the same password. Share with the admin after creation.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-neutral-300 mb-2">Duration (Days) *</label>
                <input
                  type="number"
                  name="durationDays"
                  min="1"
                  value={bulkForm.durationDays}
                  onChange={handleBulkChange}
                  required
                  className="w-full px-4 py-3 bg-primary-800/50 border border-accent-500/20 rounded-lg text-neutral-0 focus:outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm text-neutral-300 mb-2">Session Limit per Seat (min/mo) *</label>
                <input
                  type="number"
                  name="sessionLimitMinutes"
                  min="10"
                  value={bulkForm.sessionLimitMinutes}
                  onChange={handleBulkChange}
                  required
                  className="w-full px-4 py-3 bg-primary-800/50 border border-accent-500/20 rounded-lg text-neutral-0 focus:outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 transition-all"
                />
              </div>
            </div>

            <LoadingButton
              isLoading={accountLoading}
              className="w-full px-6 py-3 rounded-lg font-body bg-accent-500 hover:bg-accent-400 text-neutral-0 transition-all duration-200 disabled:opacity-50"
              type="submit"
            >
              {accountLoading ? `Creating ${bulkForm.count} accounts...` : `Create ${bulkForm.count} Accounts & Continue`}
            </LoadingButton>
          </form>
        </div>
      )}

      {/* Step 2: Invoice */}
      {step === 2 && recipientSummary && (
        <div className="bg-gradient-to-br from-primary-700/30 to-primary-800/30 border border-accent-500/10 rounded-xl p-8 space-y-6 shadow-lg">
          <h2 className="text-2xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-neutral-0 to-neutral-200">
            Step 2: Create Invoice
          </h2>
          <p className="text-neutral-400">
            {mode === 'bulk'
              ? `One invoice billing ${recipientSummary.email} for ${recipientSummary.seats} seat(s)`
              : `Generate an invoice for ${recipientSummary.email}`}
          </p>

          {invoiceError && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-300 rounded-lg text-sm flex items-start gap-3">
              <span className="text-lg">⚠️</span>
              <span>{invoiceError}</span>
            </div>
          )}

          <form onSubmit={handleInvoiceSubmit} className="space-y-6">
            <div className="p-4 bg-primary-800/30 border border-accent-500/20 rounded-lg">
              <p className="text-xs text-neutral-400 uppercase tracking-wide mb-2">Billing Recipient</p>
              <p className="text-neutral-0 font-semibold">{recipientSummary.email}</p>
              {recipientSummary.org && <p className="text-sm text-neutral-300 mt-1">{recipientSummary.org}</p>}
              {mode === 'bulk' && (
                <p className="text-xs text-accent-400 mt-2">Activates {recipientSummary.seats} seat(s) on payment</p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-neutral-300 mb-2">Amount *</label>
                <input
                  type="number"
                  name="amount"
                  placeholder="150"
                  step="0.01"
                  min="0"
                  value={invoiceForm.amount}
                  onChange={e => {
                    handleInvoiceChange(e)
                    if (invoiceForm.promoCodeId) setTimeout(() => validateDiscount(), 0)
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
                    if (invoiceForm.promoCodeId) setTimeout(() => validateDiscount(), 0)
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
                  min={todayIso()}
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
                <label className="block text-sm text-neutral-300 mb-2">Duration (Days) per seat</label>
                <input
                  type="number"
                  name="durationDays"
                  min="1"
                  value={invoiceForm.durationDays}
                  onChange={handleInvoiceChange}
                  className="w-full px-4 py-3 bg-primary-800/50 border border-accent-500/20 rounded-lg text-neutral-0 focus:outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm text-neutral-300 mb-2">Session Limit (min/mo) per seat</label>
                <input
                  type="number"
                  name="sessionLimitMinutes"
                  min="10"
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
                  if (e.target.value) setTimeout(() => validateDiscount(), 0)
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
              <button
                type="button"
                onClick={() => setStep(3)}
                className="px-6 py-3 rounded-lg font-body bg-primary-700/60 hover:bg-primary-600 text-neutral-400 hover:text-neutral-0 border border-accent-500/10 transition-all duration-200 text-sm"
                title="Skip invoice — account is already created"
              >
                Skip
              </button>
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
              {mode === 'bulk' ? 'Accounts Created!' : invoiceResult ? 'Setup Complete!' : 'Account Ready!'}
            </h2>
            <p className="text-neutral-300">
              {mode === 'bulk' && bulkResult
                ? `${bulkResult.created}/${bulkResult.total} accounts created${invoiceResult ? `. Invoice sent to ${bulkResult.billingEmail}.` : ' — invoice skipped.'}`
                : invoiceResult
                ? `Invoice created and sent to ${accountResult?.email}`
                : `Account created for ${accountResult?.email} — share the credentials below.`}
            </p>
          </div>

          <div className="bg-primary-800/30 border border-accent-500/10 rounded-lg p-6 space-y-4">
            {mode === 'bulk' && bulkResult ? (
              <>
                <div>
                  <p className="text-xs text-neutral-400 uppercase tracking-wide mb-2">Billing</p>
                  <p className="text-neutral-0 font-mono text-sm">{bulkResult.billingEmail}</p>
                  {bulkResult.orgName && <p className="text-neutral-300 text-sm mt-1">{bulkResult.orgName}</p>}
                </div>
                <div className="pt-4 border-t border-accent-500/10">
                  <CopyRow label="Shared Password" value={bulkResult.password} sensitive />
                  <p className="text-xs text-amber-400 mt-2">⚠ Save this password — it is not stored. Distribute to seat holders after invoice is paid.</p>
                </div>
                <div className="pt-4 border-t border-accent-500/10">
                  <p className="text-xs text-neutral-400 uppercase tracking-wide mb-2">Accounts ({bulkResult.created}/{bulkResult.total})</p>
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {bulkResult.accounts.map((acc, idx) => (
                      <div key={idx} className={`text-xs font-mono ${acc.success ? 'text-green-300' : 'text-red-300'}`}>
                        {acc.success ? '✓' : '✗'} {acc.email}
                        {acc.error && <span className="text-neutral-500"> — {acc.error}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : accountResult && (
              <div className="space-y-4">
                {accountResult.orgName && (
                  <p className="text-neutral-300 text-sm font-medium">{accountResult.orgName}</p>
                )}
                <CopyRow label="Email" value={accountResult.email} />
                {accountResult.temporaryPassword ? (
                  <CopyRow label="Password" value={accountResult.temporaryPassword} sensitive />
                ) : accountResult.existed ? (
                  <div>
                    <p className="text-xs text-neutral-400 uppercase tracking-wide mb-1">Password</p>
                    <p className="text-xs text-neutral-500 italic">Existing account — password unchanged</p>
                  </div>
                ) : null}
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

          <div className="flex gap-3 pt-4 flex-wrap">
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
