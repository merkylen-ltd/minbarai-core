'use client'

import LiveCaptioning from '@/components/dashboard/live-captioning'

// Force dynamic rendering to prevent SSR issues
export const dynamic = 'force-dynamic'

export default function TestCaptioningPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-cyan-50 to-blue-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-6 py-4">
          <h1 className="text-2xl font-display text-gray-900">Test Live Captioning</h1>
          <p className="text-gray-600 mt-2">
            This page bypasses authentication for testing the live captioning component.
          </p>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-blue-800 text-sm">
            <strong>Test Mode:</strong> This page uses the test user account with unlimited access. 
            No authentication required for testing.
          </p>
        </div>

        <LiveCaptioning userId="test-user-id" />
      </main>
    </div>
  )
}
