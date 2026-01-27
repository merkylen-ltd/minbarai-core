import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isAdminUser } from '@/lib/auth/admin'
import AdminSidebar from '@/components/admin/AdminSidebar'
import AdminHeader from '@/components/admin/AdminHeader'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: { user } } = await supabase.auth.getUser()

  // Redirect if not authenticated
  if (!user) {
    redirect('/auth/signin?redirect=/admin&message=Please sign in to access the admin panel')
  }

  // Redirect if not admin
  if (!isAdminUser(user.email)) {
    redirect('/dashboard?error=Access denied: Admin privileges required')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-800 to-primary-700">
      <AdminSidebar />
      <AdminHeader userEmail={user.email} />
      
      {/* Main content area with proper spacing for both header and sidebar */}
      <main className="pt-16 lg:pl-64 min-h-screen">
        <div className="p-8 max-w-[1800px] mx-auto">
          {children}
        </div>
      </main>
    </div>
  )
}
