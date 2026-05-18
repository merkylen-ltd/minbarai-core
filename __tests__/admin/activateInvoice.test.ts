/** @jest-environment node */

/**
 * Tests for lib/admin/activate-invoice.ts
 *
 * This is the money path: Stripe's invoice.paid webhook calls into this function
 * to activate user subscriptions. Mistakes here = double-extended subscriptions,
 * stranded paid-but-unactivated users, or credential leaks to wrong Stripe customer.
 */

import {
  activateAdminInvoiceAccounts,
  type AdminInvoiceRow,
} from '@/lib/admin/activate-invoice'

// ---------------------------------------------------------------------------
// Minimal Supabase mock — just needs `.from('admin_invoices').update(...).eq(...)`
// ---------------------------------------------------------------------------

type UpdateCall = {
  table: string
  payload: Record<string, unknown>
  filter: { column: string; value: unknown }
}

function mockSupabase(overrideUpdateResult?: { error: unknown }) {
  const updateCalls: UpdateCall[] = []

  const makeEqResult = (table: string, payload: Record<string, unknown>, column: string, value: unknown) => {
    const result = overrideUpdateResult ?? { error: null }
    // Must be both awaitable (.eq() direct await) and chainable (.eq().is())
    const obj = {
      is: async () => {
        updateCalls.push({ table, payload, filter: { column, value } })
        return result
      },
      // Make the object itself thenable so `await baseQuery` works
      then(resolve: (v: typeof result) => unknown, reject?: (e: unknown) => unknown) {
        updateCalls.push({ table, payload, filter: { column, value } })
        return Promise.resolve(result).then(resolve, reject)
      },
    }
    return obj
  }

  const client = {
    from: (table: string) => ({
      update: (payload: Record<string, unknown>) => ({
        eq: (column: string, value: unknown) => makeEqResult(table, payload, column, value),
      }),
    }),
  }

  return { client, updateCalls }
}

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function makeInvoice(overrides: Partial<AdminInvoiceRow> = {}): AdminInvoiceRow {
  return {
    id: 'inv_abc',
    recipient_email: 'billing@org.com',
    org_name: 'Org',
    stripe_customer_id: 'cus_billing_123',
    account_emails: [],
    activated_account_emails: [],
    activated_at: null,
    supabase_user_id: null,
    ...overrides,
  }
}

const ctx = { durationDays: 30, sessionLimitMinutes: 120 }

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('activateAdminInvoiceAccounts', () => {
  describe('single-account invoice', () => {
    it('activates the recipient email only and stamps activated_at on full success', async () => {
      const { client, updateCalls } = mockSupabase()
      const activated: string[] = []

      const result = await activateAdminInvoiceAccounts(
        makeInvoice(),
        ctx,
        client as unknown as Parameters<typeof activateAdminInvoiceAccounts>[2],
        async email => {
          activated.push(email)
          return `uid-${email}`
        },
      )

      expect(activated).toEqual(['billing@org.com'])
      expect(result.isBulk).toBe(false)
      expect(result.fullyActivated).toBe(true)
      expect(result.failures).toHaveLength(0)
      expect(result.targets).toEqual(['billing@org.com'])

      expect(updateCalls).toHaveLength(1)
      expect(updateCalls[0].payload.status).toBe('paid')
      expect(updateCalls[0].payload.activated_account_emails).toEqual(['billing@org.com'])
      expect(updateCalls[0].payload.activated_at).toBeDefined()
      expect(updateCalls[0].payload.supabase_user_id).toBe('uid-billing@org.com')
      expect(updateCalls[0].filter).toEqual({ column: 'id', value: 'inv_abc' })
    })

    it('passes the billing customer_id to the recipient activation', async () => {
      const { client } = mockSupabase()
      const callArgs: Array<[string, number, number, string | null]> = []

      await activateAdminInvoiceAccounts(
        makeInvoice({ stripe_customer_id: 'cus_the_payer' }),
        ctx,
        client as unknown as Parameters<typeof activateAdminInvoiceAccounts>[2],
        async (email, dd, sl, sid) => {
          callArgs.push([email, dd, sl, sid])
          return 'uid'
        },
      )

      expect(callArgs).toEqual([['billing@org.com', 30, 120, 'cus_the_payer']])
    })

    it('throws when the DB update fails (caller must surface to Stripe)', async () => {
      const failingClient = {
        from: () => ({
          update: () => ({
            eq: () => ({
              is: async () => ({ error: new Error('db down') }),
              then(resolve: Function, reject?: Function) {
                return Promise.resolve({ error: new Error('db down') }).then(resolve as any, reject as any)
              },
            }),
          }),
        }),
      }

      await expect(
        activateAdminInvoiceAccounts(
          makeInvoice(),
          ctx,
          failingClient as unknown as Parameters<typeof activateAdminInvoiceAccounts>[2],
          async () => 'uid',
        ),
      ).rejects.toThrow('db down')
    })
  })

  describe('bulk invoice — N child accounts share one payer', () => {
    const bulkInvoice = () =>
      makeInvoice({
        recipient_email: 'billing@org.com',
        stripe_customer_id: 'cus_payer',
        account_emails: ['seat+1@org.com', 'seat+2@org.com', 'seat+3@org.com'],
      })

    it('activates all child emails, NOT the billing email', async () => {
      const { client, updateCalls } = mockSupabase()
      const activated: string[] = []

      const result = await activateAdminInvoiceAccounts(
        bulkInvoice(),
        ctx,
        client as unknown as Parameters<typeof activateAdminInvoiceAccounts>[2],
        async email => {
          activated.push(email)
          return `uid-${email}`
        },
      )

      expect(activated).toEqual(['seat+1@org.com', 'seat+2@org.com', 'seat+3@org.com'])
      expect(activated).not.toContain('billing@org.com')
      expect(result.isBulk).toBe(true)
      expect(result.fullyActivated).toBe(true)
      expect(updateCalls[0].payload.activated_account_emails).toEqual([
        'seat+1@org.com',
        'seat+2@org.com',
        'seat+3@org.com',
      ])
    })

    it('passes null customer_id for EVERY child account (prevents billing state leak)', async () => {
      const { client } = mockSupabase()
      const customerIdsSeen: Array<string | null> = []

      await activateAdminInvoiceAccounts(
        bulkInvoice(),
        ctx,
        client as unknown as Parameters<typeof activateAdminInvoiceAccounts>[2],
        async (_email, _dd, _sl, sid) => {
          customerIdsSeen.push(sid)
          return 'uid'
        },
      )

      expect(customerIdsSeen).toEqual([null, null, null])
    })

    it('partial failure: persists the successes, leaves activated_at null, returns failures', async () => {
      const { client, updateCalls } = mockSupabase()
      const result = await activateAdminInvoiceAccounts(
        bulkInvoice(),
        ctx,
        client as unknown as Parameters<typeof activateAdminInvoiceAccounts>[2],
        async email => {
          if (email === 'seat+2@org.com') throw new Error('auth service flaky')
          if (email === 'seat+3@org.com') throw new Error('db timeout')
          return `uid-${email}`
        },
      )

      expect(result.newlyActivated).toEqual([
        { email: 'seat+1@org.com', userId: 'uid-seat+1@org.com' },
      ])
      expect(result.failures).toHaveLength(2)
      expect(result.failures.map(f => f.email).sort()).toEqual([
        'seat+2@org.com',
        'seat+3@org.com',
      ])
      expect(result.fullyActivated).toBe(false)

      // Critical: DB is updated BEFORE the caller throws, so a Stripe retry sees
      // seat+1 in activated_account_emails and skips it — no double-extension.
      expect(updateCalls).toHaveLength(1)
      expect(updateCalls[0].payload.activated_account_emails).toEqual(['seat+1@org.com'])
      expect(updateCalls[0].payload.activated_at).toBeUndefined()
      expect(updateCalls[0].payload.status).toBe('paid')
    })

    it('per-email idempotency: skips emails already in activated_account_emails', async () => {
      const { client, updateCalls } = mockSupabase()
      const activatorCalls: string[] = []

      // Prior webhook attempt already activated seat+1, now retry covers seat+2, seat+3
      const result = await activateAdminInvoiceAccounts(
        makeInvoice({
          account_emails: ['seat+1@org.com', 'seat+2@org.com', 'seat+3@org.com'],
          activated_account_emails: ['seat+1@org.com'],
        }),
        ctx,
        client as unknown as Parameters<typeof activateAdminInvoiceAccounts>[2],
        async email => {
          activatorCalls.push(email)
          return `uid-${email}`
        },
      )

      expect(activatorCalls).toEqual(['seat+2@org.com', 'seat+3@org.com'])
      expect(activatorCalls).not.toContain('seat+1@org.com')
      expect(result.fullyActivated).toBe(true)
      expect(updateCalls[0].payload.activated_account_emails).toEqual([
        'seat+1@org.com',
        'seat+2@org.com',
        'seat+3@org.com',
      ])
      expect(updateCalls[0].payload.activated_at).toBeDefined()
    })

    it('per-email idempotency is case-insensitive', async () => {
      const { client } = mockSupabase()
      const activatorCalls: string[] = []

      await activateAdminInvoiceAccounts(
        makeInvoice({
          account_emails: ['Seat+1@Org.com', 'seat+2@org.com'],
          activated_account_emails: ['seat+1@org.com'],
        }),
        ctx,
        client as unknown as Parameters<typeof activateAdminInvoiceAccounts>[2],
        async email => {
          activatorCalls.push(email)
          return 'uid'
        },
      )

      expect(activatorCalls).toEqual(['seat+2@org.com'])
    })

    it('complete retry after full activation: no activations, no change — caller short-circuits', async () => {
      // In practice the webhook short-circuits earlier via adminInvoice.activated_at.
      // But the lib itself must still behave correctly if called.
      const { client, updateCalls } = mockSupabase()
      const activatorCalls: string[] = []

      const result = await activateAdminInvoiceAccounts(
        makeInvoice({
          account_emails: ['a@x.org', 'b@x.org'],
          activated_account_emails: ['a@x.org', 'b@x.org'],
        }),
        ctx,
        client as unknown as Parameters<typeof activateAdminInvoiceAccounts>[2],
        async email => {
          activatorCalls.push(email)
          return 'uid'
        },
      )

      expect(activatorCalls).toEqual([])
      expect(result.newlyActivated).toEqual([])
      expect(result.fullyActivated).toBe(true)
      expect(updateCalls[0].payload.activated_account_emails).toEqual(['a@x.org', 'b@x.org'])
    })

    it('all three fail: zero activated, activated_at still null, all in failures', async () => {
      const { client, updateCalls } = mockSupabase()

      const result = await activateAdminInvoiceAccounts(
        bulkInvoice(),
        ctx,
        client as unknown as Parameters<typeof activateAdminInvoiceAccounts>[2],
        async () => {
          throw new Error('supabase auth down')
        },
      )

      expect(result.newlyActivated).toEqual([])
      expect(result.failures).toHaveLength(3)
      expect(result.fullyActivated).toBe(false)
      expect(updateCalls[0].payload.activated_account_emails).toEqual([])
      expect(updateCalls[0].payload.activated_at).toBeUndefined()
      expect(updateCalls[0].payload.supabase_user_id).toBeNull()
    })
  })

  describe('defensive input handling', () => {
    it('treats null account_emails as single-account', async () => {
      const { client } = mockSupabase()
      const activatorCalls: string[] = []

      const result = await activateAdminInvoiceAccounts(
        makeInvoice({ account_emails: null }),
        ctx,
        client as unknown as Parameters<typeof activateAdminInvoiceAccounts>[2],
        async email => {
          activatorCalls.push(email)
          return 'uid'
        },
      )

      expect(result.isBulk).toBe(false)
      expect(activatorCalls).toEqual(['billing@org.com'])
    })

    it('filters empty-string values out of account_emails', async () => {
      const { client } = mockSupabase()
      const activatorCalls: string[] = []

      const result = await activateAdminInvoiceAccounts(
        makeInvoice({
          account_emails: ['real@org.com', '', 'another@org.com'],
        }),
        ctx,
        client as unknown as Parameters<typeof activateAdminInvoiceAccounts>[2],
        async email => {
          activatorCalls.push(email)
          return 'uid'
        },
      )

      expect(activatorCalls).toEqual(['real@org.com', 'another@org.com'])
      expect(result.targets).toEqual(['real@org.com', 'another@org.com'])
    })

    it('treats null activated_account_emails as empty list', async () => {
      const { client } = mockSupabase()
      const activatorCalls: string[] = []

      await activateAdminInvoiceAccounts(
        makeInvoice({
          account_emails: ['a@x.org', 'b@x.org'],
          activated_account_emails: null,
        }),
        ctx,
        client as unknown as Parameters<typeof activateAdminInvoiceAccounts>[2],
        async email => {
          activatorCalls.push(email)
          return 'uid'
        },
      )

      expect(activatorCalls).toEqual(['a@x.org', 'b@x.org'])
    })
  })
})
