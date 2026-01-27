'use client'

import { useState } from 'react'

export default function ActionsPage() {
  const [email, setEmail] = useState({ to: '', subject: '', message: '' })
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  const handleSendEmail = async () => {
    setSending(true)
    setResult(null)
    try {
      const res = await fetch('/api/admin/actions/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userEmail: email.to, subject: email.subject, message: email.message }),
      })
      const data = await res.json()
      setResult(data.success ? 'Email sent successfully!' : data.error || 'Failed to send email')
      
      if (data.success) {
        setEmail({ to: '', subject: '', message: '' })
      }
    } catch (err) {
      setResult('Error sending email')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="border-b border-accent-500/20 pb-6">
        <h1 className="text-4xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-neutral-0 to-neutral-200">
          Quick Actions
        </h1>
        <p className="text-neutral-300 mt-2 text-lg">Perform administrative tasks quickly</p>
      </div>
      
      {/* Send Email Form */}
      <div className="bg-gradient-to-br from-primary-700/30 to-primary-800/30 border border-accent-500/10 rounded-xl p-8 shadow-lg">
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-accent-500/20 border border-accent-500/30 flex items-center justify-center">
            <svg className="w-6 h-6 text-accent-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h2 className="text-neutral-0 font-display text-2xl font-bold">Send Email to User</h2>
            <p className="text-neutral-400 text-sm">Send custom emails to specific users</p>
          </div>
        </div>

        <div className="space-y-5">
          <div>
            <label className="block text-neutral-300 text-sm font-semibold mb-2">
              Recipient Email
            </label>
            <input
              type="email"
              placeholder="user@example.com"
              value={email.to}
              onChange={(e) => setEmail({ ...email, to: e.target.value })}
              className="w-full px-4 py-3 bg-primary-800/50 border border-accent-500/20 rounded-lg text-neutral-0 placeholder-neutral-500 focus:outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 transition-all"
            />
          </div>

          <div>
            <label className="block text-neutral-300 text-sm font-semibold mb-2">
              Subject Line
            </label>
            <input
              type="text"
              placeholder="Enter email subject"
              value={email.subject}
              onChange={(e) => setEmail({ ...email, subject: e.target.value })}
              className="w-full px-4 py-3 bg-primary-800/50 border border-accent-500/20 rounded-lg text-neutral-0 placeholder-neutral-500 focus:outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 transition-all"
            />
          </div>

          <div>
            <label className="block text-neutral-300 text-sm font-semibold mb-2">
              Message
            </label>
            <textarea
              placeholder="Type your message here..."
              value={email.message}
              onChange={(e) => setEmail({ ...email, message: e.target.value })}
              rows={8}
              className="w-full px-4 py-3 bg-primary-800/50 border border-accent-500/20 rounded-lg text-neutral-0 placeholder-neutral-500 focus:outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 transition-all resize-none"
            />
          </div>

          <div className="flex items-center space-x-4">
            <button
              onClick={handleSendEmail}
              disabled={sending || !email.to || !email.subject || !email.message}
              className="px-6 py-3 rounded-lg bg-gradient-to-r from-accent-500 to-accent-600 text-neutral-0 font-semibold hover:from-accent-600 hover:to-accent-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              {sending ? (
                <span className="flex items-center space-x-2">
                  <div className="w-4 h-4 border-2 border-neutral-0 border-t-transparent rounded-full animate-spin"></div>
                  <span>Sending...</span>
                </span>
              ) : (
                '📧 Send Email'
              )}
            </button>
            
            {email.to || email.subject || email.message ? (
              <button
                onClick={() => setEmail({ to: '', subject: '', message: '' })}
                className="px-6 py-3 rounded-lg bg-primary-700 text-neutral-300 hover:bg-primary-600 hover:text-neutral-0 transition-colors font-medium"
              >
                Clear
              </button>
            ) : null}
          </div>

          {result && (
            <div className={`p-4 rounded-lg border ${
              result.includes('success') 
                ? 'bg-gradient-to-br from-green-500/10 to-green-600/10 border-green-500/20 text-green-300' 
                : 'bg-gradient-to-br from-red-500/10 to-red-600/10 border-red-500/20 text-red-300'
            }`}>
              <div className="flex items-center space-x-2">
                {result.includes('success') ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
                <span className="font-medium">{result}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
