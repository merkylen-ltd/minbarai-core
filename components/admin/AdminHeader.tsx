'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface AdminHeaderProps {
  userEmail?: string | null
}

export default function AdminHeader({ userEmail }: AdminHeaderProps) {
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth/signin')
  }

  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-primary-900/95 backdrop-blur-sm border-b border-accent-500/10 z-30 shadow-lg">
      <div className="h-full px-6 flex items-center justify-between">
        {/* Left side - Spacing for sidebar on desktop */}
        <div className="flex items-center space-x-4">
          <div className="hidden lg:block w-64" /> {/* Spacer for sidebar */}
          <div className="flex items-center space-x-3">
            <div className="hidden sm:flex items-center space-x-2 px-4 py-2 rounded-lg bg-accent-500/10 border border-accent-500/20">
              <svg className="w-4 h-4 text-accent-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span className="text-accent-400 text-sm font-semibold">Admin Access</span>
            </div>
          </div>
        </div>

        {/* Right side - User info and actions */}
        <div className="flex items-center space-x-4">
          {/* User email */}
          {userEmail && (
            <div className="hidden md:flex items-center space-x-2 px-4 py-2 rounded-lg bg-primary-700/50 border border-accent-500/10">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
              <span className="text-neutral-300 text-sm font-medium">{userEmail}</span>
            </div>
          )}

          {/* Logout button */}
          <button
            onClick={handleLogout}
            className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-gradient-to-r from-red-500/10 to-red-600/10 text-red-300 border border-red-500/20 hover:from-red-500/20 hover:to-red-600/20 hover:border-red-500/40 transition-all duration-200 font-medium"
            title="Logout"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>
    </header>
  )
}
