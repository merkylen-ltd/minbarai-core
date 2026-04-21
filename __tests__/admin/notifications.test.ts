/** @jest-environment node */

/**
 * Tests for lib/admin/notifications.ts
 *
 * Logging activity must NEVER crash the calling route — a failed insert into
 * the notifications table is strictly lower priority than the business
 * operation that triggered it (void, payment, etc.). These tests lock that in.
 */

jest.mock('@/lib/supabase/admin', () => ({ createAdminClient: jest.fn() }))

import { logNotification } from '@/lib/admin/notifications'
import { createAdminClient } from '@/lib/supabase/admin'

function makeClient(insertResult: { error: unknown } = { error: null }) {
  const insertMock = jest.fn(async () => insertResult)
  return {
    insertMock,
    client: {
      from: jest.fn(() => ({ insert: insertMock })),
    },
  }
}

describe('logNotification', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('inserts a well-formed notification row', async () => {
    const { client, insertMock } = makeClient()

    await logNotification({
      type: 'invoice_paid',
      title: 'Paid invoice for client@org.com',
      message: 'Subscription activated',
      actorEmail: 'stripe-webhook',
      targetEmail: 'client@org.com',
      metadata: { invoice_id: 'inv_1', amount_cents: 15000 },
      client: client as unknown as ReturnType<typeof createAdminClient>,
    })

    expect(insertMock).toHaveBeenCalledTimes(1)
    const row = (insertMock.mock.calls[0] as unknown[])[0] as Record<string, unknown>
    expect(row.type).toBe('invoice_paid')
    expect(row.title).toBe('Paid invoice for client@org.com')
    expect(row.message).toBe('Subscription activated')
    expect(row.actor_email).toBe('stripe-webhook')
    expect(row.target_email).toBe('client@org.com')
    expect(row.metadata).toEqual({ invoice_id: 'inv_1', amount_cents: 15000 })
  })

  it('coerces missing optional fields to null / {}', async () => {
    const { client, insertMock } = makeClient()

    await logNotification({
      type: 'invoice_sync',
      title: 'Synced',
      client: client as unknown as ReturnType<typeof createAdminClient>,
    })

    const row = (insertMock.mock.calls[0] as unknown[])[0] as Record<string, unknown>
    expect(row.message).toBeNull()
    expect(row.actor_email).toBeNull()
    expect(row.target_email).toBeNull()
    expect(row.metadata).toEqual({})
  })

  it('creates its own admin client when one is not passed', async () => {
    const { client } = makeClient()
    ;(createAdminClient as jest.Mock).mockReturnValue(client)

    await logNotification({ type: 'invoice_created', title: 't' })

    expect(createAdminClient).toHaveBeenCalledTimes(1)
  })

  it('CRITICAL: does NOT throw when the DB insert returns an error', async () => {
    const { client } = makeClient({ error: { message: 'perm denied' } })

    await expect(
      logNotification({
        type: 'invoice_voided',
        title: 't',
        client: client as unknown as ReturnType<typeof createAdminClient>,
      }),
    ).resolves.toBeUndefined()
  })

  it('CRITICAL: does NOT throw when the DB call itself throws (e.g. network error)', async () => {
    const broken = {
      from: jest.fn(() => ({
        insert: jest.fn().mockRejectedValue(new Error('boom')),
      })),
    }

    await expect(
      logNotification({
        type: 'invoice_paid',
        title: 't',
        client: broken as unknown as ReturnType<typeof createAdminClient>,
      }),
    ).resolves.toBeUndefined()
  })
})
