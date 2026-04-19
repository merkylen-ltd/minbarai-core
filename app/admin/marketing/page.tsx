'use client'

import { useState } from 'react'
import { Eye, EyeOff, Copy, Check, Zap, RotateCcw, Clock, Calendar, ExternalLink } from 'lucide-react'

interface CreateAccountForm {
  email: string
  password: string
  sessionLimitMinutes: number
  withSubscription: boolean
  expiresInDays: number
  note: string
}

interface BulkSeedForm {
  emailPrefix: string
  emailDomain: string
  count: number
  password: string
  sessionLimitMinutes: number
  withSubscription: boolean
  expiresInDays: number
}

interface QuickActionForm {
  userEmail: string
  newSessionLimit?: number
}

const generatePassword = (): string => {
  const length = Math.random() < 0.5 ? 12 : 14
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'
  let password = ''
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return password
}

export default function MarketingToolsPage() {
  const [createForm, setCreateForm] = useState<CreateAccountForm>({
    email: '',
    password: '',
    sessionLimitMinutes: 180,
    withSubscription: false,
    expiresInDays: 30,
    note: ''
  })
  const [createLoading, setCreateLoading] = useState(false)
  const [createResult, setCreateResult] = useState<any>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showBulkPassword, setShowBulkPassword] = useState(false)
  const [copied, setCopied] = useState(false)

  const [bulkForm, setBulkForm] = useState<BulkSeedForm>({
    emailPrefix: 'demo',
    emailDomain: 'minbarai.com',
    count: 3,
    password: '',
    sessionLimitMinutes: 180,
    withSubscription: false,
    expiresInDays: 30
  })
  const [bulkLoading, setBulkLoading] = useState(false)
  const [bulkResult, setBulkResult] = useState<any>(null)

  const [quickForm, setQuickForm] = useState<QuickActionForm>({
    userEmail: ''
  })
  const [quickLoading, setQuickLoading] = useState(false)
  const [quickUser, setQuickUser] = useState<any>(null)
  const [quickMessage, setQuickMessage] = useState<string | null>(null)
  const [editingLimit, setEditingLimit] = useState(false)

  const handleCopyPassword = (password: string) => {
    navigator.clipboard.writeText(password)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleGeneratePassword = (target: 'create' | 'bulk') => {
    const newPassword = generatePassword()
    if (target === 'create') {
      setCreateForm({ ...createForm, password: newPassword })
    } else {
      setBulkForm({ ...bulkForm, password: newPassword })
    }
  }

  const handleCreateAccount = async () => {
    if (!createForm.email || !createForm.password) {
      setCreateResult({ error: 'Email and password required' })
      return
    }

    setCreateLoading(true)
    setCreateResult(null)

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm)
      })

      const data = await res.json()

      if (data.success) {
        setCreateResult({
          success: true,
          ...data,
          password: createForm.password
        })
        setCreateForm({ email: '', password: '', sessionLimitMinutes: 180, withSubscription: false, expiresInDays: 30, note: '' })
      } else {
        setCreateResult({ error: data.error || 'Failed to create account' })
      }
    } catch (err) {
      setCreateResult({ error: 'Network error' })
    } finally {
      setCreateLoading(false)
    }
  }

  const handleBulkSeed = async () => {
    if (!bulkForm.emailPrefix || !bulkForm.emailDomain || !bulkForm.password) {
      setBulkResult({ error: 'All fields required' })
      return
    }

    setBulkLoading(true)
    setBulkResult(null)

    try {
      const res = await fetch('/api/admin/marketing/bulk-seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bulkForm)
      })

      const data = await res.json()

      if (data.success) {
        setBulkResult({
          ...data,
          password: bulkForm.password
        })
        setBulkForm({ ...bulkForm, password: '' })
      } else {
        setBulkResult(data)
      }
    } catch (err) {
      setBulkResult({ error: 'Network error' })
    } finally {
      setBulkLoading(false)
    }
  }

  const handleSearchUser = async () => {
    if (!quickForm.userEmail) return

    setQuickLoading(true)
    setQuickUser(null)
    setQuickMessage(null)

    try {
      const res = await fetch(`/api/admin/users?search=${encodeURIComponent(quickForm.userEmail)}&limit=1`)
      const data = await res.json()

      if (data.users && data.users.length > 0) {
        setQuickUser(data.users[0])
        setEditingLimit(false)
      } else {
        setQuickMessage('User not found')
      }
    } catch (err) {
      setQuickMessage('Search error')
    } finally {
      setQuickLoading(false)
    }
  }

  const handleResetUsage = async () => {
    if (!quickUser) return

    setQuickLoading(true)
    try {
      const res = await fetch(`/api/admin/users/${quickUser.id}/reset-usage`, {
        method: 'POST'
      })
      const data = await res.json()

      if (data.success) {
        setQuickMessage(`✓ Cleared ${data.deletedCount} sessions`)
        setTimeout(() => setQuickMessage(null), 3000)
      } else {
        setQuickMessage('Failed to reset usage')
      }
    } catch (err) {
      setQuickMessage('Error resetting usage')
    } finally {
      setQuickLoading(false)
    }
  }

  const handleUpdateSessionLimit = async () => {
    if (!quickUser || !quickForm.newSessionLimit) return

    setQuickLoading(true)
    try {
      const res = await fetch(`/api/admin/users/${quickUser.id}/session-limit`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionLimitMinutes: parseInt(quickForm.newSessionLimit as any) })
      })
      const data = await res.json()

      if (data.success) {
        setQuickUser({ ...quickUser, session_limit_minutes: data.sessionLimitMinutes })
        setEditingLimit(false)
        setQuickMessage('✓ Session limit updated')
        setTimeout(() => setQuickMessage(null), 3000)
      } else {
        setQuickMessage(data.error || 'Failed to update')
      }
    } catch (err) {
      setQuickMessage('Error updating session limit')
    } finally {
      setQuickLoading(false)
    }
  }

  const handleExtendSubscription = async () => {
    if (!quickUser) return

    setQuickLoading(true)
    try {
      const res = await fetch(`/api/admin/subscriptions/${quickUser.id}/extend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: 30 })
      })
      const data = await res.json()

      if (data.success) {
        setQuickMessage('✓ Subscription extended 30 days')
        setTimeout(() => {
          setQuickMessage(null)
          handleSearchUser()
        }, 2000)
      } else {
        setQuickMessage(data.error || 'Failed to extend')
      }
    } catch (err) {
      setQuickMessage('Error extending subscription')
    } finally {
      setQuickLoading(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-4xl font-display font-bold text-neutral-0">Marketing Tools</h1>
        <p className="text-neutral-400 mt-2">Create demo accounts and manage test users</p>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column: Create Accounts */}
        <div className="space-y-6">
          {/* Create Single Account */}
          <div className="bg-primary-800/30 border border-accent-500/10 rounded-xl p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-neutral-0 mb-5">Create Account</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-neutral-400 text-sm font-medium mb-2">Email</label>
                <input
                  type="email"
                  placeholder="demo@example.com"
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  className="w-full px-4 py-2.5 bg-primary-800/50 border border-neutral-700 rounded-lg text-neutral-0 placeholder-neutral-600 focus:outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500/30 transition-all"
                />
              </div>

              <div>
                <label className="block text-neutral-400 text-sm font-medium mb-2">Password</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Min 8 characters"
                      value={createForm.password}
                      onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                      className="w-full px-4 py-2.5 bg-primary-800/50 border border-neutral-700 rounded-lg text-neutral-0 placeholder-neutral-600 focus:outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500/30 transition-all pr-10"
                    />
                    <button
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-neutral-500 hover:text-neutral-300"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <button
                    onClick={() => handleGeneratePassword('create')}
                    className="px-4 py-2.5 bg-neutral-700 hover:bg-neutral-600 text-neutral-300 rounded-lg transition-colors"
                    title="Generate secure password"
                  >
                    <Zap className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-neutral-400 text-sm font-medium mb-2">Session Limit (min)</label>
                  <input
                    type="number"
                    min="10"
                    max="10080"
                    value={createForm.sessionLimitMinutes}
                    onChange={(e) => setCreateForm({ ...createForm, sessionLimitMinutes: parseInt(e.target.value) })}
                    className="w-full px-4 py-2.5 bg-primary-800/50 border border-neutral-700 rounded-lg text-neutral-0 focus:outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500/30 transition-all"
                  />
                </div>
                <div>
                  <label className="flex items-center space-x-2 text-neutral-400 text-sm font-medium mb-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={createForm.withSubscription}
                      onChange={(e) => setCreateForm({ ...createForm, withSubscription: e.target.checked })}
                      className="w-4 h-4 rounded"
                    />
                    <span>Subscription</span>
                  </label>
                  {createForm.withSubscription && (
                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={createForm.expiresInDays}
                      onChange={(e) => setCreateForm({ ...createForm, expiresInDays: parseInt(e.target.value) })}
                      className="w-full px-4 py-2.5 bg-primary-800/50 border border-neutral-700 rounded-lg text-neutral-0 focus:outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500/30 transition-all"
                      placeholder="Days"
                    />
                  )}
                </div>
              </div>

              <div>
                <label className="block text-neutral-400 text-sm font-medium mb-2">Note (optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Testing notes"
                  value={createForm.note}
                  onChange={(e) => setCreateForm({ ...createForm, note: e.target.value })}
                  className="w-full px-4 py-2.5 bg-primary-800/50 border border-neutral-700 rounded-lg text-neutral-0 placeholder-neutral-600 focus:outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500/30 transition-all"
                />
              </div>
            </div>

            <button
              onClick={handleCreateAccount}
              disabled={createLoading || !createForm.email || !createForm.password}
              className="w-full mt-6 px-6 py-3 bg-accent-500 text-neutral-0 font-semibold rounded-lg hover:bg-accent-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {createLoading ? 'Creating...' : 'Create Account'}
            </button>

            {createResult && (
              <div className={`mt-4 p-4 rounded-lg text-sm ${
                createResult.success
                  ? 'bg-green-500/10 border border-green-500/20 text-green-300'
                  : 'bg-red-500/10 border border-red-500/20 text-red-300'
              }`}>
                {createResult.success ? (
                  <div className="space-y-3">
                    <p className="font-semibold">✓ Account created</p>
                    <div className="space-y-2 text-xs font-mono bg-primary-900/30 p-3 rounded border border-neutral-700">
                      <div>Email: {createResult.email}</div>
                      <div className="flex items-center justify-between">
                        <span>Password: {createResult.password}</span>
                        <button
                          onClick={() => handleCopyPassword(createResult.password)}
                          className="text-accent-400 hover:text-accent-300"
                        >
                          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p>✗ {createResult.error}</p>
                )}
              </div>
            )}
          </div>

          {/* Bulk Seed Accounts */}
          <div className="bg-primary-800/30 border border-accent-500/10 rounded-xl p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-neutral-0 mb-5">Bulk Create Accounts</h2>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-neutral-400 text-sm font-medium mb-2">Prefix</label>
                  <input
                    type="text"
                    placeholder="demo"
                    value={bulkForm.emailPrefix}
                    onChange={(e) => setBulkForm({ ...bulkForm, emailPrefix: e.target.value })}
                    className="w-full px-4 py-2.5 bg-primary-800/50 border border-neutral-700 rounded-lg text-neutral-0 placeholder-neutral-600 focus:outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500/30 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-neutral-400 text-sm font-medium mb-2">Domain</label>
                  <input
                    type="text"
                    placeholder="minbarai.com"
                    value={bulkForm.emailDomain}
                    onChange={(e) => setBulkForm({ ...bulkForm, emailDomain: e.target.value })}
                    className="w-full px-4 py-2.5 bg-primary-800/50 border border-neutral-700 rounded-lg text-neutral-0 placeholder-neutral-600 focus:outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500/30 transition-all"
                  />
                </div>
              </div>

              <p className="text-xs text-neutral-500">Preview: {bulkForm.emailPrefix}+1@{bulkForm.emailDomain}</p>

              <div>
                <label className="block text-neutral-400 text-sm font-medium mb-2">Count (1–50)</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={bulkForm.count}
                  onChange={(e) => setBulkForm({ ...bulkForm, count: parseInt(e.target.value) })}
                  className="w-full px-4 py-2.5 bg-primary-800/50 border border-neutral-700 rounded-lg text-neutral-0 focus:outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500/30 transition-all"
                />
              </div>

              <div>
                <label className="block text-neutral-400 text-sm font-medium mb-2">Password</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showBulkPassword ? 'text' : 'password'}
                      placeholder="Min 8 characters"
                      value={bulkForm.password}
                      onChange={(e) => setBulkForm({ ...bulkForm, password: e.target.value })}
                      className="w-full px-4 py-2.5 bg-primary-800/50 border border-neutral-700 rounded-lg text-neutral-0 placeholder-neutral-600 focus:outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500/30 transition-all pr-10"
                    />
                    <button
                      onClick={() => setShowBulkPassword(!showBulkPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-neutral-500 hover:text-neutral-300"
                    >
                      {showBulkPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <button
                    onClick={() => handleGeneratePassword('bulk')}
                    className="px-4 py-2.5 bg-neutral-700 hover:bg-neutral-600 text-neutral-300 rounded-lg transition-colors"
                    title="Generate secure password"
                  >
                    <Zap className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-neutral-400 text-sm font-medium mb-2">Session Limit (min)</label>
                  <input
                    type="number"
                    min="10"
                    max="10080"
                    value={bulkForm.sessionLimitMinutes}
                    onChange={(e) => setBulkForm({ ...bulkForm, sessionLimitMinutes: parseInt(e.target.value) })}
                    className="w-full px-4 py-2.5 bg-primary-800/50 border border-neutral-700 rounded-lg text-neutral-0 focus:outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500/30 transition-all"
                  />
                </div>
                <div>
                  <label className="flex items-center space-x-2 text-neutral-400 text-sm font-medium mb-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={bulkForm.withSubscription}
                      onChange={(e) => setBulkForm({ ...bulkForm, withSubscription: e.target.checked })}
                      className="w-4 h-4 rounded"
                    />
                    <span>Subscription</span>
                  </label>
                  {bulkForm.withSubscription && (
                    <input
                      type="number"
                      min="1"
                      value={bulkForm.expiresInDays}
                      onChange={(e) => setBulkForm({ ...bulkForm, expiresInDays: parseInt(e.target.value) })}
                      className="w-full px-4 py-2.5 bg-primary-800/50 border border-neutral-700 rounded-lg text-neutral-0 focus:outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500/30 transition-all"
                      placeholder="Days"
                    />
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={handleBulkSeed}
              disabled={bulkLoading || !bulkForm.emailPrefix || !bulkForm.password}
              className="w-full mt-6 px-6 py-3 bg-accent-500 text-neutral-0 font-semibold rounded-lg hover:bg-accent-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {bulkLoading ? 'Creating...' : `Create ${bulkForm.count} Accounts`}
            </button>

            {bulkResult && (
              <div className={`mt-4 p-4 rounded-lg text-sm ${
                bulkResult.success
                  ? 'bg-green-500/10 border border-green-500/20 text-green-300'
                  : 'bg-red-500/10 border border-red-500/20 text-red-300'
              }`}>
                {bulkResult.success ? (
                  <div className="space-y-3">
                    <p className="font-semibold">✓ Created {bulkResult.created}/{bulkResult.total} accounts</p>
                    {bulkResult.password && (
                      <div className="text-xs font-mono bg-primary-900/30 p-2 rounded border border-neutral-700 flex items-center justify-between">
                        <span>Password: {bulkResult.password}</span>
                        <button
                          onClick={() => handleCopyPassword(bulkResult.password)}
                          className="text-accent-400 hover:text-accent-300"
                        >
                          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    )}
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {bulkResult.accounts.map((acc: any, idx: number) => (
                        <div key={idx} className={`text-xs ${acc.success ? 'text-green-400' : 'text-red-400'}`}>
                          {acc.success ? '✓' : '✗'} {acc.email}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p>✗ {bulkResult.error}</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Quick Actions */}
        <div className="bg-primary-800/30 border border-accent-500/10 rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-neutral-0 mb-5">Quick Actions</h2>

          <div className="flex gap-2 mb-6">
            <input
              type="email"
              placeholder="Search user by email..."
              value={quickForm.userEmail}
              onChange={(e) => setQuickForm({ ...quickForm, userEmail: e.target.value })}
              className="flex-1 px-4 py-2.5 bg-primary-800/50 border border-neutral-700 rounded-lg text-neutral-0 placeholder-neutral-600 focus:outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500/30 transition-all"
              onKeyPress={(e) => e.key === 'Enter' && handleSearchUser()}
            />
            <button
              onClick={handleSearchUser}
              disabled={quickLoading || !quickForm.userEmail}
              className="px-4 py-2.5 bg-accent-500 text-neutral-0 font-semibold rounded-lg hover:bg-accent-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Search
            </button>
          </div>

          {quickMessage && (
            <div className={`mb-4 p-3 rounded-lg text-sm ${
              quickMessage.startsWith('✓')
                ? 'bg-green-500/10 border border-green-500/20 text-green-300'
                : 'bg-amber-500/10 border border-amber-500/20 text-amber-300'
            }`}>
              {quickMessage}
            </div>
          )}

          {quickUser && (
            <div className="space-y-6">
              {/* User Info */}
              <div className="pb-6 border-b border-neutral-700">
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Email</p>
                    <p className="text-neutral-0 font-semibold mt-1">{quickUser.email}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Subscription</p>
                      <div className="mt-1 flex items-center gap-2">
                        <span className={`inline-block w-2 h-2 rounded-full ${
                          quickUser.subscription_status === 'active' ? 'bg-green-500' : 'bg-neutral-600'
                        }`} />
                        <span className="text-neutral-0 text-sm">
                          {quickUser.subscription_status ? quickUser.subscription_status.charAt(0).toUpperCase() + quickUser.subscription_status.slice(1) : 'None'}
                        </span>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Session Limit</p>
                      <p className="text-neutral-0 text-sm font-semibold mt-1">{quickUser.session_limit_minutes} min</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Status</p>
                      <div className="mt-1 flex items-center gap-2">
                        <span className={`inline-block w-2 h-2 rounded-full ${
                          quickUser.is_suspended ? 'bg-red-500' : 'bg-green-500'
                        }`} />
                        <span className="text-neutral-0 text-sm">
                          {quickUser.is_suspended ? 'Suspended' : 'Active'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions - Usage Section */}
              <div>
                <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-3">Usage</p>
                <button
                  onClick={handleResetUsage}
                  disabled={quickLoading}
                  className="w-full px-4 py-3 bg-primary-700 hover:bg-primary-600 text-neutral-100 rounded-lg transition-colors font-medium text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  Clear Usage Sessions
                </button>
              </div>

              {/* Actions - Session Section */}
              <div>
                <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-3">Session Management</p>
                {editingLimit ? (
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min="10"
                      max="10080"
                      defaultValue={quickUser.session_limit_minutes}
                      onChange={(e) => setQuickForm({ ...quickForm, newSessionLimit: parseInt(e.target.value) })}
                      className="flex-1 px-4 py-2.5 bg-primary-800/50 border border-neutral-700 rounded-lg text-neutral-0 focus:outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500/30 transition-all"
                      placeholder="Minutes"
                    />
                    <button
                      onClick={handleUpdateSessionLimit}
                      disabled={quickLoading}
                      className="px-4 py-3 bg-accent-500 text-neutral-0 font-semibold rounded-lg hover:bg-accent-400 disabled:opacity-50 transition-all"
                    >
                      Save
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setEditingLimit(true)}
                    className="w-full px-4 py-3 bg-primary-700 hover:bg-primary-600 text-neutral-100 rounded-lg transition-colors font-medium text-sm flex items-center justify-center gap-2"
                  >
                    <Clock className="w-4 h-4" />
                    Edit Session Limit
                  </button>
                )}
              </div>

              {/* Actions - Billing Section */}
              <div>
                <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-3">Billing</p>
                <button
                  onClick={handleExtendSubscription}
                  disabled={quickLoading}
                  className="w-full px-4 py-3 bg-primary-700 hover:bg-primary-600 text-neutral-100 rounded-lg transition-colors font-medium text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Calendar className="w-4 h-4" />
                  Extend Subscription (+30 days)
                </button>
              </div>

              {/* Navigation */}
              <div>
                <a
                  href={`/admin/users/${quickUser.id}`}
                  className="w-full px-4 py-3 bg-accent-500/20 hover:bg-accent-500/30 text-accent-300 rounded-lg transition-colors font-medium text-sm flex items-center justify-center gap-2 border border-accent-500/30"
                >
                  <ExternalLink className="w-4 h-4" />
                  View Full Profile
                </a>
              </div>
            </div>
          )}

          {!quickUser && !quickLoading && (
            <div className="py-12 text-center">
              <p className="text-neutral-500 text-sm">Enter an email to search and manage user accounts</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
