import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/admin'
import { cookies } from 'next/headers'
import { randomUUID } from 'crypto'
import { sendAdminInvoiceEmail } from '@/lib/admin/send-invoice-email'
import { logNotification } from '@/lib/admin/notifications'
import { getStripe } from '@/lib/stripe/config'

interface CreateInvoiceRequest {
  recipientEmail: string
  orgName?: string
  amount: number
  currency: string
  description: string
  durationDays: number
  sessionLimitMinutes: number
  dueDate: string
  promoCodeId?: string
  accountEmails?: string[]
}

// POST /api/admin/invoices
export async function POST(request: NextRequest) {
  try {
    const stripe = getStripe()
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    requireAdmin(user.email)

    const body: CreateInvoiceRequest = await request.json()

    if (!body.recipientEmail || !body.currency || !body.description || !body.dueDate) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(body.recipientEmail)) {
      return NextResponse.json(
        { error: 'Invalid recipient email format' },
        { status: 400 }
      )
    }

    if (typeof body.amount !== 'number' || body.amount <= 0) {
      return NextResponse.json(
        { error: 'amount must be a positive number' },
        { status: 400 }
      )
    }

    if (!Number.isInteger(body.durationDays) || body.durationDays <= 0 || body.durationDays > 3650) {
      return NextResponse.json(
        { error: 'durationDays must be a positive integer between 1 and 3650' },
        { status: 400 }
      )
    }

    if (!Number.isInteger(body.sessionLimitMinutes) || body.sessionLimitMinutes <= 0 || body.sessionLimitMinutes > 100000) {
      return NextResponse.json(
        { error: 'sessionLimitMinutes must be a positive integer' },
        { status: 400 }
      )
    }

    const adminClient = createAdminClient()
    const amountCents = Math.round(body.amount * 100)
    const adminInvoiceId = randomUUID()
    const accountEmails = Array.isArray(body.accountEmails)
      ? body.accountEmails.map(e => e.toLowerCase().trim()).filter(Boolean)
      : []

    if (accountEmails.length > 100) {
      return NextResponse.json(
        { error: 'Maximum 100 accounts per bulk invoice' },
        { status: 400 }
      )
    }

    // Validate promo code if provided
    let promoCodeRecord = null
    let discountAmountCents = 0
    let finalAmountCents = amountCents

    if (body.promoCodeId) {
      const { data: promo } = await adminClient
        .from('promo_codes')
        .select('*')
        .eq('id', body.promoCodeId)
        .single()

      if (!promo) {
        return NextResponse.json(
          { error: 'Promo code not found' },
          { status: 400 }
        )
      }

      if (!promo.is_active) {
        return NextResponse.json(
          { error: 'Promo code is not active' },
          { status: 400 }
        )
      }

      if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
        return NextResponse.json(
          { error: 'Promo code has expired' },
          { status: 400 }
        )
      }

      if (promo.max_redemptions && promo.redemptions_count >= promo.max_redemptions) {
        return NextResponse.json(
          { error: 'Promo code has reached max redemptions' },
          { status: 400 }
        )
      }

      if (promo.amount_off_cents && promo.currency !== body.currency) {
        return NextResponse.json(
          { error: `Promo code currency (${promo.currency}) does not match invoice currency (${body.currency})` },
          { status: 400 }
        )
      }

      promoCodeRecord = promo

      if (promo.amount_off_cents) {
        discountAmountCents = promo.amount_off_cents
      } else if (promo.percent_off) {
        discountAmountCents = Math.round((amountCents * parseFloat(promo.percent_off.toString())) / 100)
      }

      finalAmountCents = Math.max(0, amountCents - discountAmountCents)
    }

    // Get or create Stripe customer
    let customer: Stripe.Customer | null = null
    const existingCustomers = await stripe.customers.list({
      email: body.recipientEmail,
      limit: 1,
    })

    if (existingCustomers.data.length > 0) {
      customer = existingCustomers.data[0]
    } else {
      customer = await stripe.customers.create(
        {
          email: body.recipientEmail,
          name: body.orgName || 'Organization',
          metadata: {
            minbarai_source: 'admin_invoice',
          },
        },
        {
          idempotencyKey: `cus-create-${adminInvoiceId}`,
        }
      )
    }

    // Create invoice
    const daysUntilDue = Math.max(1, Math.ceil(
      (new Date(body.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    ))

    const stripeInvoice = await stripe.invoices.create(
      {
        customer: customer.id,
        collection_method: 'send_invoice',
        days_until_due: daysUntilDue,
        currency: body.currency.toLowerCase(),
        pending_invoice_items_behavior: 'exclude',
        metadata: {
          minbarai_type: 'admin_invoice',
          admin_invoice_id: adminInvoiceId,
          duration_days: body.durationDays.toString(),
          session_limit_minutes: body.sessionLimitMinutes.toString(),
          account_count: String(accountEmails.length || 1),
        },
      },
      {
        idempotencyKey: `inv-create-${adminInvoiceId}`,
      }
    )

    // Create invoice line item
    await stripe.invoiceItems.create(
      {
        customer: customer.id,
        invoice: stripeInvoice.id,
        amount: amountCents,
        currency: body.currency.toLowerCase(),
        description: body.description,
      },
      {
        idempotencyKey: `ii-create-${adminInvoiceId}`,
      }
    )

    // Apply promo code if provided
    if (promoCodeRecord && promoCodeRecord.stripe_promotion_code_id) {
      await stripe.invoices.update(
        stripeInvoice.id,
        {
          discounts: [
            {
              promotion_code: promoCodeRecord.stripe_promotion_code_id,
            },
          ],
        },
        {
          idempotencyKey: `inv-discount-${adminInvoiceId}`,
        }
      )
    }

    // Finalize invoice
    const finalizedInvoice = await stripe.invoices.finalizeInvoice(
      stripeInvoice.id,
      {},
      {
        idempotencyKey: `inv-finalize-${adminInvoiceId}`,
      }
    )

    // Send invoice via Stripe (best-effort — depends on Stripe Dashboard email
    // settings). We retrieve BEFORE sending so we have the hosted_invoice_url
    // regardless, and we also send our own Resend email below so the customer
    // always receives a payment link even if Stripe email delivery is disabled.
    try {
      await stripe.invoices.sendInvoice(
        stripeInvoice.id,
        {},
        {
          idempotencyKey: `inv-send-${adminInvoiceId}`,
        }
      )
    } catch (stripeSendErr) {
      console.error(
        `[Invoice] stripe.invoices.sendInvoice failed for ${stripeInvoice.id} — continuing with Resend fallback:`,
        stripeSendErr,
      )
    }

    // Retrieve final invoice (includes hosted_invoice_url populated at finalize)
    const retrievedInvoice = await stripe.invoices.retrieve(stripeInvoice.id)

    // Branded Resend email with the hosted payment URL — always-on delivery path
    if (retrievedInvoice.hosted_invoice_url) {
      const emailResult = await sendAdminInvoiceEmail({
        recipientEmail: body.recipientEmail,
        organizationName: body.orgName || null,
        amountCents: finalAmountCents,
        currency: body.currency,
        description: body.description,
        dueDate: body.dueDate,
        invoiceUrl: retrievedInvoice.hosted_invoice_url,
      })
      if (!emailResult.success) {
        console.error(
          `[Invoice] Resend fallback email failed for ${body.recipientEmail}:`,
          emailResult.error,
        )
      }
    } else {
      console.error(
        `[Invoice] No hosted_invoice_url on finalized invoice ${stripeInvoice.id} — customer will not receive email`,
      )
    }

    // Write to database
    const { error: insertError } = await adminClient
      .from('admin_invoices')
      .insert({
        id: adminInvoiceId,
        created_by_email: user.email || '',
        recipient_email: body.recipientEmail,
        org_name: body.orgName || null,
        amount_cents: amountCents,
        currency: body.currency,
        description: body.description,
        duration_days: body.durationDays,
        session_limit_minutes: body.sessionLimitMinutes,
        due_date: body.dueDate,
        promo_code_id: body.promoCodeId || null,
        discount_amount_cents: discountAmountCents,
        final_amount_cents: finalAmountCents,
        stripe_customer_id: customer.id,
        stripe_invoice_id: retrievedInvoice.id,
        stripe_invoice_url: retrievedInvoice.hosted_invoice_url || null,
        status: 'open',
        account_emails: accountEmails,
      })

    if (insertError) {
      console.error('Failed to insert admin invoice:', insertError)
      await stripe.invoices.voidInvoice(retrievedInvoice.id)
      return NextResponse.json(
        { error: 'Failed to save invoice' },
        { status: 500 }
      )
    }

    // Atomic check-and-increment: guards against concurrent requests both passing
    // the optimistic check above. Returns false if max_redemptions already reached.
    if (body.promoCodeId) {
      const { data: claimed } = await adminClient.rpc('use_promo_code', { promo_id: body.promoCodeId })
      if (!claimed) {
        await stripe.invoices.voidInvoice(retrievedInvoice.id)
        return NextResponse.json(
          { error: 'Promo code has reached its maximum redemptions' },
          { status: 409 }
        )
      }
    }

    await logNotification({
      type: 'invoice_created',
      title: accountEmails.length > 0
        ? `Bulk invoice created · ${accountEmails.length} seats for ${body.recipientEmail}`
        : `Invoice created for ${body.recipientEmail}`,
      message: `${(finalAmountCents / 100).toFixed(2)} ${body.currency.toUpperCase()}${
        discountAmountCents > 0 ? ` (promo saved ${(discountAmountCents / 100).toFixed(2)})` : ''
      } · due ${body.dueDate}`,
      actorEmail: user.email,
      targetEmail: body.recipientEmail,
      metadata: {
        invoice_id: adminInvoiceId,
        stripe_invoice_id: retrievedInvoice.id,
        amount_cents: amountCents,
        final_amount_cents: finalAmountCents,
        discount_amount_cents: discountAmountCents,
        currency: body.currency,
        account_count: accountEmails.length || 1,
        is_bulk: accountEmails.length > 0,
      },
      client: adminClient,
    })

    return NextResponse.json({
      success: true,
      invoiceId: adminInvoiceId,
      stripeInvoiceId: retrievedInvoice.id,
      hostedInvoiceUrl: retrievedInvoice.hosted_invoice_url,
      amount: finalAmountCents / 100,
      currency: body.currency,
    })
  } catch (error) {
    console.error('Invoice creation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create invoice' },
      { status: 500 }
    )
  }
}

// GET /api/admin/invoices
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    requireAdmin(user.email)

    const adminClient = createAdminClient()
    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '0', 10)
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100)
    const status = searchParams.get('status')
    const search = searchParams.get('search')

    let query = adminClient
      .from('admin_invoices')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(page * limit, page * limit + limit - 1)

    if (status) {
      query = query.eq('status', status)
    }

    if (search) {
      query = query.ilike('recipient_email', `%${search}%`)
    }

    const { data, count, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      invoices: data,
      pagination: {
        page,
        limit,
        total: count || 0,
      },
    })
  } catch (error) {
    console.error('Get invoices error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch invoices' },
      { status: 500 }
    )
  }
}
