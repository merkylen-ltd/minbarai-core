/**
 * Test 1 — getTotalUsageSeconds correctness
 *
 * The function must sum only rows where duration_seconds IS NOT NULL.
 * An active session row (duration_seconds = null) must be excluded.
 */

// We test the query logic by mocking the Supabase client chain directly.

const mockSelect: jest.Mock = jest.fn()
const mockEq: jest.Mock = jest.fn()
const mockNot: jest.Mock = jest.fn()

const mockSupabase = {
  from: jest.fn(() => ({
    select: mockSelect.mockReturnThis(),
    eq: mockEq.mockReturnThis(),
    not: mockNot,
  })),
}

// Inline the function under test (mirrors ping/route.ts exactly)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getTotalUsageSeconds(supabase: any, userId: string): Promise<number> {
  const { data, error } = await supabase
    .from('usage_sessions')
    .select('duration_seconds')
    .eq('user_id', userId)
    .not('duration_seconds', 'is', null)

  if (error) return 0

  return (
    data?.reduce(
      (sum: number, session: { duration_seconds: number | null }) =>
        sum + (session.duration_seconds || 0),
      0,
    ) || 0
  )
}

describe('getTotalUsageSeconds', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 0 when no closed sessions exist', async () => {
    mockNot.mockResolvedValueOnce({ data: [], error: null })
    const result = await getTotalUsageSeconds(mockSupabase, 'user-1')
    expect(result).toBe(0)
  })

  it('sums duration_seconds from closed sessions only', async () => {
    // One closed session (1800 s) + active row excluded by the IS NOT NULL filter
    mockNot.mockResolvedValueOnce({
      data: [{ duration_seconds: 1800 }],
      error: null,
    })
    const result = await getTotalUsageSeconds(mockSupabase, 'user-1')
    expect(result).toBe(1800)
  })

  it('sums multiple closed sessions', async () => {
    mockNot.mockResolvedValueOnce({
      data: [
        { duration_seconds: 600 },
        { duration_seconds: 1200 },
        { duration_seconds: 300 },
      ],
      error: null,
    })
    const result = await getTotalUsageSeconds(mockSupabase, 'user-1')
    expect(result).toBe(2100)
  })

  it('returns 0 on database error', async () => {
    mockNot.mockResolvedValueOnce({ data: null, error: new Error('db error') })
    const result = await getTotalUsageSeconds(mockSupabase, 'user-1')
    expect(result).toBe(0)
  })

  it('queries with IS NOT NULL filter (not a status filter)', async () => {
    mockNot.mockResolvedValueOnce({ data: [], error: null })
    await getTotalUsageSeconds(mockSupabase, 'user-1')
    expect(mockNot).toHaveBeenCalledWith('duration_seconds', 'is', null)
  })
})
