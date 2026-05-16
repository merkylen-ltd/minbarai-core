/**
 * Explicit "Sync from Stripe" action for an admin invoice.
 *
 * Same reconcile logic as the detail GET, but: (1) admin-initiated so user sees
 * feedback, (2) returns structured result for UI display. Protects against the
 * case where the Stripe webhook was missed (bad signing secret, misconfigured
 * endpoint) and leaves admin with a "stuck open" paid invoice.
 *
 * Intentionally ONLY handles open→paid. Never flips paid→anything — refund
 * handling is a separate surface with its own audit concerns.
 */

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/admin'
import { cookies } from 'next/headers'
import {
  activateAdminInvoiceAccounts,
  activateSingleUserForInvoice,
} from '@/lib/admin/activate-invoice'
import { logNotification } from '@/lib/admin/notifications'
import { getStripe } from '@/lib/stripe/config'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const stripe = getStripe()
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    requireAdmin(user.email)

    const adminClient = createAdminClient()
    const invoiceId = params.id

    const { data: invoice, error } = await adminClient
      .from('admin_invoices')
      .select('*')
      .eq('id', invoiceId)
      .single()

    if (error || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    if (!invoice.stripe_invoice_id) {
      return NextResponse.json(
        { error: 'Invoice has no Stripe invoice ID' },
        { status: 400 },
      )
    }

    // Retrieve current Stripe state
    let stripeInvoice: Stripe.Invoice
    try {
      stripeInvoice = await stripe.invoices.retrieve(invoice.stripe_invoice_id)
    } catch (err) {
      return NextResponse.json(
        {
          error: `Failed to retrieve Stripe invoice: ${err instanceof Error ? err.message : 'unknown'}`,
        },
        { status: 502 },
      )
    }

    // Case: already in sync
    if (invoice.status === stripeInvoice.status) {
      return NextResponse.json({
        success: true,
        alreadyInSync: true,
        dbStatus: invoice.status,
        stripeStatus: stripeInvoice.status,
      })
    }

    // Case: only open→paid is handled here. Other transitions (e.g., Stripe
    // says 'void' / 'uncollectible' / 'refunded') need deliberate flows elsewhere.
    if (invoice.status !== 'open' || stripeInvoice.status !== 'paid') {
      return NextResponse.json({
        success: false,
        dbStatus: invoice.status,
        stripeStatus: stripeInvoice.status,
        message:
          `Status mismatch detected (db=${invoice.status}, stripe=${stripeInvoice.status}) — ` +
          `automatic reconcile only handles open→paid. Manual review required.`,
      }, { status: 409 })
    }

    const metadata = stripeInvoice.metadata || {}
    const durationDays = parseInt(
      String(metadata.duration_days || invoice.duration_days || 0),
      10,
    )
    const sessionLimitMinutes = parseInt(
      String(metadata.session_limit_minutes || invoice.session_limit_minutes || 0),
      10,
    )

    if (isNaN(durationDays) || durationDays <= 0 || isNaN(sessionLimitMinutes) || sessionLimitMinutes <= 0) {
      return NextResponse.json(
        { error: 'Invoice missing duration/session_limit metadata — cannot activate' },
        { status: 422 },
      )
    }

    const result = await activateAdminInvoiceAccounts(
      invoice,
      { durationDays, sessionLimitMinutes },
      adminClient,
      (email, dd, sl, sid) =>
        activateSingleUserForInvoice(adminClient, email, dd, sl, sid, { inviteIfMissing: false }),
    )

    await logNotification({
      type: 'invoice_sync',
      title: `Manually reconciled invoice (open → paid) for ${invoice.recipient_email}`,
      message: `${result.newlyActivated.length}/${result.targets.length} account(s) activated via Sync button.`,
      actorEmail: user.email,
      targetEmail: invoice.recipient_email,
      metadata: {
        invoice_id: invoiceId,
        stripe_invoice_id: invoice.stripe_invoice_id,
        is_bulk: result.isBulk,
        activated: result.newlyActivated.map(n => n.email),
        previously_activated: result.previouslyActivated,
        failed: result.failures.map(f => ({
          email: f.email,
          error: f.error instanceof Error ? f.error.message : String(f.error),
        })),
      },
      client: adminClient,
    })

    return NextResponse.json({
      success: result.failures.length === 0,
      reconciled: true,
      newlyActivated: result.newlyActivated.map(n => n.email),
      previouslyActivated: result.previouslyActivated,
      failed: result.failures.map(f => ({
        email: f.email,
        error: f.error instanceof Error ? f.error.message : String(f.error),
      })),
    })
  } catch (error) {
    console.error('Sync invoice error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to sync invoice' },
      { status: 500 },
    )
  }
}
