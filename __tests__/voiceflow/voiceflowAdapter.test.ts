/**
 * @jest-environment node
 *
 * VoiceFlowAdapter — unit tests
 *
 * The adapter is a thin wrapper around VoiceFlowRecognition that provides a
 * WebSpeech-compatible interface and forwards all events. Tests verify:
 *   - Constructor wires up VoiceFlowRecognition with correct config
 *   - setLanguage() keeps adapter.lang and recognition.lang in sync
 *   - setTranslationConfig() sets recognition.voiceFlow.translation
 *   - All event forwarding handlers (onstart, onend, onerror, onresult,
 *     onaudioend, onspeechstart, onspeechend, ontranslation, oninfo)
 */

// ── Mock WebSocket global (must be before imports) ────────────────────────────
// The adapter module imports VoiceFlowRecognition which references WebSocket
// as a global — we stub it so the import succeeds in the Node environment.

class MockWebSocket {
  static OPEN = 1
  static CONNECTING = 0
  static CLOSING = 2
  static CLOSED = 3

  readyState = MockWebSocket.OPEN
  binaryType = 'blob'
  onopen: any = null
  onmessage: any = null
  onerror: any = null
  onclose: any = null
  send = jest.fn()
  close = jest.fn()

  constructor(public url: string, public protocols?: string[]) {}
}

;(global as any).WebSocket = MockWebSocket

// ── Imports ───────────────────────────────────────────────────────────────────

import { VoiceFlowAdapter } from '@/lib/voiceflow/adapter'

// ── Helpers ───────────────────────────────────────────────────────────────────

const TEST_CONFIG = { url: 'ws://test.example.com', token: 'test-token' }

function makeAdapter(extras?: object): VoiceFlowAdapter {
  return new VoiceFlowAdapter(TEST_CONFIG, extras as any)
}

/** Access the private VoiceFlowRecognition instance inside the adapter */
function getRecognition(adapter: VoiceFlowAdapter): any {
  return (adapter as any).recognition
}

// ── Constructor ───────────────────────────────────────────────────────────────

describe('VoiceFlowAdapter — constructor', () => {
  it('creates a VoiceFlowRecognition with the config url', () => {
    const adapter = makeAdapter()
    const rec = getRecognition(adapter)
    expect((rec as any).url).toBe('ws://test.example.com')
  })

  it('passes the token from config into voiceFlow', () => {
    const adapter = makeAdapter()
    const rec = getRecognition(adapter)
    expect(rec.voiceFlow.token).toBe('test-token')
  })

  it('applies default settings (model, captureMode, etc.)', () => {
    const adapter = makeAdapter()
    const rec = getRecognition(adapter)
    expect(rec.voiceFlow.model).toBe('latest_long')
    expect(rec.voiceFlow.captureMode).toBe('auto')
    expect(rec.voiceFlow.wordTimeOffsets).toBe(true)
    expect(rec.voiceFlow.spokenPunctuation).toBe(true)
  })

  it('extras override the defaults', () => {
    const adapter = makeAdapter({ captureMode: 'PCM16', model: 'phone_call' })
    const rec = getRecognition(adapter)
    expect(rec.voiceFlow.captureMode).toBe('PCM16')
    expect(rec.voiceFlow.model).toBe('phone_call')
  })

  it('defaults adapter.lang to en-US', () => {
    const adapter = makeAdapter()
    expect(adapter.lang).toBe('en-US')
  })
})

// ── setLanguage() ─────────────────────────────────────────────────────────────

describe('VoiceFlowAdapter — setLanguage()', () => {
  it('updates adapter.lang', () => {
    const adapter = makeAdapter()
    adapter.setLanguage('ar-SA')
    expect(adapter.lang).toBe('ar-SA')
  })

  it('updates recognition.lang in sync', () => {
    const adapter = makeAdapter()
    adapter.setLanguage('ar-SA')
    const rec = getRecognition(adapter)
    expect(rec.lang).toBe('ar-SA')
  })

  it('keeps both in sync after multiple calls', () => {
    const adapter = makeAdapter()
    adapter.setLanguage('de-DE')
    adapter.setLanguage('fr-FR')
    const rec = getRecognition(adapter)
    expect(adapter.lang).toBe('fr-FR')
    expect(rec.lang).toBe('fr-FR')
  })
})

// ── setTranslationConfig() ────────────────────────────────────────────────────

describe('VoiceFlowAdapter — setTranslationConfig()', () => {
  it('sets recognition.voiceFlow.translation with enabled=true', () => {
    const adapter = makeAdapter()
    adapter.setTranslationConfig({
      prompt: 'Translate from Arabic to German',
      sourceLanguage: 'ar',
      targetLanguage: 'de',
    })
    const rec = getRecognition(adapter)
    expect(rec.voiceFlow.translation).toMatchObject({
      enabled: true,
      sourceLanguage: 'ar',
      targetLanguage: 'de',
      prompt: 'Translate from Arabic to German',
    })
  })

  it('includes geminiModelConfig when provided', () => {
    const adapter = makeAdapter()
    adapter.setTranslationConfig({
      prompt: 'p',
      sourceLanguage: 'ar',
      targetLanguage: 'de',
      geminiModelConfig: { model: 'gemini-1.5-pro', temperature: 0.1 },
    })
    const rec = getRecognition(adapter)
    expect(rec.voiceFlow.translation?.geminiModelConfig).toMatchObject({
      model: 'gemini-1.5-pro',
      temperature: 0.1,
    })
  })

  it('overwrites a previous config', () => {
    const adapter = makeAdapter()
    adapter.setTranslationConfig({ prompt: 'first', sourceLanguage: 'ar', targetLanguage: 'de' })
    adapter.setTranslationConfig({ prompt: 'second', sourceLanguage: 'ar', targetLanguage: 'fr' })
    const rec = getRecognition(adapter)
    expect(rec.voiceFlow.translation?.targetLanguage).toBe('fr')
    expect(rec.voiceFlow.translation?.prompt).toBe('second')
  })
})

// ── Event forwarding ──────────────────────────────────────────────────────────

describe('VoiceFlowAdapter — event forwarding', () => {
  it('forwards onstart', () => {
    const adapter = makeAdapter()
    const onstart = jest.fn()
    adapter.onstart = onstart
    const rec = getRecognition(adapter)
    rec.onstart?.(new Event('start'))
    expect(onstart).toHaveBeenCalledTimes(1)
  })

  it('does not fire adapter.onstart when handler is null', () => {
    const adapter = makeAdapter()
    const rec = getRecognition(adapter)
    expect(() => rec.onstart?.(new Event('start'))).not.toThrow()
  })

  it('forwards onend', () => {
    const adapter = makeAdapter()
    const onend = jest.fn()
    adapter.onend = onend
    const rec = getRecognition(adapter)
    rec.onend?.(new Event('end'))
    expect(onend).toHaveBeenCalledTimes(1)
  })

  it('forwards onerror with error and message fields', () => {
    const adapter = makeAdapter()
    const onerror = jest.fn()
    adapter.onerror = onerror
    const rec = getRecognition(adapter)
    const fakeEv: any = new Event('error')
    fakeEv.error = 'network'
    fakeEv.message = 'connection lost'
    rec.onerror?.(fakeEv)
    expect(onerror).toHaveBeenCalledTimes(1)
    const forwarded = onerror.mock.calls[0][0]
    expect(forwarded.error).toBe('network')
    expect(forwarded.message).toBe('connection lost')
  })

  it('forwards onresult with resultIndex and results', () => {
    const adapter = makeAdapter()
    const onresult = jest.fn()
    adapter.onresult = onresult
    const rec = getRecognition(adapter)
    const fakeEv: any = new Event('result')
    fakeEv.resultIndex = 2
    fakeEv.results = [{ isFinal: false, 0: { transcript: 'hi' }, length: 1 }]
    rec.onresult?.(fakeEv)
    expect(onresult).toHaveBeenCalledTimes(1)
    const forwarded = onresult.mock.calls[0][0]
    expect(forwarded.resultIndex).toBe(2)
    expect(forwarded.results).toBe(fakeEv.results)
  })

  it('forwards onaudioend', () => {
    const adapter = makeAdapter()
    const onaudioend = jest.fn()
    adapter.onaudioend = onaudioend
    const rec = getRecognition(adapter)
    rec.onaudioend?.(new Event('audioend'))
    expect(onaudioend).toHaveBeenCalledTimes(1)
  })

  it('forwards onspeechstart', () => {
    const adapter = makeAdapter()
    const onspeechstart = jest.fn()
    adapter.onspeechstart = onspeechstart
    const rec = getRecognition(adapter)
    rec.onspeechstart?.(new Event('speechstart'))
    expect(onspeechstart).toHaveBeenCalledTimes(1)
  })

  it('forwards onspeechend', () => {
    const adapter = makeAdapter()
    const onspeechend = jest.fn()
    adapter.onspeechend = onspeechend
    const rec = getRecognition(adapter)
    rec.onspeechend?.(new Event('speechend'))
    expect(onspeechend).toHaveBeenCalledTimes(1)
  })

  it('forwards ontranslation', () => {
    const adapter = makeAdapter()
    const ontranslation = jest.fn()
    adapter.ontranslation = ontranslation
    const rec = getRecognition(adapter)
    const fakeEv: any = new Event('translation')
    fakeEv.translated = 'Hallo'
    fakeEv.sourceLanguage = 'ar'
    rec.ontranslation?.(fakeEv)
    expect(ontranslation).toHaveBeenCalledTimes(1)
    expect(ontranslation.mock.calls[0][0].translated).toBe('Hallo')
  })

  it('forwards oninfo', () => {
    const adapter = makeAdapter()
    const oninfo = jest.fn()
    adapter.oninfo = oninfo
    const rec = getRecognition(adapter)
    const fakeEv: any = new Event('info')
    fakeEv.messageType = 'ready'
    rec.oninfo?.(fakeEv)
    expect(oninfo).toHaveBeenCalledTimes(1)
    expect(oninfo.mock.calls[0][0].messageType).toBe('ready')
  })
})
