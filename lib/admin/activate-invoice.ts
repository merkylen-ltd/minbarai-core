/**
 * Pure activation logic for admin invoices.
 *
 * Extracted from the Stripe webhook handler so the money-path branching
 * (single vs bulk, per-email idempotency, partial failure, child customer_id
 * handling) can be unit-tested in isolation without Stripe signature
 * verification scaffolding. Shared by both the webhook handler AND the
 * reconcile path on the invoice detail GET.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Activate a single user for an admin invoice payment. Extends (or starts) a
 * subscription by `durationDays`, lifts `is_suspended`, and updates session
 * limits. Creates-and-invites the user if they don't exist yet. Returns the
 * Supabase user id.
 */
export async function activateSingleUserForInvoice(
  supabaseAdmin: SupabaseClient,
  recipientEmail: string,
  durationDays: number,
  sessionLimitMinutes: number,
  stripeCustomerId: string | null,
  options: { inviteIfMissing?: boolean } = {},
): Promise<string> {
  const inviteIfMissing = options.inviteIfMissing !== false // default true

  const { data: existingUser } = await supabaseAdmin
    .from('users')
    .select('id, subscription_period_end')
    .eq('email', recipientEmail.toLowerCase().trim())
    .single()

  const now = new Date()
  const existingEnd = existingUser?.subscription_period_end
    ? new Date(existingUser.subscription_period_end)
    : now
  const baseDate = existingEnd > now ? existingEnd : now
  const newPeriodEnd = new Date(baseDate.getTime() + durationDays * 24 * 60 * 60 * 1000)

  const updatePayload = {
    subscription_status: 'active',
    subscription_id: null,
    customer_id: stripeCustomerId,
    subscription_period_end: newPeriodEnd.toISOString(),
    session_limit_minutes: sessionLimitMinutes,
    is_suspended: false,
  }

  if (existingUser) {
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update(updatePayload)
      .eq('id', existingUser.id)
    if (updateError) throw updateError
    return existingUser.id
  }

  if (!inviteIfMissing) {
    throw new Error(`User ${recipientEmail} not found — activation requires pre-existing account`)
  }

  // Invite + update — first payment flow
  const { data: authResponse, error: authError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
    recipientEmail,
    { data: { invited_by: 'admin_invoice' } },
  )

  if (authError || !authResponse?.user) {
    throw new Error(`Failed to invite user ${recipientEmail}: ${authError?.message || 'unknown'}`)
  }

  const userId = authResponse.user.id
  // Use upsert rather than update: the auth trigger that creates the public.users
  // row may not have fired yet when this code runs, making a plain update a no-op.
  const { error: updateError } = await supabaseAdmin
    .from('users')
    .upsert({
      id: userId,
      email: recipientEmail.toLowerCase().trim(),
      ...updatePayload,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })

  if (updateError) throw updateError
  return userId
}

export interface AdminInvoiceRow {
  id: string
  recipient_email: string
  org_name: string | null
  stripe_customer_id: string | null
  account_emails: string[] | null
  activated_account_emails: string[] | null
  activated_at: string | null
  supabase_user_id: string | null
}

export interface ActivationContext {
  durationDays: number
  sessionLimitMinutes: number
}

export interface ActivationResult {
  targets: string[]
  newlyActivated: Array<{ email: string; userId: string }>
  failures: Array<{ email: string; error: unknown }>
  previouslyActivated: string[]
  /** True when every target in account_emails (or [recipient_email]) is now in activated_account_emails. */
  fullyActivated: boolean
  /** True when the invoice covers multiple child accounts (account_emails is non-empty). */
  isBulk: boolean
}

/**
 * Activate N accounts for a paid admin invoice.
 *
 * Guarantees:
 * - Per-email idempotency: emails already in `activated_account_emails` are skipped,
 *   so Stripe retries never double-extend a subscription.
 * - Partial-failure safe: if any activation fails, the caller is expected to throw
 *   (so Stripe retries the webhook). The DB state is updated BEFORE re-throwing so
 *   successful activations persist even on retry.
 * - Child accounts in bulk mode get `stripe_customer_id = null` — they must not
 *   inherit the billing payer's Stripe customer id (would share portal/billing state).
 */
export async function activateAdminInvoiceAccounts(
  adminInvoice: AdminInvoiceRow,
  ctx: ActivationContext,
  supabaseAdmin: SupabaseClient,
  activateUser: (
    email: string,
    durationDays: number,
    sessionLimitMinutes: number,
    stripeCustomerId: string | null,
  ) => Promise<string>,
): Promise<ActivationResult> {
  const childAccountEmails: string[] = Array.isArray(adminInvoice.account_emails)
    ? adminInvoice.account_emails.filter(
        (e: unknown): e is string => typeof e === 'string' && e.length > 0,
      )
    : []
  const isBulk = childAccountEmails.length > 0
  const targets: string[] = isBulk ? childAccountEmails : [adminInvoice.recipient_email]

  const previouslyActivated: string[] = Array.isArray(adminInvoice.activated_account_emails)
    ? adminInvoice.activated_account_emails.filter((e: unknown): e is string => typeof e === 'string')
    : []
  const alreadyActivatedSet = new Set(previouslyActivated.map(e => e.toLowerCase()))

  const newlyActivated: Array<{ email: string; userId: string }> = []
  const failures: Array<{ email: string; error: unknown }> = []

  for (const targetEmail of targets) {
    if (alreadyActivatedSet.has(targetEmail.toLowerCase())) {
      continue
    }
    try {
      const stripeCustomerIdForUser =
        isBulk && targetEmail !== adminInvoice.recipient_email
          ? null
          : adminInvoice.stripe_customer_id

      const uid = await activateUser(
        targetEmail,
        ctx.durationDays,
        ctx.sessionLimitMinutes,
        stripeCustomerIdForUser,
      )
      newlyActivated.push({ email: targetEmail, userId: uid })
    } catch (err) {
      failures.push({ email: targetEmail, error: err })
    }
  }

  const mergedActivatedEmails = Array.from(
    new Set([...previouslyActivated, ...newlyActivated.map(n => n.email)]),
  )
  const fullyActivated = mergedActivatedEmails.length === targets.length
  const primaryUserId = newlyActivated[0]?.userId || adminInvoice.supabase_user_id || null

  const updatePayload: Record<string, unknown> = {
    status: 'paid',
    supabase_user_id: primaryUserId,
    activated_account_emails: mergedActivatedEmails,
  }
  // Only stamp activated_at on full success — partial success leaves it null so Stripe retries
  if (fullyActivated) {
    updatePayload.activated_at = new Date().toISOString()
  }

  // When fully activated, guard with activated_at IS NULL so a concurrent
  // invoice.paid + invoice.payment_succeeded pair can't both write activated_at.
  // The winning process sets it; the loser's update is silently a no-op (safe:
  // activated_account_emails was already written by the winner).
  const baseQuery = supabaseAdmin
    .from('admin_invoices')
    .update(updatePayload)
    .eq('id', adminInvoice.id)

  const { error: updateError } = fullyActivated
    ? await baseQuery.is('activated_at', null)
    : await baseQuery

  if (updateError) {
    throw updateError
  }

  return {
    targets,
    newlyActivated,
    failures,
    previouslyActivated,
    fullyActivated,
    isBulk,
  }
}
