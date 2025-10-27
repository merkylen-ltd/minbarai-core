'use client'

import { LogOut } from 'lucide-react'
import { ConfirmationDialog } from '@/components/ui/dialog'
import { useDialog, dialogConfigs } from '@/lib/hooks/useDialog'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function SignOutButton() {
  const router = useRouter()
  const { confirmationDialog, showConfirmation, closeConfirmation } = useDialog()

  const handleSignOut = async () => {
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
      
      // Force a hard redirect to ensure we bypass any middleware caching
      window.location.href = '/'
    } catch (error) {
      console.error('Error signing out:', error)
      // Even if there's an error, redirect to main page
      window.location.href = '/'
    }
  }

  const handleSignOutClick = () => {
    showConfirmation(
      dialogConfigs.logout.title,
      dialogConfigs.logout.description,
      handleSignOut,
      {
        confirmText: dialogConfigs.logout.confirmText,
        cancelText: dialogConfigs.logout.cancelText,
        variant: dialogConfigs.logout.variant,
      }
    )
  }

  return (
    <>
      <button
        onClick={handleSignOutClick}
        className="flex items-center space-x-2 text-neutral-400 hover:text-white transition-colors text-sm min-h-[44px] md:min-h-0 py-2 px-3 rounded-md hover:bg-white/10"
      >
        <LogOut className="h-4 w-4" />
        <span>Sign Out</span>
      </button>

      <ConfirmationDialog
        open={confirmationDialog.open}
        onOpenChange={closeConfirmation}
        title={confirmationDialog.title}
        description={confirmationDialog.description}
        confirmText={confirmationDialog.confirmText}
        cancelText={confirmationDialog.cancelText}
        variant={confirmationDialog.variant}
        onConfirm={confirmationDialog.onConfirm}
        onCancel={confirmationDialog.onCancel}
        loading={confirmationDialog.loading}
      />
    </>
  )
}
