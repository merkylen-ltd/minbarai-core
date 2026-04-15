'use client'

import Link from 'next/link'
import { Ban } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function SuspendedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-primary-gradient">
      <div className="max-w-md w-full">
        <div className="card">
          <div className="flex items-center justify-center mb-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-red-500/10 text-red-500">
              <Ban className="h-6 w-6" />
            </div>
          </div>

          <h1 className="text-2xl font-display text-neutral-0 mb-4 text-center">
            Account Suspended
          </h1>

          <p className="text-neutral-50 mb-6 text-center">
            Your account has been suspended by an administrator. If you believe this is a mistake, please contact our support team.
          </p>

          <div className="space-y-4">
            <Button asChild className="w-full">
              <a href="mailto:support@minberai.com">
                Contact Support
              </a>
            </Button>

            <Button variant="outline" asChild className="w-full">
              <Link href="/auth/signin">
                Back to Sign In
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
