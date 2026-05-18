import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase/admin'
import { adminWelcomeNewUserEmail } from '@/lib/email/templates/admin-welcome-new-user'
import { adminInvoiceNotificationEmail } from '@/lib/email/templates/admin-invoice-notification'
import { generateSecurePassword } from '@/lib/auth/password-strength'

// Lazy init — the Resend SDK constructor throws if the key is missing/empty.
// Module-level `new Resend(...)` breaks `next build` when env vars aren't
// available at build time (e.g. Docker builds where secrets are injected at
// runtime). Initialize on first use instead.
let resendClient: Resend | null = null
function getResend(): Resend {
  if (!resendClient) {
    const key = process.env.RESEND_API_KEY
    if (!key || key === 'your_resend_api_key') {
      throw new Error('RESEND_API_KEY is not configured')
    }
    resendClient = new Resend(key)
  }
  return resendClient
}

export interface CreateAccountParams {
  email: string
  organizationName?: string
  durationDays: number
  sessionLimitMinutes: number
}

export interface AccountCreationResult {
  userId: string
  email: string
  temporaryPassword: string
}

/**
 * Create a new user account via Supabase Auth + Users table
 */
export async function createAdminAccount(params: CreateAccountParams): Promise<AccountCreationResult> {
  const adminClient = createAdminClient()
  const tempPassword = generateSecurePassword()

  try {
    // Create auth user with temporary password
    const { data: authUser, error: authError } = await adminClient.auth.admin.createUser({
      email: params.email,
      password: tempPassword,
      email_confirm: false, // User must change password first
      user_metadata: {
        created_via: 'admin_invoice',
        created_at: new Date().toISOString(),
      },
    })

    if (authError || !authUser.user) {
      throw new Error(`Failed to create auth user: ${authError?.message}`)
    }

    // Calculate subscription period end
    const periodEnd = new Date()
    periodEnd.setDate(periodEnd.getDate() + params.durationDays)

    // Create users table record
    const { error: dbError } = await adminClient
      .from('users')
      .insert({
        id: authUser.user.id,
        email: params.email,
        subscription_status: 'active', // Activated by invoice creation
        subscription_id: null,
        customer_id: null,
        subscription_period_end: periodEnd.toISOString(),
        session_limit_minutes: params.sessionLimitMinutes,
        password_change_required: true,
        temporary_password_set_at: new Date().toISOString(),
        is_suspended: false,
      })

    if (dbError) {
      // Cleanup: delete auth user if DB insert fails
      await adminClient.auth.admin.deleteUser(authUser.user.id)
      throw new Error(`Failed to create user record: ${dbError.message}`)
    }

    return {
      userId: authUser.user.id,
      email: params.email,
      temporaryPassword: tempPassword,
    }
  } catch (error) {
    throw error
  }
}

/**
 * Send welcome email with credentials to newly created user
 */
export async function sendWelcomeEmailWithCredentials(params: {
  email: string
  organizationName?: string
  temporaryPassword: string
  dashboardUrl: string
}): Promise<void> {
  const emailTemplate = adminWelcomeNewUserEmail({
    organizationName: params.organizationName,
    email: params.email,
    temporaryPassword: params.temporaryPassword,
    dashboardUrl: params.dashboardUrl,
  })

  const { error } = await getResend().emails.send({
    from: process.env.RESEND_FROM_EMAIL || 'support@minbarai.com',
    to: params.email,
    subject: emailTemplate.subject,
    html: emailTemplate.html,
  })

  if (error) {
    console.error('Failed to send welcome email:', error)
    throw new Error(`Failed to send welcome email: ${error.message}`)
  }
}

/**
 * Send invoice notification email to user
 */
export async function sendInvoiceNotificationEmail(params: {
  organizationName?: string
  recipientEmail: string
  amount: number
  currency: string
  description: string
  dueDate: string
  invoiceUrl: string
}): Promise<void> {
  const emailTemplate = adminInvoiceNotificationEmail({
    organizationName: params.organizationName,
    amount: params.amount,
    currency: params.currency,
    description: params.description,
    dueDate: params.dueDate,
    invoiceUrl: params.invoiceUrl,
    recipientEmail: params.recipientEmail,
  })

  const { error } = await getResend().emails.send({
    from: process.env.RESEND_FROM_EMAIL || 'support@minbarai.com',
    to: params.recipientEmail,
    subject: emailTemplate.subject,
    html: emailTemplate.html,
  })

  if (error) {
    console.error('Failed to send invoice email:', error)
    throw new Error(`Failed to send invoice email: ${error.message}`)
  }
}
