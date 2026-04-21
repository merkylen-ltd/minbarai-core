'use client'

import { useState } from 'react'
import { RotateCcw, Clock, Calendar, ExternalLink } from 'lucide-react'

interface EmailForm {
  to: string
  subject: string
  message: string
}

interface UserRecord {
  id: string
  email: string
  subscription_status: string | null
  session_limit_minutes: number
  is_suspended: boolean
}

export default function ActionsPage() {
  // Email sender
  const [email, setEmail] = useState<EmailForm>({ to: '', subject: '', message: '' })
  const [sending, setSending] = useState(false)
  const [emailResult, setEmailResult] = useState<string | null>(null)

  // User quick actions
  const [userQuery, setUserQuery] = useState('')
  const [foundUser, setFoundUser] = useState<UserRecord | null>(null)
  const [userLoading, setUserLoading] = useState(false)
  const [userMessage, setUserMessage] = useState<string | null>(null)
  const [editingLimit, setEditingLimit] = useState(false)
  const [newSessionLimit, setNewSessionLimit] = useState<number | ''>('')

  const handleSendEmail = async () => {
    if (!email.to || !email.subject || !email.message) {
      setEmailResult('All fields are required')
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email.to)) {
      setEmailResult('Please enter a valid email address')
      return
    }

    setSending(true)
    setEmailResult(null)
    try {
      const res = await fetch('/api/admin/actions/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userEmail: email.to, subject: email.subject, message: email.message }),
      })
      const data = await res.json()

      if (data.success) {
        setEmailResult('✓ Email sent successfully to ' + data.recipientEmail)
        setEmail({ to: '', subject: '', message: '' })
      } else {
        if (data.code === 'USER_NOT_FOUND' || res.status === 404) {
          setEmailResult('⚠ User not found: ' + (data.error || 'This email is not registered in the system'))
        } else {
          setEmailResult('✗ ' + (data.error || 'Failed to send email'))
        }
      }
    } catch {
      setEmailResult('✗ Error sending email: Network error')
    } finally {
      setSending(false)
    }
  }

  const handleSearchUser = async () => {
    if (!userQuery) return

    setUserLoading(true)
    setFoundUser(null)
    setUserMessage(null)

    try {
      const res = await fetch(`/api/admin/users?search=${encodeURIComponent(userQuery)}&limit=1`)
      const data = await res.json()

      if (data.users && data.users.length > 0) {
        setFoundUser(data.users[0])
        setEditingLimit(false)
      } else {
        setUserMessage('User not found')
      }
    } catch {
      setUserMessage('Search error')
    } finally {
      setUserLoading(false)
    }
  }

  const handleResetUsage = async () => {
    if (!foundUser) return

    setUserLoading(true)
    try {
      const res = await fetch(`/api/admin/users/${foundUser.id}/reset-usage`, { method: 'POST' })
      const data = await res.json()

      if (data.success) {
        setUserMessage(`✓ Cleared ${data.deletedCount} sessions`)
        setTimeout(() => setUserMessage(null), 3000)
      } else {
        setUserMessage('Failed to reset usage')
      }
    } catch {
      setUserMessage('Error resetting usage')
    } finally {
      setUserLoading(false)
    }
  }

  const handleUpdateSessionLimit = async () => {
    if (!foundUser || !newSessionLimit) return

    setUserLoading(true)
    try {
      const res = await fetch(`/api/admin/users/${foundUser.id}/session-limit`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionLimitMinutes: Number(newSessionLimit) }),
      })
      const data = await res.json()

      if (data.success) {
        setFoundUser({ ...foundUser, session_limit_minutes: data.sessionLimitMinutes })
        setEditingLimit(false)
        setUserMessage('✓ Session limit updated')
        setTimeout(() => setUserMessage(null), 3000)
      } else {
        setUserMessage(data.error || 'Failed to update')
      }
    } catch {
      setUserMessage('Error updating session limit')
    } finally {
      setUserLoading(false)
    }
  }

  const handleExtendSubscription = async () => {
    if (!foundUser) return

    setUserLoading(true)
    try {
      const res = await fetch(`/api/admin/subscriptions/${foundUser.id}/extend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: 30 }),
      })
      const data = await res.json()

      if (data.success) {
        setUserMessage('✓ Subscription extended 30 days')
        setTimeout(() => {
          setUserMessage(null)
          handleSearchUser()
        }, 2000)
      } else {
        setUserMessage(data.error || 'Failed to extend')
      }
    } catch {
      setUserMessage('Error extending subscription')
    } finally {
      setUserLoading(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="border-b border-accent-500/20 pb-6">
        <h1 className="text-4xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-neutral-0 to-neutral-200">
          Quick Actions
        </h1>
        <p className="text-neutral-300 mt-2 text-lg">
          Manage users, send emails, and perform administrative tasks
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* User Management */}
        <div className="bg-gradient-to-br from-primary-700/30 to-primary-800/30 border border-accent-500/10 rounded-xl p-6 shadow-lg">
          <div className="flex items-center space-x-3 mb-5">
            <div className="w-12 h-12 rounded-xl bg-accent-500/20 border border-accent-500/30 flex items-center justify-center">
              <svg className="w-6 h-6 text-accent-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div>
              <h2 className="text-neutral-0 font-display text-xl font-bold">User Management</h2>
              <p className="text-neutral-400 text-sm">Find and manage a single user</p>
            </div>
          </div>

          <div className="flex gap-2 mb-6">
            <input
              type="email"
              placeholder="Search user by email..."
              value={userQuery}
              onChange={(e) => setUserQuery(e.target.value)}
              className="flex-1 px-4 py-2.5 bg-primary-800/50 border border-accent-500/20 rounded-lg text-neutral-0 placeholder-neutral-500 focus:outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 transition-all"
              onKeyDown={(e) => e.key === 'Enter' && handleSearchUser()}
            />
            <button
              onClick={handleSearchUser}
              disabled={userLoading || !userQuery}
              className="px-4 py-2.5 bg-accent-500 text-neutral-0 font-semibold rounded-lg hover:bg-accent-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Search
            </button>
          </div>

          {userMessage && (
            <div className={`mb-4 p-3 rounded-lg text-sm ${
              userMessage.startsWith('✓')
                ? 'bg-green-500/10 border border-green-500/20 text-green-300'
                : 'bg-amber-500/10 border border-amber-500/20 text-amber-300'
            }`}>
              {userMessage}
            </div>
          )}

          {foundUser ? (
            <div className="space-y-5">
              <div className="pb-5 border-b border-accent-500/10">
                <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Email</p>
                <p className="text-neutral-0 font-semibold mt-1">{foundUser.email}</p>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div>
                    <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Subscription</p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className={`inline-block w-2 h-2 rounded-full ${
                        foundUser.subscription_status === 'active' ? 'bg-green-500' : 'bg-neutral-600'
                      }`} />
                      <span className="text-neutral-0 text-sm">
                        {foundUser.subscription_status
                          ? foundUser.subscription_status.charAt(0).toUpperCase() + foundUser.subscription_status.slice(1)
                          : 'None'}
                      </span>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Session Limit</p>
                    <p className="text-neutral-0 text-sm font-semibold mt-1">{foundUser.session_limit_minutes} min</p>
                  </div>
                </div>
              </div>

              <button
                onClick={handleResetUsage}
                disabled={userLoading}
                className="w-full px-4 py-3 bg-primary-700 hover:bg-primary-600 text-neutral-100 rounded-lg transition-colors font-medium text-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Clear Usage Sessions
              </button>

              {editingLimit ? (
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="10"
                    max="10080"
                    defaultValue={foundUser.session_limit_minutes}
                    onChange={(e) => setNewSessionLimit(e.target.value ? parseInt(e.target.value, 10) : '')}
                    className="flex-1 px-4 py-2.5 bg-primary-800/50 border border-accent-500/20 rounded-lg text-neutral-0 focus:outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 transition-all"
                  />
                  <button
                    onClick={handleUpdateSessionLimit}
                    disabled={userLoading}
                    className="px-4 py-3 bg-accent-500 text-neutral-0 font-semibold rounded-lg hover:bg-accent-400 disabled:opacity-50"
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

              <button
                onClick={handleExtendSubscription}
                disabled={userLoading}
                className="w-full px-4 py-3 bg-primary-700 hover:bg-primary-600 text-neutral-100 rounded-lg transition-colors font-medium text-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Calendar className="w-4 h-4" />
                Extend Subscription (+30 days)
              </button>

              <a
                href={`/admin/users/${foundUser.id}`}
                className="w-full px-4 py-3 bg-accent-500/20 hover:bg-accent-500/30 text-accent-300 rounded-lg transition-colors font-medium text-sm flex items-center justify-center gap-2 border border-accent-500/30"
              >
                <ExternalLink className="w-4 h-4" />
                View Full Profile
              </a>
            </div>
          ) : !userLoading && (
            <div className="py-10 text-center">
              <p className="text-neutral-500 text-sm">Enter an email above to search and manage a user</p>
            </div>
          )}
        </div>

        {/* Send Email */}
        <div className="bg-gradient-to-br from-primary-700/30 to-primary-800/30 border border-accent-500/10 rounded-xl p-6 shadow-lg">
          <div className="flex items-center space-x-3 mb-5">
            <div className="w-12 h-12 rounded-xl bg-accent-500/20 border border-accent-500/30 flex items-center justify-center">
              <svg className="w-6 h-6 text-accent-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-neutral-0 font-display text-xl font-bold">Send Email to User</h2>
              <p className="text-neutral-400 text-sm">Send custom emails to registered users only</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-neutral-300 text-sm font-semibold mb-2">Recipient Email</label>
              <input
                type="email"
                placeholder="user@example.com"
                value={email.to}
                onChange={(e) => setEmail({ ...email, to: e.target.value })}
                className="w-full px-4 py-3 bg-primary-800/50 border border-accent-500/20 rounded-lg text-neutral-0 placeholder-neutral-500 focus:outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 transition-all"
              />
              <p className="text-neutral-500 text-xs mt-1">Must be a registered user email address</p>
            </div>

            <div>
              <label className="block text-neutral-300 text-sm font-semibold mb-2">Subject Line</label>
              <input
                type="text"
                placeholder="Enter email subject"
                value={email.subject}
                onChange={(e) => setEmail({ ...email, subject: e.target.value })}
                className="w-full px-4 py-3 bg-primary-800/50 border border-accent-500/20 rounded-lg text-neutral-0 placeholder-neutral-500 focus:outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 transition-all"
              />
            </div>

            <div>
              <label className="block text-neutral-300 text-sm font-semibold mb-2">Message</label>
              <textarea
                placeholder="Type your message here..."
                value={email.message}
                onChange={(e) => setEmail({ ...email, message: e.target.value })}
                rows={6}
                className="w-full px-4 py-3 bg-primary-800/50 border border-accent-500/20 rounded-lg text-neutral-0 placeholder-neutral-500 focus:outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 transition-all resize-none"
              />
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={handleSendEmail}
                disabled={sending || !email.to || !email.subject || !email.message}
                className="px-6 py-3 rounded-lg bg-gradient-to-r from-accent-500 to-accent-600 text-neutral-0 font-semibold hover:from-accent-600 hover:to-accent-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg"
              >
                {sending ? (
                  <span className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-neutral-0 border-t-transparent rounded-full animate-spin"></div>
                    <span>Sending...</span>
                  </span>
                ) : (
                  'Send Email'
                )}
              </button>

              {(email.to || email.subject || email.message) && (
                <button
                  onClick={() => setEmail({ to: '', subject: '', message: '' })}
                  className="px-6 py-3 rounded-lg bg-primary-700 text-neutral-300 hover:bg-primary-600 hover:text-neutral-0 transition-colors font-medium"
                >
                  Clear
                </button>
              )}
            </div>

            {emailResult && (
              <div className={`p-4 rounded-lg border text-sm font-medium ${
                emailResult.startsWith('✓')
                  ? 'bg-green-500/10 border-green-500/20 text-green-300'
                  : emailResult.startsWith('⚠')
                  ? 'bg-amber-500/10 border-amber-500/20 text-amber-300'
                  : 'bg-red-500/10 border-red-500/20 text-red-300'
              }`}>
                {emailResult}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
