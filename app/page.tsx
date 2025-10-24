import LandingPage from '@/components/landing/LandingPage'
import { redirect } from 'next/navigation'

export default function HomePage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined }
}) {
  // Handle OAuth callback redirects that might land on the root page
  const code = searchParams.code
  const next = searchParams.next as string
  const action = searchParams.action as string
  const error = searchParams.error as string
  const errorDescription = searchParams.error_description as string

  // Handle OAuth errors that land on root page
  if (error) {
    const errorUrl = new URL('/auth/auth-code-error', process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000')
    errorUrl.searchParams.set('error', 'oauth_error')
    if (errorDescription) {
      errorUrl.searchParams.set('description', errorDescription)
    }
    redirect(errorUrl.toString())
  }

  // Handle OAuth success with authorization code
  if (code) {
    // Redirect to the proper callback route
    const callbackUrl = new URL('/auth/callback', process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000')
    if (next) callbackUrl.searchParams.set('next', next)
    if (action) callbackUrl.searchParams.set('action', action)
    callbackUrl.searchParams.set('code', code as string)
    
    redirect(callbackUrl.toString())
  }

  return <LandingPage />
}
