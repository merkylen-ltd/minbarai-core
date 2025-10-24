"use client"

import { useState, useCallback } from 'react'

export interface ConfirmationDialogState {
  open: boolean
  title: string
  description: string
  confirmText?: string
  cancelText?: string
  variant?: 'default' | 'destructive' | 'warning' | 'info' | 'success'
  onConfirm: () => void
  onCancel?: () => void
  loading?: boolean
}

export interface AlertDialogState {
  open: boolean
  title: string
  description: string
  buttonText?: string
  variant?: 'default' | 'destructive' | 'warning' | 'info' | 'success'
  onButtonClick?: () => void
}

export function useDialog() {
  const [confirmationDialog, setConfirmationDialog] = useState<ConfirmationDialogState>({
    open: false,
    title: '',
    description: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    variant: 'default',
    onConfirm: () => {},
  })

  const [alertDialog, setAlertDialog] = useState<AlertDialogState>({
    open: false,
    title: '',
    description: '',
    buttonText: 'OK',
    variant: 'default',
  })

  const showConfirmation = useCallback((
    title: string,
    description: string,
    onConfirm: () => void,
    options?: {
      confirmText?: string
      cancelText?: string
      variant?: 'default' | 'destructive' | 'warning' | 'info' | 'success'
      onCancel?: () => void
      loading?: boolean
    }
  ) => {
    setConfirmationDialog({
      open: true,
      title,
      description,
      confirmText: options?.confirmText || 'Confirm',
      cancelText: options?.cancelText || 'Cancel',
      variant: options?.variant || 'default',
      onConfirm,
      onCancel: options?.onCancel,
      loading: options?.loading || false,
    })
  }, [])

  const showAlert = useCallback((
    title: string,
    description: string,
    options?: {
      buttonText?: string
      variant?: 'default' | 'destructive' | 'warning' | 'info' | 'success'
      onButtonClick?: () => void
    }
  ) => {
    setAlertDialog({
      open: true,
      title,
      description,
      buttonText: options?.buttonText || 'OK',
      variant: options?.variant || 'default',
      onButtonClick: options?.onButtonClick,
    })
  }, [])

  const closeConfirmation = useCallback(() => {
    setConfirmationDialog(prev => ({ ...prev, open: false }))
  }, [])

  const closeAlert = useCallback(() => {
    setAlertDialog(prev => ({ ...prev, open: false }))
  }, [])

  const setConfirmationLoading = useCallback((loading: boolean) => {
    setConfirmationDialog(prev => ({ ...prev, loading }))
  }, [])

  return {
    confirmationDialog,
    alertDialog,
    showConfirmation,
    showAlert,
    closeConfirmation,
    closeAlert,
    setConfirmationLoading,
  }
}

// Predefined dialog configurations for common use cases
export const dialogConfigs = {
  cancelSubscription: {
    title: "Cancel Subscription",
    description: "Are you sure you want to cancel your subscription? This action cannot be undone and you will lose access to all premium features at the end of your current billing period.",
    confirmText: "Yes, Cancel Subscription",
    cancelText: "Keep Subscription",
    variant: "destructive" as const,
  },
  
  deleteAccount: {
    title: "Delete Account",
    description: "Are you sure you want to delete your account? This action cannot be undone and all your data will be permanently removed.",
    confirmText: "Yes, Delete Account",
    cancelText: "Cancel",
    variant: "destructive" as const,
  },
  
  logout: {
    title: "Sign Out",
    description: "Are you sure you want to sign out of your account?",
    confirmText: "Sign Out",
    cancelText: "Cancel",
    variant: "default" as const,
  },
  
  saveChanges: {
    title: "Save Changes",
    description: "You have unsaved changes. Do you want to save them before continuing?",
    confirmText: "Save Changes",
    cancelText: "Discard Changes",
    variant: "warning" as const,
  },
  
  subscriptionCanceled: {
    title: "Subscription Canceled",
    description: "Your subscription has been successfully canceled. You will retain access until the end of your current billing period.",
    buttonText: "OK",
    variant: "info" as const,
  },
  
  subscriptionError: {
    title: "Subscription Error",
    description: "There was an error processing your subscription request. Please try again or contact support if the problem persists.",
    buttonText: "OK",
    variant: "destructive" as const,
  },
  
  success: {
    title: "Success",
    description: "Your request has been processed successfully.",
    buttonText: "OK",
    variant: "success" as const,
  },
  
  error: {
    title: "Error",
    description: "An unexpected error occurred. Please try again.",
    buttonText: "OK",
    variant: "destructive" as const,
  },
  
  supportContact: {
    title: "Contact Support",
    description: "Get in touch with our support team for assistance.",
    buttonText: "Close",
    variant: "info" as const,
  },
}
