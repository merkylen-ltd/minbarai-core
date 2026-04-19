'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Users, FileText, Tag, Sparkles, Menu, X } from 'lucide-react'

interface AdminLayoutProps {
  children: React.ReactNode
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const navItems = [
    { href: '/admin/accounts', label: 'Accounts', icon: Users },
    { href: '/admin/invoices', label: 'Invoices', icon: FileText },
    { href: '/admin/promo-codes', label: 'Promo Codes', icon: Tag },
    { href: '/admin/marketing', label: 'Marketing', icon: Sparkles },
  ]

  const isActive = (href: string) => pathname.startsWith(href)

  return (
    <div className="flex h-screen bg-primary-900">
      {/* Sidebar */}
      <aside className={`
        fixed md:sticky top-0 left-0 h-screen w-64 bg-primary-800 border-r border-accent-500/20
        transform transition-transform duration-300 md:translate-x-0 z-40
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Logo */}
        <div className="p-6 border-b border-accent-500/20">
          <Link href="/admin" className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-accent-500 to-accent-600 rounded-lg flex items-center justify-center">
              <span className="text-neutral-0 font-bold text-lg">M</span>
            </div>
            <div>
              <div className="font-display text-neutral-0 font-bold">MinbarAI</div>
              <div className="text-xs text-neutral-400">Admin</div>
            </div>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-8 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`
                  flex items-center space-x-3 px-4 py-3 rounded-lg transition-all
                  ${active
                    ? 'bg-accent-500/20 text-accent-300 border border-accent-500/30'
                    : 'text-neutral-400 hover:text-neutral-0 hover:bg-primary-700/50'
                  }
                `}
              >
                <Icon className="w-5 h-5" />
                <span className="font-body">{item.label}</span>
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="p-6 border-t border-accent-500/20">
          <Link
            href="/dashboard"
            className="flex items-center justify-center px-4 py-2 rounded-lg bg-primary-700/50 text-neutral-300 hover:text-neutral-0 text-sm font-body transition-colors"
          >
            Back to Dashboard
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {/* Mobile Header */}
        <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-primary-800 border-b border-accent-500/20 flex items-center px-4 z-30">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-neutral-0 hover:text-accent-400 transition-colors"
          >
            {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
          <span className="ml-4 font-display text-neutral-0">MinbarAI Admin</span>
        </div>

        {/* Page Content */}
        <div className="pt-20 md:pt-0 p-6 md:p-8 max-w-7xl">
          {children}
        </div>
      </main>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 md:hidden z-30"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  )
}

export default AdminLayout
