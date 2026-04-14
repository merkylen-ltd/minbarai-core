/**
 * Regression guard for RC-T1:
 * Module-level deduplication Sets must reset between sessions.
 *
 * Without resetValidationState(), IDs and content hashes from a previous
 * session accumulate and silently reject valid translations in subsequent
 * sessions (VoiceFlow resets its translationId counter each session).
 */

import {
  validateTranslation,
  resetValidationState,
} from '@/components/dashboard/live-captioning/utils/speech-recognition'

beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {})
  jest.spyOn(console, 'log').mockImplementation(() => {})
  // Always reset between tests so module-level Sets don't bleed across cases
  resetValidationState()
})

afterEach(() => {
  jest.restoreAllMocks()
  resetValidationState()
})

describe('validateTranslation — deduplication by ID', () => {
  it('accepts a translation with a new translationId', () => {
    const result = validateTranslation('Peace be upon you', 1001)
    expect(result).toBe('Peace be upon you')
  })

  it('rejects the same translationId within the same session', () => {
    validateTranslation('Peace be upon you', 1002)
    const result = validateTranslation('Different text entirely', 1002)
    expect(result).toBeNull()
  })

  it('accepts a previously-seen translationId after resetValidationState()', () => {
    // VoiceFlow resets its counter each session — ID 1 will appear again
    validateTranslation('In the name of God', 1)
    resetValidationState()
    const result = validateTranslation('In the name of God', 1)
    expect(result).toBe('In the name of God')
  })

  it('accepts a different phrase with the same previously-used ID after reset', () => {
    validateTranslation('First session phrase', 42)
    resetValidationState()
    const result = validateTranslation('Second session phrase', 42)
    expect(result).toBe('Second session phrase')
  })
})

describe('validateTranslation — deduplication by content hash', () => {
  it('rejects repeated content within the same session (even with different IDs)', () => {
    validateTranslation('All praise is due to God', 2001)
    // Different ID, same content — content hash fires
    const result = validateTranslation('All praise is due to God', 2002)
    expect(result).toBeNull()
  })

  it('accepts repeated content after resetValidationState()', () => {
    validateTranslation('All praise is due to God', 3001)
    resetValidationState()
    // New session: same common phrase must be accepted
    const result = validateTranslation('All praise is due to God', 3002)
    expect(result).toBe('All praise is due to God')
  })

  it('accepts the same text without an ID after reset (hash-only dedup path)', () => {
    validateTranslation('God is great')  // no ID — hash-only path
    const blockedResult = validateTranslation('God is great')
    expect(blockedResult).toBeNull()

    resetValidationState()
    const afterReset = validateTranslation('God is great')
    expect(afterReset).toBe('God is great')
  })
})

describe('validateTranslation — unrelated rules survive reset', () => {
  it('still rejects empty string after reset', () => {
    resetValidationState()
    expect(validateTranslation('')).toBeNull()
  })

  it('still rejects whitespace-only string after reset', () => {
    resetValidationState()
    expect(validateTranslation('   ')).toBeNull()
  })

  it('still accepts a fresh unique translation after reset', () => {
    resetValidationState()
    const result = validateTranslation('A completely unique phrase that was never seen', 9999)
    expect(result).toBe('A completely unique phrase that was never seen')
  })
})
