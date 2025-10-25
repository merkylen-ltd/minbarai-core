"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X, AlertTriangle, CheckCircle, Info, AlertCircle, Mail, Phone } from "lucide-react"
import { cn } from "@/utils/cn"

const Dialog = DialogPrimitive.Root

const DialogTrigger = DialogPrimitive.Trigger

const DialogPortal = DialogPrimitive.Portal

const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-[9998] bg-black/80 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 9998,
    }}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal container={typeof document !== 'undefined' ? document.body : undefined}>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed z-[9999] grid w-full max-w-lg gap-4 border bg-card p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg",
        // Custom styling to match website theme
        "bg-white/10 backdrop-blur-md border-white/20 rounded-xl shadow-2xl",
        // Ensure proper positioning and centering
        "mx-4 my-4 max-h-[90vh] overflow-y-auto custom-scrollbar",
        // Better centering with flexbox approach
        "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
        className
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
        <X className="h-4 w-4 text-white/70 hover:text-white" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
))
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-1.5 text-center sm:text-left",
      className
    )}
    {...props}
  />
)
DialogHeader.displayName = "DialogHeader"

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className
    )}
    {...props}
  />
)
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-lg font-heading leading-none tracking-tight text-white",
      className
    )}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-neutral-300", className)}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

// Custom confirmation dialog component
interface ConfirmationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmText?: string
  cancelText?: string
  variant?: 'default' | 'destructive' | 'warning' | 'info' | 'success'
  onConfirm: () => void
  onCancel?: () => void
  loading?: boolean
}

const ConfirmationDialog = React.forwardRef<
  React.ElementRef<typeof DialogContent>,
  ConfirmationDialogProps
>(({
  open,
  onOpenChange,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = 'default',
  onConfirm,
  onCancel,
  loading = false,
  ...props
}, ref) => {
  const getIcon = () => {
    switch (variant) {
      case 'destructive':
        return <AlertTriangle className="h-6 w-6 text-red-400" />
      case 'warning':
        return <AlertCircle className="h-6 w-6 text-yellow-400" />
      case 'info':
        return <Info className="h-6 w-6 text-blue-400" />
      case 'success':
        return <CheckCircle className="h-6 w-6 text-green-400" />
      default:
        return <AlertCircle className="h-6 w-6 text-accent-400" />
    }
  }

  const getConfirmButtonStyle = () => {
    switch (variant) {
      case 'destructive':
        return "bg-red-500/20 hover:bg-red-500/30 text-red-400 hover:text-red-300 border border-red-500/30 hover:border-red-500/50"
      case 'warning':
        return "bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 hover:text-yellow-300 border border-yellow-500/30 hover:border-yellow-500/50"
      case 'info':
        return "bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 hover:text-blue-300 border border-blue-500/30 hover:border-blue-500/50"
      case 'success':
        return "bg-green-500/20 hover:bg-green-500/30 text-green-400 hover:text-green-300 border border-green-500/30 hover:border-green-500/50"
      default:
        return "bg-accent-500/20 hover:bg-accent-500/30 text-accent-400 hover:text-accent-300 border border-accent-500/30 hover:border-accent-500/50"
    }
  }

  const handleConfirm = () => {
    onConfirm()
    onOpenChange(false)
  }

  const handleCancel = () => {
    if (onCancel) {
      onCancel()
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent ref={ref} className="sm:max-w-md" {...props}>
        <DialogHeader className="space-y-4">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              {getIcon()}
            </div>
            <DialogTitle className="text-left">{title}</DialogTitle>
          </div>
          <DialogDescription className="text-left text-neutral-300">
            {description}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col sm:flex-row gap-3 sm:gap-2">
          <button
            onClick={handleCancel}
            disabled={loading}
            className="flex-1 sm:flex-none px-4 py-2 text-sm font-body text-neutral-400 hover:text-white border border-white/20 hover:border-white/30 rounded-lg transition-all duration-200 backdrop-blur-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className={`flex-1 sm:flex-none px-4 py-2 text-sm font-body rounded-lg transition-all duration-200 backdrop-blur-sm disabled:opacity-50 disabled:cursor-not-allowed ${getConfirmButtonStyle()}`}
          >
            {loading ? (
              <div className="flex items-center justify-center space-x-2">
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                <span>Processing...</span>
              </div>
            ) : (
              confirmText
            )}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})
ConfirmationDialog.displayName = "ConfirmationDialog"

// Alert dialog component for simple notifications
interface AlertDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  buttonText?: string
  variant?: 'default' | 'destructive' | 'warning' | 'info' | 'success'
  onButtonClick?: () => void
}

const AlertDialog = React.forwardRef<
  React.ElementRef<typeof DialogContent>,
  AlertDialogProps
>(({
  open,
  onOpenChange,
  title,
  description,
  buttonText = "OK",
  variant = 'default',
  onButtonClick,
  ...props
}, ref) => {
  const getIcon = () => {
    switch (variant) {
      case 'destructive':
        return <AlertTriangle className="h-6 w-6 text-red-400" />
      case 'warning':
        return <AlertCircle className="h-6 w-6 text-yellow-400" />
      case 'info':
        return <Info className="h-6 w-6 text-blue-400" />
      case 'success':
        return <CheckCircle className="h-6 w-6 text-green-400" />
      default:
        return <Info className="h-6 w-6 text-accent-400" />
    }
  }

  const getButtonStyle = () => {
    switch (variant) {
      case 'destructive':
        return "bg-red-500/20 hover:bg-red-500/30 text-red-400 hover:text-red-300 border border-red-500/30 hover:border-red-500/50"
      case 'warning':
        return "bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 hover:text-yellow-300 border border-yellow-500/30 hover:border-yellow-500/50"
      case 'info':
        return "bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 hover:text-blue-300 border border-blue-500/30 hover:border-blue-500/50"
      case 'success':
        return "bg-green-500/20 hover:bg-green-500/30 text-green-400 hover:text-green-300 border border-green-500/30 hover:border-green-500/50"
      default:
        return "bg-accent-500/20 hover:bg-accent-500/30 text-accent-400 hover:text-accent-300 border border-accent-500/30 hover:border-accent-500/50"
    }
  }

  const handleButtonClick = () => {
    if (onButtonClick) {
      onButtonClick()
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent ref={ref} className="sm:max-w-md" {...props}>
        <DialogHeader className="space-y-4">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              {getIcon()}
            </div>
            <DialogTitle className="text-left">{title}</DialogTitle>
          </div>
          <DialogDescription className="text-left text-neutral-300">
            {description}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <button
            onClick={handleButtonClick}
            className={`w-full px-4 py-2 text-sm font-body rounded-lg transition-all duration-200 backdrop-blur-sm ${getButtonStyle()}`}
          >
            {buttonText}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})
AlertDialog.displayName = "AlertDialog"

// Support contact dialog component
interface SupportContactDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const SupportContactDialog = React.forwardRef<
  React.ElementRef<typeof DialogContent>,
  SupportContactDialogProps
>(({
  open,
  onOpenChange,
  ...props
}, ref) => {
  const handleEmailClick = () => {
    window.location.href = 'mailto:support@minberai.com'
  }

  const handlePhoneClick = () => {
    window.location.href = 'tel:+447441477652'
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent ref={ref} className="sm:max-w-md" {...props}>
        <DialogHeader className="space-y-4">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <Info className="h-6 w-6 text-blue-400" />
            </div>
            <DialogTitle className="text-left">Contact Support</DialogTitle>
          </div>
          <DialogDescription className="text-left text-neutral-300">
            Get in touch with our support team for assistance. We're here to help!
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Email Contact */}
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
            <div className="flex items-center space-x-3">
              <Mail className="h-5 w-5 text-blue-400" />
              <div className="flex-1">
                <h4 className="text-sm font-body text-blue-400 mb-1">Email Support</h4>
                <p className="text-xs text-neutral-300 mb-2">Send us an email and we'll respond within 24 hours</p>
                <button
                  onClick={handleEmailClick}
                  className="text-sm text-blue-400 hover:text-blue-300 underline transition-colors"
                >
                  support@minberai.com
                </button>
              </div>
            </div>
          </div>

          {/* Phone Contact */}
          <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
            <div className="flex items-center space-x-3">
              <Phone className="h-5 w-5 text-green-400" />
              <div className="flex-1">
                <h4 className="text-sm font-body text-green-400 mb-1">Phone Support</h4>
                <p className="text-xs text-neutral-300 mb-2">Call us during working hours (Monday-Friday, 9AM-5PM GMT)</p>
                <button
                  onClick={handlePhoneClick}
                  className="text-sm text-green-400 hover:text-green-300 underline transition-colors"
                >
                  +44 7441 477652
                </button>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <button
            onClick={() => onOpenChange(false)}
            className="w-full px-4 py-2 text-sm font-body rounded-lg transition-all duration-200 backdrop-blur-sm bg-accent-500/20 hover:bg-accent-500/30 text-accent-400 hover:text-accent-300 border border-accent-500/30 hover:border-accent-500/50"
          >
            Close
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})
SupportContactDialog.displayName = "SupportContactDialog"

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  ConfirmationDialog,
  AlertDialog,
  SupportContactDialog,
}
