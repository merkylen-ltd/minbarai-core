import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/admin'
import { cookies } from 'next/headers'
import { logNotification } from '@/lib/admin/notifications'
import { getStripe } from '@/lib/stripe/config'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
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

    // Stripe's API only allows voiding open/draft invoices. Paid invoices
    // require refunds, which are a separate flow.
    if (invoice.status !== 'open') {
      return NextResponse.json(
        { error: `Cannot void invoice with status '${invoice.status}'. Paid invoices require refund.` },
        { status: 400 }
      )
    }

    if (!invoice.stripe_invoice_id) {
      return NextResponse.json(
        { error: 'Invoice has no Stripe invoice ID' },
        { status: 400 }
      )
    }

    // 1. Void in Stripe
    await stripe.invoices.voidInvoice(invoice.stripe_invoice_id)

    // 2. Mark DB row as void
    const { error: updateError } = await adminClient
      .from('admin_invoices')
      .update({ status: 'void' })
      .eq('id', invoiceId)

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to update invoice status' },
        { status: 500 }
      )
    }

    // 3. Cascade — suspend pre-created bulk accounts.
    // Rule: only cascade when account_emails is non-empty (bulk flow). Those
    // child accounts were purpose-built for this invoice and are orphan if it
    // never paid. Single-account invoices may point at an account with its own
    // unrelated history — do NOT touch it.
    const childEmails: string[] = Array.isArray(invoice.account_emails)
      ? invoice.account_emails.filter((e: unknown): e is string => typeof e === 'string' && e.length > 0)
      : []

    const isBulk = childEmails.length > 0
    const suspendedEmails: string[] = []
    const suspensionErrors: Array<{ email: string; error: string }> = []

    if (isBulk) {
      for (const email of childEmails) {
        const { error: suspendErr } = await adminClient
          .from('users')
          .update({
            is_suspended: true,
            subscription_status: 'canceled',
            subscription_period_end: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('email', email.toLowerCase())

        if (suspendErr) {
          console.error(`[Void] Failed to suspend ${email}:`, suspendErr)
          suspensionErrors.push({ email, error: suspendErr.message })
        } else {
          suspendedEmails.push(email)
        }
      }
    }

    // 4. Log activity
    await logNotification({
      type: 'invoice_voided',
      title: isBulk
        ? `Voided bulk invoice · ${suspendedEmails.length}/${childEmails.length} seats suspended`
        : `Voided invoice for ${invoice.recipient_email}`,
      message: isBulk
        ? `Suspended ${suspendedEmails.length} child account(s). Recipient account (billing) left untouched.`
        : `Open invoice voided. Pre-existing account was not modified — manage via Users page if needed.`,
      actorEmail: user.email,
      targetEmail: invoice.recipient_email,
      metadata: {
        invoice_id: invoiceId,
        stripe_invoice_id: invoice.stripe_invoice_id,
        amount_cents: invoice.final_amount_cents,
        currency: invoice.currency,
        is_bulk: isBulk,
        suspended_emails: suspendedEmails,
        suspension_errors: suspensionErrors,
      },
      client: adminClient,
    })

    return NextResponse.json({
      success: true,
      message: 'Invoice voided successfully',
      isBulk,
      suspendedCount: suspendedEmails.length,
      suspensionErrors,
    })
  } catch (error) {
    console.error('Void invoice error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to void invoice' },
      { status: 500 }
    )
  }
}
