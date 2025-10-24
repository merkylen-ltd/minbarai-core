'use client'

import { ConfirmationDialog, AlertDialog } from '@/components/ui/dialog'
import { useDialog, dialogConfigs } from '@/lib/hooks/useDialog'
import { Button } from '@/components/ui/button'

export default function TestDialogsPage() {
  const { 
    confirmationDialog, 
    alertDialog, 
    showConfirmation, 
    showAlert, 
    closeConfirmation, 
    closeAlert 
  } = useDialog()

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-800 to-primary-700 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-display text-white mb-8">Dialog Test Page</h1>
        
        <div className="space-y-6">
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-6">
            <h2 className="text-xl font-heading text-white mb-4">Confirmation Dialogs</h2>
            <div className="flex flex-wrap gap-4">
              <Button
                onClick={() => showConfirmation(
                  dialogConfigs.cancelSubscription.title,
                  dialogConfigs.cancelSubscription.description,
                  () => console.log('Subscription cancelled'),
                  {
                    confirmText: dialogConfigs.cancelSubscription.confirmText,
                    cancelText: dialogConfigs.cancelSubscription.cancelText,
                    variant: dialogConfigs.cancelSubscription.variant,
                  }
                )}
                className="bg-red-500/20 hover:bg-red-500/30 text-red-400 hover:text-red-300 border border-red-500/30 hover:border-red-500/50"
              >
                Cancel Subscription Dialog
              </Button>

              <Button
                onClick={() => showConfirmation(
                  dialogConfigs.logout.title,
                  dialogConfigs.logout.description,
                  () => console.log('User logged out'),
                  {
                    confirmText: dialogConfigs.logout.confirmText,
                    cancelText: dialogConfigs.logout.cancelText,
                    variant: dialogConfigs.logout.variant,
                  }
                )}
                className="bg-accent-500/20 hover:bg-accent-500/30 text-accent-400 hover:text-accent-300 border border-accent-500/30 hover:border-accent-500/50"
              >
                Logout Dialog
              </Button>

              <Button
                onClick={() => showConfirmation(
                  dialogConfigs.deleteAccount.title,
                  dialogConfigs.deleteAccount.description,
                  () => console.log('Account deleted'),
                  {
                    confirmText: dialogConfigs.deleteAccount.confirmText,
                    cancelText: dialogConfigs.deleteAccount.cancelText,
                    variant: dialogConfigs.deleteAccount.variant,
                  }
                )}
                className="bg-red-500/20 hover:bg-red-500/30 text-red-400 hover:text-red-300 border border-red-500/30 hover:border-red-500/50"
              >
                Delete Account Dialog
              </Button>
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-6">
            <h2 className="text-xl font-heading text-white mb-4">Alert Dialogs</h2>
            <div className="flex flex-wrap gap-4">
              <Button
                onClick={() => showAlert(
                  dialogConfigs.success.title,
                  dialogConfigs.success.description,
                  { variant: dialogConfigs.success.variant }
                )}
                className="bg-green-500/20 hover:bg-green-500/30 text-green-400 hover:text-green-300 border border-green-500/30 hover:border-green-500/50"
              >
                Success Alert
              </Button>

              <Button
                onClick={() => showAlert(
                  dialogConfigs.error.title,
                  dialogConfigs.error.description,
                  { variant: dialogConfigs.error.variant }
                )}
                className="bg-red-500/20 hover:bg-red-500/30 text-red-400 hover:text-red-300 border border-red-500/30 hover:border-red-500/50"
              >
                Error Alert
              </Button>

              <Button
                onClick={() => showAlert(
                  dialogConfigs.subscriptionCanceled.title,
                  dialogConfigs.subscriptionCanceled.description,
                  { variant: dialogConfigs.subscriptionCanceled.variant }
                )}
                className="bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 hover:text-blue-300 border border-blue-500/30 hover:border-blue-500/50"
              >
                Subscription Canceled Alert
              </Button>
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-6">
            <h2 className="text-xl font-heading text-white mb-4">Custom Dialogs</h2>
            <div className="flex flex-wrap gap-4">
              <Button
                onClick={() => showConfirmation(
                  "Custom Warning",
                  "This is a custom warning dialog with different styling.",
                  () => console.log('Custom action confirmed'),
                  {
                    confirmText: "Proceed",
                    cancelText: "Go Back",
                    variant: "warning",
                  }
                )}
                className="bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 hover:text-yellow-300 border border-yellow-500/30 hover:border-yellow-500/50"
              >
                Custom Warning Dialog
              </Button>

              <Button
                onClick={() => showAlert(
                  "Information",
                  "This is a custom info dialog with different styling.",
                  { 
                    buttonText: "Got it",
                    variant: "info" 
                  }
                )}
                className="bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 hover:text-blue-300 border border-blue-500/30 hover:border-blue-500/50"
              >
                Custom Info Alert
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Dialogs */}
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

      <AlertDialog
        open={alertDialog.open}
        onOpenChange={closeAlert}
        title={alertDialog.title}
        description={alertDialog.description}
        buttonText={alertDialog.buttonText}
        variant={alertDialog.variant}
        onButtonClick={alertDialog.onButtonClick}
      />
    </div>
  )
}
