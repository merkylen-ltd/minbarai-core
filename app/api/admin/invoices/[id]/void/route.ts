import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/admin'
import { cookies } from 'next/headers'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
})

export async function POST(
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
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      )
    }

    if (invoice.status !== 'open') {
      return NextResponse.json(
        { error: `Cannot void invoice with status '${invoice.status}'` },
        { status: 400 }
      )
    }

    if (!invoice.stripe_invoice_id) {
      return NextResponse.json(
        { error: 'Invoice has no Stripe invoice ID' },
        { status: 400 }
      )
    }

    await stripe.invoices.voidInvoice(invoice.stripe_invoice_id)

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

    return NextResponse.json({
      success: true,
      message: 'Invoice voided successfully',
    })
  } catch (error) {
    console.error('Void invoice error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to void invoice' },
      { status: 500 }
    )
  }
}
