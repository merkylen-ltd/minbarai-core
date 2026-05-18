/** @jest-environment node */

/**
 * Marketing Tools API Tests
 *
 * Covers:
 * 1. POST /api/admin/users — create demo accounts (with/without subscription)
 * 2. POST /api/admin/users/[id]/reset-usage — clear all usage sessions
 * 3. PATCH /api/admin/users/[id]/session-limit — edit session limit
 * 4. POST /api/admin/marketing/bulk-seed — bulk create demo accounts
 */

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}))

jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: jest.fn(),
}))

jest.mock('@/lib/auth/admin', () => ({
  requireAdmin: jest.fn(),
}))

jest.mock('next/headers', () => ({
  cookies: jest.fn().mockResolvedValue({}),
}))

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { NextRequest } from 'next/server'
import { POST as createUserRoute } from '@/app/api/admin/users/route'
import { POST as resetUsageRoute } from '@/app/api/admin/users/[id]/reset-usage/route'
import { PATCH as updateSessionLimitRoute } from '@/app/api/admin/users/[id]/session-limit/route'
import { POST as bulkSeedRoute } from '@/app/api/admin/marketing/bulk-seed/route'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/admin'

// ---------------------------------------------------------------------------
// Test Fixtures
// ---------------------------------------------------------------------------

// Helper to create chainable Supabase query mock
const createSupabaseMock = () => ({
  select: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn(),
})

const mockAdminClient = {
  auth: {
    admin: {
      createUser: jest.fn(),
      deleteUser: jest.fn(),
    },
  },
  from: jest.fn(),
}

const mockAuthClient = {
  auth: {
    getUser: jest.fn(),
  },
}

const mockParams = { id: 'test-user-id' }

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Marketing Tools APIs', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(createAdminClient as jest.Mock).mockReturnValue(mockAdminClient)
    ;(createClient as jest.Mock).mockReturnValue(mockAuthClient)
    ;(requireAdmin as jest.Mock).mockImplementation(() => {})
  })

  // =========================================================================
  // 1. Create Demo Account (POST /api/admin/users)
  // =========================================================================

  describe('POST /api/admin/users (Create Demo Account)', () => {
    it('should create a free trial account without subscription', async () => {
      // Setup
      mockAuthClient.auth.getUser.mockResolvedValue({
        data: { user: { email: 'admin@example.com' } },
      })

      mockAdminClient.auth.admin.createUser.mockResolvedValue({
        data: { user: { id: 'new-user-123' } },
        error: null,
      })

      mockAdminClient.from.mockReturnValue({
        upsert: jest.fn().mockResolvedValue({ error: null }),
      })

      // Create request
      const request = new NextRequest('http://localhost/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({
          email: 'demo@minbarai.com',
          password: 'SecurePass123',
          sessionLimitMinutes: 60,
          withSubscription: false,
          note: 'Test demo account',
        }),
      })

      // Act
      const response = await createUserRoute(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.email).toBe('demo@minbarai.com')
      expect(mockAdminClient.auth.admin.createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'demo@minbarai.com',
          password: 'SecurePass123',
          email_confirm: true,
          user_metadata: expect.objectContaining({
            demo_account: true,
            admin_note: 'Test demo account',
          }),
        })
      )
    })

    it('should create an account with full subscription', async () => {
      mockAuthClient.auth.getUser.mockResolvedValue({
        data: { user: { email: 'admin@example.com' } },
      })

      mockAdminClient.auth.admin.createUser.mockResolvedValue({
        data: { user: { id: 'new-user-456' } },
        error: null,
      })

      mockAdminClient.from.mockReturnValue({
        upsert: jest.fn().mockResolvedValue({ error: null }),
      })

      const request = new NextRequest('http://localhost/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({
          email: 'premium-demo@minbarai.com',
          password: 'SecurePass123',
          sessionLimitMinutes: 180,
          withSubscription: true,
          expiresInDays: 30,
        }),
      })

      const response = await createUserRoute(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.withSubscription).toBe(true)
      const upsertCall = mockAdminClient.from().upsert.mock.calls[0][0]
      expect(upsertCall.subscription_status).toBe('active')
      expect(upsertCall.subscription_id).toContain('sub_demo_')
    })

    it('should reject invalid email', async () => {
      mockAuthClient.auth.getUser.mockResolvedValue({
        data: { user: { email: 'admin@example.com' } },
      })

      const request = new NextRequest('http://localhost/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({
          email: 'invalid-email',
          password: 'SecurePass123',
        }),
      })

      const response = await createUserRoute(request)
      expect(response.status).toBe(400)
    })

    it('should reject short password', async () => {
      mockAuthClient.auth.getUser.mockResolvedValue({
        data: { user: { email: 'admin@example.com' } },
      })

      const request = new NextRequest('http://localhost/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({
          email: 'demo@minbarai.com',
          password: 'short',
        }),
      })

      const response = await createUserRoute(request)
      expect(response.status).toBe(400)
    })

    it('should reject unauthorized access (non-admin)', async () => {
      mockAuthClient.auth.getUser.mockResolvedValue({
        data: { user: { email: 'user@example.com' } },
      })
      ;(requireAdmin as jest.Mock).mockImplementation(() => {
        const error = new Error('Not admin')
        error.name = 'AdminAccessDeniedError'
        throw error
      })

      const request = new NextRequest('http://localhost/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({
          email: 'demo@minbarai.com',
          password: 'SecurePass123',
        }),
      })

      const response = await createUserRoute(request)
      expect(response.status).toBe(403)
    })
  })

  // =========================================================================
  // 2. Reset Usage (POST /api/admin/users/[id]/reset-usage)
  // =========================================================================

  describe('POST /api/admin/users/[id]/reset-usage', () => {
    it('should delete all usage sessions for a user', async () => {
      mockAuthClient.auth.getUser.mockResolvedValue({
        data: { user: { email: 'admin@example.com' } },
      })

      // Mock user lookup
      const userMock = createSupabaseMock()
      userMock.single.mockResolvedValue({
        data: { id: 'test-user-id', email: 'user@test.com' },
        error: null,
      })
      mockAdminClient.from.mockReturnValueOnce(userMock)

      // Mock delete usage sessions
      const deleteMock = createSupabaseMock()
      deleteMock.eq.mockResolvedValue({
        count: 5,
        error: null,
      })
      mockAdminClient.from.mockReturnValueOnce(deleteMock)

      const request = new NextRequest(
        'http://localhost/api/admin/users/test-user-id/reset-usage',
        { method: 'POST' }
      )

      const response = await resetUsageRoute(request, {
        params: mockParams,
      } as any)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.deletedCount).toBe(5)
    })

    it('should return 404 for non-existent user', async () => {
      mockAuthClient.auth.getUser.mockResolvedValue({
        data: { user: { email: 'admin@example.com' } },
      })

      const userMock = createSupabaseMock()
      userMock.single.mockResolvedValue({
        data: null,
        error: null,
      })
      mockAdminClient.from.mockReturnValue(userMock)

      const request = new NextRequest(
        'http://localhost/api/admin/users/nonexistent/reset-usage',
        { method: 'POST' }
      )

      const response = await resetUsageRoute(request, {
        params: { id: 'nonexistent' },
      } as any)

      expect(response.status).toBe(404)
    })
  })

  // =========================================================================
  // 3. Update Session Limit (PATCH /api/admin/users/[id]/session-limit)
  // =========================================================================

  describe('PATCH /api/admin/users/[id]/session-limit', () => {
    it('should update session limit minutes', async () => {
      mockAuthClient.auth.getUser.mockResolvedValue({
        data: { user: { email: 'admin@example.com' } },
      })

      // Mock user lookup
      const userMock = createSupabaseMock()
      userMock.single.mockResolvedValue({
        data: { id: 'test-user-id', email: 'user@test.com' },
        error: null,
      })
      mockAdminClient.from.mockReturnValueOnce(userMock)

      // Mock update
      const updateMock = createSupabaseMock()
      updateMock.eq.mockResolvedValue({ error: null })
      mockAdminClient.from.mockReturnValueOnce(updateMock)

      const request = new NextRequest(
        'http://localhost/api/admin/users/test-user-id/session-limit',
        {
          method: 'PATCH',
          body: JSON.stringify({ sessionLimitMinutes: 240 }),
        }
      )

      const response = await updateSessionLimitRoute(request, {
        params: mockParams,
      } as any)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.sessionLimitMinutes).toBe(240)
    })

    it('should reject limit below 10 minutes', async () => {
      mockAuthClient.auth.getUser.mockResolvedValue({
        data: { user: { email: 'admin@example.com' } },
      })

      const request = new NextRequest(
        'http://localhost/api/admin/users/test-user-id/session-limit',
        {
          method: 'PATCH',
          body: JSON.stringify({ sessionLimitMinutes: 5 }),
        }
      )

      const response = await updateSessionLimitRoute(request, {
        params: mockParams,
      } as any)

      expect(response.status).toBe(400)
    })

    it('should reject limit above 10080 minutes (1 week)', async () => {
      mockAuthClient.auth.getUser.mockResolvedValue({
        data: { user: { email: 'admin@example.com' } },
      })

      const request = new NextRequest(
        'http://localhost/api/admin/users/test-user-id/session-limit',
        {
          method: 'PATCH',
          body: JSON.stringify({ sessionLimitMinutes: 20000 }),
        }
      )

      const response = await updateSessionLimitRoute(request, {
        params: mockParams,
      } as any)

      expect(response.status).toBe(400)
    })
  })

  // =========================================================================
  // 4. Bulk Seed Accounts (POST /api/admin/marketing/bulk-seed)
  // =========================================================================

  describe('POST /api/admin/marketing/bulk-seed', () => {
    it('should create multiple demo accounts with incrementing emails', async () => {
      mockAuthClient.auth.getUser.mockResolvedValue({
        data: { user: { email: 'admin@example.com' } },
      })

      // Mock createUser for 3 calls - always succeeds
      const createUserMock = jest.fn()
      createUserMock
        .mockResolvedValueOnce({
          data: { user: { id: 'bulk-user-1' } },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { user: { id: 'bulk-user-2' } },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { user: { id: 'bulk-user-3' } },
          error: null,
        })
      mockAdminClient.auth.admin.createUser = createUserMock

      // Mock upsert to always succeed
      const upsertMock = jest.fn().mockResolvedValue({ error: null })
      mockAdminClient.from.mockImplementation(() => ({
        upsert: upsertMock,
        select: jest.fn().mockReturnThis(),
        delete: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn(),
      }))

      const request = new NextRequest(
        'http://localhost/api/admin/marketing/bulk-seed',
        {
          method: 'POST',
          body: JSON.stringify({
            count: 3,
            emailPrefix: 'demo',
            emailDomain: 'test.com',
            password: 'BulkPass123',
            sessionLimitMinutes: 120,
            withSubscription: false,
          }),
        }
      )

      const response = await bulkSeedRoute(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.created).toBe(3)
      expect(createUserMock).toHaveBeenCalledTimes(3)
    })

    it('should reject count > 50', async () => {
      mockAuthClient.auth.getUser.mockResolvedValue({
        data: { user: { email: 'admin@example.com' } },
      })

      const request = new NextRequest(
        'http://localhost/api/admin/marketing/bulk-seed',
        {
          method: 'POST',
          body: JSON.stringify({
            count: 100,
            emailPrefix: 'demo',
            emailDomain: 'test.com',
            password: 'BulkPass123',
          }),
        }
      )

      const response = await bulkSeedRoute(request)
      expect(response.status).toBe(400)
    })

    it('should track failed account creations', async () => {
      mockAuthClient.auth.getUser.mockResolvedValue({
        data: { user: { email: 'admin@example.com' } },
      })

      // First call succeeds, second fails
      const createUserMock = jest.fn()
      createUserMock
        .mockResolvedValueOnce({
          data: { user: { id: 'user-1' } },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { user: null },
          error: { message: 'User already exists' },
        })
      mockAdminClient.auth.admin.createUser = createUserMock

      // Mock upsert
      const upsertMock = jest.fn().mockResolvedValue({ error: null })
      mockAdminClient.from.mockImplementation(() => ({
        upsert: upsertMock,
        select: jest.fn().mockReturnThis(),
        delete: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn(),
      }))

      const request = new NextRequest(
        'http://localhost/api/admin/marketing/bulk-seed',
        {
          method: 'POST',
          body: JSON.stringify({
            count: 2,
            emailPrefix: 'demo',
            emailDomain: 'test.com',
            password: 'BulkPass123',
          }),
        }
      )

      const response = await bulkSeedRoute(request)
      const data = await response.json()

      expect(data.created).toBe(1)
      expect(data.failed).toBe(1)
    })
  })
})
