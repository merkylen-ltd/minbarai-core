import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/admin'
import { cookies } from 'next/headers'
import { activateAdminInvoiceAccounts, activateSingleUserForInvoice } from '@/lib/admin/activate-invoice'
import { logNotification } from '@/lib/admin/notifications'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
})

/**
 * Reconcile open→paid transitions.
 *
 * The Stripe webhook is the primary path for marking invoices paid. But if a
 * webhook was missed (misconfigured endpoint, signing-secret mismatch, 5xx
 * during processing), paid invoices sit as 'open' in our DB forever. This
 * helper runs when the admin views the detail page OR clicks Sync — if DB
 * says open and Stripe says paid, we catch up via the same idempotent
 * activation path the webhook uses.
 *
 * Intentionally ONLY handles open→paid. Never touch paid→anything: a Stripe
 * refund or dispute that flipped the Stripe side needs a separate, deliberate
 * refund flow — not a silent DB mutation here.
 */
async function reconcileStatusFromStripe(
  adminClient: ReturnType<typeof createAdminClient>,
  invoice: Record<string, unknown>,
  stripeInvoice: Stripe.Invoice,
  actorEmail: string | null,
): Promise<{ reconciled: boolean; reason?: string }> {
  if (invoice.status !== 'open') return { reconciled: false, reason: 'db-not-open' }
  if (stripeInvoice.status !== 'paid') return { reconciled: false, reason: 'stripe-not-paid' }

  try {
    const metadata = stripeInvoice.metadata || {}
    const durationDays = parseInt(String(metadata.duration_days || invoice.duration_days || 0), 10)
    const sessionLimitMinutes = parseInt(
      String(metadata.session_limit_minutes || invoice.session_limit_minutes || 0),
      10,
    )

    if (!durationDays || !sessionLimitMinutes) {
      return { reconciled: false, reason: 'missing-activation-params' }
    }

    // Activate via the same path the webhook uses. Per-email idempotent.
    // Reconcile does NOT invite missing users — that's the webhook's job on first
    // payment. If a user is missing here, something upstream is broken and we
    // surface via failures rather than silently creating accounts.
    const invoiceRow = invoice as unknown as Parameters<typeof activateAdminInvoiceAccounts>[0]
    const result = await activateAdminInvoiceAccounts(
      invoiceRow,
      { durationDays, sessionLimitMinutes },
      adminClient,
      (email, dd, sl, sid) =>
        activateSingleUserForInvoice(adminClient, email, dd, sl, sid, { inviteIfMissing: false }),
    )

    await logNotification({
      type: 'invoice_sync',
      title: `Reconciled invoice status (open → paid) for ${invoice.recipient_email}`,
      message: `Stripe confirmed payment. Activated ${result.newlyActivated.length}/${result.targets.length} account(s).`,
      actorEmail,
      targetEmail: invoice.recipient_email as string,
      metadata: {
        invoice_id: invoice.id,
        stripe_invoice_id: invoice.stripe_invoice_id,
        activated: result.newlyActivated.map(n => n.email),
        failed: result.failures.map(f => f.email),
      },
      client: adminClient,
    })

    return { reconciled: true }
  } catch (err) {
    console.error(`[Reconcile] Activation during reconcile failed for ${invoice.id}:`, err)
    return {
      reconciled: false,
      reason: err instanceof Error ? err.message : 'reconcile-failed',
    }
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
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

    let stripeData: Stripe.Invoice | null = null
    let reconciled = false
    let reconcileReason: string | undefined

    if (invoice.stripe_invoice_id) {
      try {
        stripeData = await stripe.invoices.retrieve(invoice.stripe_invoice_id)
      } catch (err) {
        console.error(`[Invoice GET] Failed to retrieve Stripe invoice ${invoice.stripe_invoice_id}:`, err)
      }

      // Opportunistic reconcile — only open→paid. Failures here must NOT
      // block the read; the admin still needs to see the invoice.
      if (stripeData) {
        const result = await reconcileStatusFromStripe(adminClient, invoice, stripeData, user.email ?? null)
        reconciled = result.reconciled
        reconcileReason = result.reason
      }
    }

    // Re-fetch invoice if we reconciled, so the UI shows the fresh status
    let finalInvoice = invoice
    if (reconciled) {
      const { data: refreshed } = await adminClient
        .from('admin_invoices')
        .select('*')
        .eq('id', invoiceId)
        .single()
      if (refreshed) finalInvoice = refreshed
    }

    return NextResponse.json({
      invoice: {
        ...finalInvoice,
        stripeStatus: stripeData?.status,
        stripeAmountDue: stripeData?.amount_due,
        stripePaid: stripeData?.paid,
        reconciled,
        reconcileReason,
      },
    })
  } catch (error) {
    console.error('Get invoice detail error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch invoice' },
      { status: 500 }
    )
  }
}
