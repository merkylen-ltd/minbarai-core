'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import StatusBadge from '@/components/admin/StatusBadge'
import { ConfirmationDialog } from '@/components/ui/dialog'
import { format } from 'date-fns'
import { createClient } from '@/lib/supabase/client'

interface UserDetails {
  user: any
  stats: any
  recentSessions: any[]
}

export default function UserDetailPage() {
  const params = useParams()
  const userId = params.id as string
  const router = useRouter()
  const [data, setData] = useState<UserDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [editingSessionLimit, setEditingSessionLimit] = useState(false)
  const [newSessionLimit, setNewSessionLimit] = useState<number | null>(null)
  const [actioning, setActioning] = useState(false)
  const [currentUser, setCurrentUser] = useState<any>(null)

  const loadUserData = useCallback(() => {
    if (!userId) return

    fetch(`/api/admin/users/${userId}`)
      .then(res => res.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [userId])

  useEffect(() => {
    // Get current logged-in user from Supabase Auth
    const supabase = createClient()
    supabase.auth.getUser()
      .then(({ data }: any) => {
        if (data?.user) setCurrentUser(data.user)
      })
      .catch(() => {
        // Ignore errors
      })
  }, [])

  useEffect(() => {
    loadUserData()
  }, [loadUserData])

  const handleSyncStripe = async () => {
    setSyncing(true)
    setSyncMessage(null)
    try {
      const res = await fetch(`/api/admin/users/${userId}/sync-stripe`, { method: 'POST' })
      const result = await res.json()
      
      if (result.success) {
        setSyncMessage('✓ Synced with Stripe successfully')
        loadUserData() // Reload user data
      } else {
        setSyncMessage(`✗ ${result.error || 'Failed to sync'}`)
      }
    } catch (err) {
      setSyncMessage('✗ Error syncing with Stripe')
    } finally {
      setSyncing(false)
      setTimeout(() => setSyncMessage(null), 3000)
    }
  }

  const handleActionClick = (action: string) => {
    setPendingAction(action)
    setDialogOpen(true)
  }

  const handleActionConfirm = async () => {
    if (!pendingAction) return

    try {
      const res = await fetch(`/api/admin/users/${userId}/${pendingAction}`, { method: 'POST' })
      const result = await res.json()

      if (result.success) {
        if (pendingAction === 'delete') {
          setActionMessage(`✓ User deleted successfully`)
          setTimeout(() => router.push('/admin/users'), 2000)
        } else {
          setActionMessage(`✓ User ${pendingAction}d successfully`)
          setTimeout(() => setActionMessage(null), 3000)
          loadUserData()
        }
      } else {
        setActionMessage(`✗ ${result.error || `Failed to ${pendingAction} user`}`)
        setTimeout(() => setActionMessage(null), 3000)
      }
    } catch (err) {
      setActionMessage(`✗ Error: ${err}`)
      setTimeout(() => setActionMessage(null), 3000)
    } finally {
      setDialogOpen(false)
      setPendingAction(null)
    }
  }


  const handleResetUsage = async () => {
    setActioning(true)
    try {
      const res = await fetch(`/api/admin/users/${userId}/reset-usage`, { method: 'POST' })
      const result = await res.json()
      
      if (result.success) {
        setActionMessage(`✓ Cleared ${result.deletedCount} sessions`)
        setTimeout(() => setActionMessage(null), 3000)
        loadUserData()
      } else {
        setActionMessage(`✗ ${result.error || 'Failed to reset usage'}`)
      }
    } catch (err) {
      setActionMessage('✗ Error resetting usage')
    } finally {
      setActioning(false)
    }
  }

  const handleUpdateSessionLimit = async () => {
    if (!newSessionLimit) return
    
    setActioning(true)
    try {
      const res = await fetch(`/api/admin/users/${userId}/session-limit`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionLimitMinutes: newSessionLimit })
      })
      const result = await res.json()
      
      if (result.success) {
        setActionMessage(`✓ Session limit updated to ${result.sessionLimitMinutes} min`)
        setEditingSessionLimit(false)
        setNewSessionLimit(null)
        setTimeout(() => setActionMessage(null), 3000)
        loadUserData()
      } else {
        setActionMessage(`✗ ${result.error || 'Failed to update'}`)
      }
    } catch (err) {
      setActionMessage('✗ Error updating session limit')
    } finally {
      setActioning(false)
    }
  }

  if (loading) return <div className="text-neutral-0">Loading...</div>

  if (!data) return <div className="text-red-400">User not found</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-semibold text-neutral-0">{data.user.email}</h1>
          <p className="text-neutral-400 mt-1">User ID: {data.user.id}</p>
          {data.user.customer_id && (
            <p className="text-neutral-400 text-sm mt-1">
              Stripe Customer: 
              <a 
                href={`https://dashboard.stripe.com/customers/${data.user.customer_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent-400 hover:text-accent-300 ml-1"
              >
                {data.user.customer_id}
              </a>
            </p>
          )}
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleSyncStripe}
            disabled={syncing || !data.user.subscription_id}
            className="px-4 py-2 rounded-lg bg-accent-500 text-neutral-0 hover:bg-accent-400 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {syncing ? 'Syncing...' : '↻ Sync Stripe'}
          </button>
          <button
            onClick={() => router.push('/admin/users')}
            className="px-4 py-2 rounded-lg bg-primary-700 text-neutral-0 hover:bg-primary-600"
          >
            Back to Users
          </button>
        </div>
      </div>

      {syncMessage && (
        <div className={`p-3 rounded-lg ${
          syncMessage.startsWith('✓')
            ? 'bg-green-500/10 text-green-400 border border-green-500/20'
            : 'bg-red-500/10 text-red-400 border border-red-500/20'
        }`}>
          {syncMessage}
        </div>
      )}

      {actionMessage && (
        <div className={`p-3 rounded-lg ${
          actionMessage.startsWith('✓')
            ? 'bg-green-500/10 text-green-400 border border-green-500/20'
            : 'bg-red-500/10 text-red-400 border border-red-500/20'
        }`}>
          {actionMessage}
        </div>
      )}

      {currentUser?.id === userId && (
        <div className="p-4 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/20">
          ⚠️ You are viewing your own profile. Some administrative actions are disabled for safety.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-primary-700/30 border border-accent-500/20 rounded-lg p-6">
          <h2 className="text-neutral-0 font-display text-xl font-semibold mb-4">User Information</h2>
          <div className="space-y-3">
            <div>
              <span className="text-neutral-400 text-sm">Status:</span>
              <div className="mt-1"><StatusBadge status={data.user.subscription_status} /></div>
            </div>
            <div>
              <span className="text-neutral-400 text-sm">Signup Date:</span>
              <div className="text-neutral-0 mt-1">{format(new Date(data.user.created_at), 'PPP')}</div>
            </div>
            <div>
              <span className="text-neutral-400 text-sm">Subscription End:</span>
              <div className="text-neutral-0 mt-1">
                {data.user.subscription_period_end ? format(new Date(data.user.subscription_period_end), 'PPP') : 'N/A'}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-primary-700/30 border border-accent-500/20 rounded-lg p-6">
          <h2 className="text-neutral-0 font-display text-xl font-semibold mb-4">Usage Statistics</h2>
          <div className="space-y-3">
            <div>
              <span className="text-neutral-400 text-sm">Total Sessions:</span>
              <div className="text-neutral-0 text-2xl font-semibold mt-1">{data.stats.totalSessions}</div>
            </div>
            {data.user.session_limit_minutes && (
              <div>
                <span className="text-neutral-400 text-sm">Session Limit:</span>
                <div className="text-neutral-0 text-lg mt-1">{data.user.session_limit_minutes} minutes</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-primary-700/30 border border-accent-500/20 rounded-lg p-6">
        <h2 className="text-neutral-0 font-display text-xl font-semibold mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          {!data.user.is_suspended && (
            <button
              onClick={() => handleActionClick('suspend')}
              disabled={currentUser?.id === userId}
              className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-orange-500 to-orange-600 text-white font-medium hover:from-orange-600 hover:to-orange-700 transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              title={currentUser?.id === userId ? 'Cannot suspend your own account' : ''}
            >
              🚫 Suspend Account
            </button>
          )}
          {data.user.is_suspended && (
            <button
              onClick={() => handleActionClick('activate')}
              className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-green-500 to-green-600 text-white font-medium hover:from-green-600 hover:to-green-700 transition-all duration-200 shadow-md hover:shadow-lg"
            >
              ✓ Reactivate Account
            </button>
          )}
          <button
            onClick={() => handleActionClick('reset-password')}
            className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 text-white font-medium hover:from-blue-600 hover:to-blue-700 transition-all duration-200 shadow-md hover:shadow-lg"
          >
              📧 Send Password Reset Email
          </button>
          {data.user.subscription_id && (
            <a
              href={`https://dashboard.stripe.com/subscriptions/${data.user.subscription_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-purple-500 to-purple-600 text-white font-medium hover:from-purple-600 hover:to-purple-700 transition-all duration-200 shadow-md hover:shadow-lg inline-flex items-center gap-2"
            >
              💳 View in Stripe Dashboard
            </a>
          )}
          <button
            onClick={handleResetUsage}
            disabled={actioning}
            className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-yellow-500 to-yellow-600 text-white font-medium hover:from-yellow-600 hover:to-yellow-700 transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50"
          >
            🔄 Reset Usage
          </button>
          {editingSessionLimit ? (
            <div className="flex gap-2 items-center">
              <input
                type="number"
                min="10"
                max="10080"
                defaultValue={data.user.session_limit_minutes}
                onChange={(e) => setNewSessionLimit(parseInt(e.target.value))}
                className="px-3 py-2.5 rounded-lg bg-primary-800/50 border border-accent-500/20 text-neutral-0 w-32"
              />
              <button
                onClick={handleUpdateSessionLimit}
                disabled={actioning || !newSessionLimit}
                className="px-4 py-2.5 rounded-lg bg-gradient-to-r from-green-500 to-green-600 text-white font-medium hover:from-green-600 hover:to-green-700 disabled:opacity-50"
              >
                Save
              </button>
              <button
                onClick={() => setEditingSessionLimit(false)}
                className="px-4 py-2.5 rounded-lg bg-neutral-600 text-white font-medium hover:bg-neutral-700"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setEditingSessionLimit(true)
                setNewSessionLimit(data.user.session_limit_minutes)
              }}
              className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-cyan-500 to-cyan-600 text-white font-medium hover:from-cyan-600 hover:to-cyan-700 transition-all duration-200 shadow-md hover:shadow-lg"
            >
              ⏱️ Edit Limit ({data.user.session_limit_minutes}min)
            </button>
          )}
          <button
            onClick={() => handleActionClick('delete')}
            disabled={currentUser?.id === userId}
            className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-red-600 to-red-700 text-white font-medium hover:from-red-700 hover:to-red-800 transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            title={currentUser?.id === userId ? 'Cannot delete your own account' : ''}
          >
            🗑️ Delete Account
          </button>
        </div>
      </div>

      {/* Action Confirmation Dialog */}
      <ConfirmationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={pendingAction === 'delete' ? 'Delete Account Permanently' : 'Confirm Action'}
        description={
          pendingAction === 'delete'
            ? `Are you sure you want to permanently delete this account? This will:\n• Delete the user profile\n• Cancel their Stripe subscription (if active)\n• Delete all usage sessions\n• This action CANNOT be undone.`
            : `Are you sure you want to ${pendingAction} this user? This action cannot be undone.`
        }
        confirmText={pendingAction === 'delete' ? 'Delete Account' : 'Confirm'}
        cancelText="Cancel"
        variant="destructive"
        onConfirm={handleActionConfirm}
      />

      <div className="bg-primary-700/30 border border-accent-500/20 rounded-lg p-6">
        <h2 className="text-neutral-0 font-display text-xl font-semibold mb-4">Recent Sessions</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-primary-800/50 border-b border-accent-500/20">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Started</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-accent-500/10">
              {data.recentSessions.map((session: any) => (
                <tr key={session.id}>
                  <td className="px-4 py-3 text-sm text-neutral-0">
                    {format(new Date(session.started_at), 'PPp')}
                  </td>
                  <td className="px-4 py-3 text-sm"><StatusBadge status={session.status} /></td>
                  <td className="px-4 py-3 text-sm text-neutral-400">
                    {session.ended_at 
                      ? `${Math.round((new Date(session.ended_at).getTime() - new Date(session.started_at).getTime()) / 1000 / 60)} min`
                      : 'Active'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
