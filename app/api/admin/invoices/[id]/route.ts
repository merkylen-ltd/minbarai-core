import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/admin'
import { cookies } from 'next/headers'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
})

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
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      )
    }

    let stripeData = null
    if (invoice.stripe_invoice_id) {
      stripeData = await stripe.invoices.retrieve(invoice.stripe_invoice_id)
    }

    return NextResponse.json({
      invoice: {
        ...invoice,
        stripeStatus: stripeData?.status,
        stripeAmountDue: stripeData?.amount_due,
        stripePaid: stripeData?.paid,
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
