/**
 * Sample test file to verify Jest setup
 * This file can be removed once real tests are added
 */

describe('Jest Setup', () => {
  it('should run basic tests', () => {
    expect(1 + 1).toBe(2)
  })

  it('should have access to testing utilities', () => {
    expect(typeof expect).toBe('function')
    expect(typeof describe).toBe('function')
    expect(typeof it).toBe('function')
  })

  it('should have environment variables mocked', () => {
    expect(process.env.NEXT_PUBLIC_SUPABASE_URL).toBe('https://test.supabase.co')
    expect(process.env.NEXT_PUBLIC_SITE_URL).toBe('https://test.minbarai.com')
  })
})
