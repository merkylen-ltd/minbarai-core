/**
 * @jest-environment node
 */
/**
 * Regression guard for the /api/prompts route's fallback chain.
 *
 * Verifies that:
 *  1. Non-Arabic source always routes to any_source_to_any/ folder.
 *  2. Arabic source routes to ar_source_to/ folder.
 *  3. Arabic source + unknown target falls back to otherlang/.
 *  4. An in-TTL second request is served from cache without re-reading the file.
 *
 * Uses unique language pairs per test to avoid cross-test cache interference
 * (the promptCache Map is module-level and not reset between tests).
 */

import { GET } from '@/app/api/prompts/route'

jest.mock('fs', () => ({
  readFileSync: jest.fn(),
  existsSync: jest.fn(),
}))

// Require after the mock is in place so it picks up the mock
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fsMock = require('fs') as { readFileSync: jest.Mock; existsSync: jest.Mock }

beforeEach(() => {
  jest.clearAllMocks()
})

function makeRequest(source: string, target: string, variant = 'normal'): Request {
  return new Request(
    `http://localhost/api/prompts?source=${encodeURIComponent(source)}&target=${encodeURIComponent(target)}&variant=${variant}`
  )
}

describe('/api/prompts — source-language routing', () => {
  it('routes non-Arabic source to any_source_to_any folder', async () => {
    fsMock.existsSync.mockReturnValue(true)
    fsMock.readFileSync.mockReturnValue('prompt for {targetLanguage} from {sourceLanguage}')

    const response = await GET(makeRequest('English', 'German', 'normal'))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.prompt).toContain('German')
    expect(fsMock.readFileSync).toHaveBeenCalledWith(
      expect.stringContaining('any_source_to_any'),
      'utf-8'
    )
    // Must NOT route into the Arabic-specific folder
    expect(fsMock.readFileSync).not.toHaveBeenCalledWith(
      expect.stringContaining('ar_source_to'),
      'utf-8'
    )
  })

  it('routes Arabic source to ar_source_to folder', async () => {
    fsMock.existsSync.mockReturnValue(true)
    fsMock.readFileSync.mockReturnValue('arabic prompt for {targetLanguage}')

    const response = await GET(makeRequest('Arabic', 'Turkish', 'normal'))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.prompt).toContain('Turkish')
    expect(fsMock.readFileSync).toHaveBeenCalledWith(
      expect.stringContaining('ar_source_to'),
      'utf-8'
    )
  })

  it('falls back to otherlang folder for Arabic source + unrecognised target', async () => {
    fsMock.existsSync.mockReturnValue(true)
    fsMock.readFileSync.mockReturnValue('otherlang prompt for {targetLanguage}')

    // 'Swahili' is not in the folder mapping so it resolves to 'otherlang'
    const response = await GET(makeRequest('Arabic', 'Swahili', 'normal'))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(fsMock.readFileSync).toHaveBeenCalledWith(
      expect.stringContaining('otherlang'),
      'utf-8'
    )
  })
})

describe('/api/prompts — prompt cache', () => {
  it('serves a second identical request from cache without re-reading the file', async () => {
    fsMock.existsSync.mockReturnValue(true)
    fsMock.readFileSync.mockReturnValue('cached prompt content for {targetLanguage}')

    // Use a unique pair so previous tests do not interfere
    const req1 = makeRequest('French', 'Spanish', 'normal')
    await GET(req1)

    const req2 = makeRequest('French', 'Spanish', 'normal')
    await GET(req2)

    // readFileSync must be called exactly once — second request hits cache
    expect(fsMock.readFileSync).toHaveBeenCalledTimes(1)
  })
})
