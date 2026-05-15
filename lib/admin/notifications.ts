/**
 * Admin activity feed / notifications.
 *
 * Fire-and-forget inserts into admin_notifications. Failures must NEVER crash
 * the calling route — logging an activity event is lower-priority than the
 * business operation that triggered it. Callers do `await logNotification(...)`
 * purely for ordering; the function itself never throws.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'

export type NotificationType =
  | 'invoice_created'
  | 'invoice_paid'
  | 'invoice_voided'
  | 'invoice_resent'
  | 'invoice_sync'
  | 'account_created'
  | 'accounts_bulk_created'
  | 'account_suspended'
  | 'account_unsuspended'
  | 'account_deleted'
  | 'promo_code_created'
  | 'promo_code_deactivated'
  | 'subscription_extended'
  | 'email_sent'

export interface LogNotificationInput {
  type: NotificationType
  title: string
  message?: string
  actorEmail?: string | null
  targetEmail?: string | null
  metadata?: Record<string, unknown>
  /** Pass an existing admin client to avoid re-instantiating when caller already has one. */
  client?: SupabaseClient
}

export async function logNotification(input: LogNotificationInput): Promise<void> {
  try {
    const client = input.client ?? createAdminClient()
    const { error } = await client.from('admin_notifications').insert({
      type: input.type,
      title: input.title,
      message: input.message ?? null,
      actor_email: input.actorEmail ?? null,
      target_email: input.targetEmail ?? null,
      metadata: input.metadata ?? {},
    })
    if (error) {
      console.error('[Notifications] Failed to log notification:', {
        type: input.type,
        error: error.message,
      })
    }
  } catch (err) {
    console.error('[Notifications] Unexpected error logging notification:', err)
  }
}
