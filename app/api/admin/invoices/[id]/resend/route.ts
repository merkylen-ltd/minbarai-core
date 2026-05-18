import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/admin'
import { cookies } from 'next/headers'
import { sendAdminInvoiceEmail } from '@/lib/admin/send-invoice-email'
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
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      )
    }

    if (invoice.status !== 'open') {
      return NextResponse.json(
        { error: `Cannot resend invoice with status '${invoice.status}'` },
        { status: 400 }
      )
    }

    if (!invoice.stripe_invoice_id) {
      return NextResponse.json(
        { error: 'Invoice has no Stripe invoice ID' },
        { status: 400 }
      )
    }

    // 1. Ask Stripe to (re)send — may silently no-op depending on Dashboard settings
    let stripeSendError: string | null = null
    try {
      await stripe.invoices.sendInvoice(invoice.stripe_invoice_id)
    } catch (err) {
      stripeSendError = err instanceof Error ? err.message : 'Stripe sendInvoice failed'
      console.error(
        `[Invoice] Resend via Stripe failed for ${invoice.stripe_invoice_id}:`,
        err,
      )
    }

    // 2. Ensure we have a payment URL — refetch in case the stored one is stale
    let hostedInvoiceUrl = invoice.stripe_invoice_url
    if (!hostedInvoiceUrl) {
      try {
        const stripeInv = await stripe.invoices.retrieve(invoice.stripe_invoice_id)
        hostedInvoiceUrl = stripeInv.hosted_invoice_url || null
        if (hostedInvoiceUrl) {
          await adminClient
            .from('admin_invoices')
            .update({ stripe_invoice_url: hostedInvoiceUrl })
            .eq('id', invoiceId)
        }
      } catch (err) {
        console.error(
          `[Invoice] Failed to refetch hosted_invoice_url for ${invoice.stripe_invoice_id}:`,
          err,
        )
      }
    }

    if (!hostedInvoiceUrl) {
      return NextResponse.json(
        {
          error:
            'Invoice has no hosted payment URL. It may not have been finalized. Check the Stripe dashboard.',
        },
        { status: 502 }
      )
    }

    // 3. Always send a branded Resend email — the reliable delivery path
    const emailResult = await sendAdminInvoiceEmail({
      recipientEmail: invoice.recipient_email,
      organizationName: invoice.org_name,
      amountCents: invoice.final_amount_cents,
      currency: invoice.currency,
      description: invoice.description,
      dueDate: invoice.due_date,
      invoiceUrl: hostedInvoiceUrl,
    })

    if (!emailResult.success) {
      return NextResponse.json(
        {
          error: emailResult.error || 'Failed to send invoice email',
          stripeAttempted: stripeSendError === null,
        },
        { status: 502 }
      )
    }

    await logNotification({
      type: 'invoice_resent',
      title: `Resent invoice email to ${invoice.recipient_email}`,
      message: `Manual resend by admin · ${(invoice.final_amount_cents / 100).toFixed(2)} ${invoice.currency?.toUpperCase?.() || ''}`,
      actorEmail: user.email,
      targetEmail: invoice.recipient_email,
      metadata: {
        invoice_id: invoiceId,
        stripe_invoice_id: invoice.stripe_invoice_id,
        stripe_send_error: stripeSendError,
      },
      client: adminClient,
    })

    return NextResponse.json({
      success: true,
      message: 'Invoice email sent successfully',
      stripeSendError,
      hostedInvoiceUrl,
    })
  } catch (error) {
    console.error('Resend invoice error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to resend invoice' },
      { status: 500 }
    )
  }
}
