/**
 * @jest-environment node
 *
 * VoiceFlowRecognition — unit tests
 *
 * Strategy: inject a mock WebSocket directly onto the instance via (r as any).ws
 * to exercise all logic that doesn't require browser APIs. The browser-only paths
 * (start(), handleOpen(), startPCM(), startOpus(), checkMicrophonePermission())
 * are excluded — they depend on navigator, AudioContext, and MediaDevices.
 *
 * For reconnection tests, start() is called but onopen is never triggered, so
 * handleOpen() never runs. onclose is then triggered manually to exercise the
 * reconnection guard logic.
 */

// ── Mock WebSocket global (must be before imports) ────────────────────────────

const mockSend = jest.fn()
const mockClose = jest.fn()
let capturedMockWs: any = null

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
  send = mockSend
  close = mockClose

  constructor(public url: string, public protocols?: string[]) {
    capturedMockWs = this
  }
}

;(global as any).WebSocket = MockWebSocket

// ── Imports ───────────────────────────────────────────────────────────────────

import { VoiceFlowRecognition } from '@/lib/voiceflow/client'

// ── Helpers ───────────────────────────────────────────────────────────────────

function make(extras?: object): VoiceFlowRecognition {
  return new VoiceFlowRecognition('ws://test.example.com', extras as any)
}

function injectWs(r: VoiceFlowRecognition, state = MockWebSocket.OPEN) {
  const ws = new MockWebSocket('ws://test.example.com')
  ws.readyState = state
  ;(r as any).ws = ws
  return ws
}

function dispatchMessage(r: VoiceFlowRecognition, msg: object) {
  ;(r as any).handleMessage({ data: JSON.stringify(msg) })
}

// ── Setup/teardown ────────────────────────────────────────────────────────────

beforeEach(() => {
  mockSend.mockClear()
  mockClose.mockClear()
  capturedMockWs = null
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

// ── Constructor ───────────────────────────────────────────────────────────────

describe('VoiceFlowRecognition — constructor', () => {
  it('stores the ws url', () => {
    const r = make()
    expect((r as any).url).toBe('ws://test.example.com')
  })

  it('merges extras into voiceFlow', () => {
    const r = make({ token: 'tok123', model: 'latest_long', captureMode: 'PCM16' })
    expect(r.voiceFlow.token).toBe('tok123')
    expect(r.voiceFlow.model).toBe('latest_long')
    expect(r.voiceFlow.captureMode).toBe('PCM16')
  })

  it('starts with empty voiceFlow when no extras provided', () => {
    const r = make()
    expect(r.voiceFlow).toEqual({})
  })

  it('sets default lang to en-US', () => {
    const r = make()
    expect(r.lang).toBe('en-US')
  })
})

// ── setLanguage() ─────────────────────────────────────────────────────────────

describe('VoiceFlowRecognition — setLanguage()', () => {
  it('updates this.lang', () => {
    const r = make()
    r.setLanguage('ar-SA')
    expect(r.lang).toBe('ar-SA')
  })

  it('can be called multiple times', () => {
    const r = make()
    r.setLanguage('de-DE')
    r.setLanguage('fr-FR')
    expect(r.lang).toBe('fr-FR')
  })
})

// ── Translation config — no active WS ────────────────────────────────────────

describe('VoiceFlowRecognition — translation config (no WS)', () => {
  it('enableTranslation stores config without sending', () => {
    const r = make()
    r.enableTranslation({ prompt: 'Translate sermon', targetLanguage: 'de', sourceLanguage: 'ar' })
    expect(r.voiceFlow.translation).toMatchObject({
      enabled: true,
      targetLanguage: 'de',
      sourceLanguage: 'ar',
      prompt: 'Translate sermon',
    })
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('disableTranslation is a no-op when translation not configured', () => {
    const r = make()
    expect(() => r.disableTranslation()).not.toThrow()
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('disableTranslation sets enabled=false without sending when WS absent', () => {
    const r = make()
    r.enableTranslation({ prompt: 'p', targetLanguage: 'de', sourceLanguage: 'ar' })
    mockSend.mockClear()
    r.disableTranslation()
    expect(r.voiceFlow.translation?.enabled).toBe(false)
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('setTranslationPrompt is a no-op when translation not configured', () => {
    const r = make()
    expect(() => r.setTranslationPrompt('new prompt')).not.toThrow()
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('setGeminiConfig is a no-op when translation not configured', () => {
    const r = make()
    expect(() => r.setGeminiConfig({ model: 'gemini-pro' })).not.toThrow()
    expect(mockSend).not.toHaveBeenCalled()
  })
})

// ── Translation config — WS open ──────────────────────────────────────────────

describe('VoiceFlowRecognition — translation config (WS open)', () => {
  it('enableTranslation sends translation config via WS', () => {
    const r = make()
    injectWs(r, MockWebSocket.OPEN)
    r.enableTranslation({ prompt: 'Translate', targetLanguage: 'de', sourceLanguage: 'ar' })
    expect(mockSend).toHaveBeenCalledTimes(1)
    const sent = JSON.parse(mockSend.mock.calls[0][0])
    expect(sent.translationEnabled).toBe(true)
    expect(sent.targetLanguage).toBe('de')
    expect(sent.sourceLanguage).toBe('ar')
  })

  it('disableTranslation sends disabled config via WS', () => {
    const r = make()
    injectWs(r, MockWebSocket.OPEN)
    r.enableTranslation({ prompt: 'p', targetLanguage: 'de', sourceLanguage: 'ar' })
    mockSend.mockClear()
    r.disableTranslation()
    expect(mockSend).toHaveBeenCalledTimes(1)
    const sent = JSON.parse(mockSend.mock.calls[0][0])
    expect(sent.translationEnabled).toBe(false)
  })

  it('setTranslationPrompt sends updated prompt via WS', () => {
    const r = make()
    injectWs(r, MockWebSocket.OPEN)
    r.enableTranslation({ prompt: 'old prompt', targetLanguage: 'de', sourceLanguage: 'ar' })
    mockSend.mockClear()
    r.setTranslationPrompt('new prompt')
    expect(mockSend).toHaveBeenCalledTimes(1)
    const sent = JSON.parse(mockSend.mock.calls[0][0])
    expect(sent.translationPrompt).toBe('new prompt')
  })

  it('setGeminiConfig sends updated gemini config via WS', () => {
    const r = make()
    injectWs(r, MockWebSocket.OPEN)
    r.enableTranslation({ prompt: 'p', targetLanguage: 'de', sourceLanguage: 'ar' })
    mockSend.mockClear()
    r.setGeminiConfig({ model: 'gemini-1.5-pro', temperature: 0.2 })
    expect(mockSend).toHaveBeenCalledTimes(1)
    const sent = JSON.parse(mockSend.mock.calls[0][0])
    expect(sent.geminiModelConfig).toMatchObject({ model: 'gemini-1.5-pro', temperature: 0.2 })
  })

  it('does NOT send when WS is not OPEN', () => {
    const r = make()
    injectWs(r, MockWebSocket.CONNECTING)
    r.enableTranslation({ prompt: 'p', targetLanguage: 'de', sourceLanguage: 'ar' })
    expect(mockSend).not.toHaveBeenCalled()
  })
})

// ── stop() ────────────────────────────────────────────────────────────────────

describe('VoiceFlowRecognition — stop()', () => {
  it('sends {type:"stop"} when WS is OPEN', () => {
    const r = make()
    injectWs(r, MockWebSocket.OPEN)
    r.stop()
    const stopCall = mockSend.mock.calls.find(c => {
      try { return JSON.parse(c[0]).type === 'stop' } catch { return false }
    })
    expect(stopCall).toBeDefined()
  })

  it('does NOT send {type:"stop"} when WS is not OPEN', () => {
    const r = make()
    injectWs(r, MockWebSocket.CONNECTING)
    r.stop()
    const stopCall = mockSend.mock.calls.find(c => {
      try { return JSON.parse(c[0]).type === 'stop' } catch { return false }
    })
    expect(stopCall).toBeUndefined()
  })

  it('closes the WS connection', () => {
    const r = make()
    injectWs(r)
    r.stop()
    expect(mockClose).toHaveBeenCalled()
  })

  it('fires onaudioend then onend in order', () => {
    const r = make()
    injectWs(r)
    const order: string[] = []
    r.onaudioend = () => order.push('audioend')
    r.onend = () => order.push('end')
    r.stop()
    expect(order).toEqual(['audioend', 'end'])
  })

  it('sets userStopped = true so subsequent messages are ignored', () => {
    const r = make()
    injectWs(r)
    r.stop()
    expect((r as any).userStopped).toBe(true)
  })
})

// ── abort() ───────────────────────────────────────────────────────────────────

describe('VoiceFlowRecognition — abort()', () => {
  it('sets userStopped = true', () => {
    const r = make()
    r.abort()
    expect((r as any).userStopped).toBe(true)
  })

  it('fires onaudioend then onend in order', () => {
    const r = make()
    injectWs(r)
    const order: string[] = []
    r.onaudioend = () => order.push('audioend')
    r.onend = () => order.push('end')
    r.abort()
    expect(order).toEqual(['audioend', 'end'])
  })

  it('fires onend even without a WS', () => {
    const r = make()
    const onend = jest.fn()
    r.onend = onend
    r.abort()
    expect(onend).toHaveBeenCalledTimes(1)
  })
})

// ── handleMessage() — transcript ─────────────────────────────────────────────

describe('VoiceFlowRecognition — handleMessage() transcript', () => {
  it('fires onresult for non-final transcript', () => {
    const r = make()
    const onresult = jest.fn()
    r.onresult = onresult
    dispatchMessage(r, { type: 'transcript', transcript: 'hello', isFinal: false })
    expect(onresult).toHaveBeenCalledTimes(1)
    const evt = onresult.mock.calls[0][0]
    expect(evt.results[0][0].transcript).toBe('hello')
    expect(evt.results[0].isFinal).toBe(false)
  })

  it('fires onresult for final transcript with isFinal=true', () => {
    const r = make()
    const onresult = jest.fn()
    r.onresult = onresult
    dispatchMessage(r, { type: 'transcript', transcript: 'hello world', isFinal: true })
    expect(onresult).toHaveBeenCalledTimes(1)
    const evt = onresult.mock.calls[0][0]
    expect(evt.results[0].isFinal).toBe(true)
    expect(evt.results[0][0].transcript).toBe('hello world')
  })

  it('carries confidence when provided', () => {
    const r = make()
    const onresult = jest.fn()
    r.onresult = onresult
    dispatchMessage(r, { type: 'transcript', transcript: 'test', isFinal: true, confidence: 0.97 })
    const evt = onresult.mock.calls[0][0]
    expect(evt.results[0][0].confidence).toBe(0.97)
  })

  it('ignores non-transcript type messages', () => {
    const r = make()
    const onresult = jest.fn()
    r.onresult = onresult
    dispatchMessage(r, { type: 'ping' })
    expect(onresult).not.toHaveBeenCalled()
  })
})

// ── handleMessage() — translation ────────────────────────────────────────────

describe('VoiceFlowRecognition — handleMessage() translation', () => {
  it('fires ontranslation with all expected fields', () => {
    const r = make()
    const ontranslation = jest.fn()
    r.ontranslation = ontranslation
    dispatchMessage(r, {
      type: 'translation',
      original: 'مرحبا',
      translated: 'Hallo',
      sourceLanguage: 'ar',
      targetLanguage: 'de',
      translationId: 7,
      timestamp: 1234567890,
    })
    expect(ontranslation).toHaveBeenCalledTimes(1)
    const evt = ontranslation.mock.calls[0][0]
    expect(evt.original).toBe('مرحبا')
    expect(evt.translated).toBe('Hallo')
    expect(evt.sourceLanguage).toBe('ar')
    expect(evt.targetLanguage).toBe('de')
    expect(evt.translationId).toBe(7)
    expect(evt.timestamp).toBe(1234567890)
  })

  it('does not fire onresult for translation messages', () => {
    const r = make()
    const onresult = jest.fn()
    r.onresult = onresult
    dispatchMessage(r, {
      type: 'translation',
      original: 'x',
      translated: 'y',
      sourceLanguage: 'ar',
      targetLanguage: 'de',
    })
    expect(onresult).not.toHaveBeenCalled()
  })
})

// ── handleMessage() — error ───────────────────────────────────────────────────

describe('VoiceFlowRecognition — handleMessage() error', () => {
  it('fires onerror with service error name and message', () => {
    const r = make()
    const onerror = jest.fn()
    r.onerror = onerror
    dispatchMessage(r, { type: 'error', err: 'some_error_code' })
    expect(onerror).toHaveBeenCalledTimes(1)
    const evt = onerror.mock.calls[0][0]
    expect(evt.error).toBe('service')
    expect(evt.message).toBe('some_error_code')
  })

  it('falls back to message field if err is absent', () => {
    const r = make()
    const onerror = jest.fn()
    r.onerror = onerror
    dispatchMessage(r, { type: 'error', message: 'fallback_msg' })
    const evt = onerror.mock.calls[0][0]
    expect(evt.message).toBe('fallback_msg')
  })
})

// ── handleMessage() — info/ready/stopped ────────────────────────────────────

describe('VoiceFlowRecognition — handleMessage() info messages', () => {
  it.each(['info', 'ready', 'stopped'])('fires oninfo for type "%s"', (type) => {
    const r = make()
    const oninfo = jest.fn()
    r.oninfo = oninfo
    dispatchMessage(r, { type, detail: 'stream-rotation' })
    expect(oninfo).toHaveBeenCalledTimes(1)
    const evt = oninfo.mock.calls[0][0]
    expect(evt.messageType).toBe(type)
  })

  it('does not fire onresult for info messages', () => {
    const r = make()
    const onresult = jest.fn()
    r.onresult = onresult
    dispatchMessage(r, { type: 'ready' })
    expect(onresult).not.toHaveBeenCalled()
  })
})

// ── userStopped guard ────────────────────────────────────────────────────────

describe('VoiceFlowRecognition — userStopped guard', () => {
  it('ignores transcript messages after stop()', () => {
    const r = make()
    injectWs(r)
    const onresult = jest.fn()
    r.onresult = onresult
    r.stop()
    dispatchMessage(r, { type: 'transcript', transcript: 'hello', isFinal: false })
    expect(onresult).not.toHaveBeenCalled()
  })

  it('ignores translation messages after stop()', () => {
    const r = make()
    injectWs(r)
    const ontranslation = jest.fn()
    r.ontranslation = ontranslation
    r.stop()
    dispatchMessage(r, {
      type: 'translation',
      original: 'x',
      translated: 'y',
      sourceLanguage: 'ar',
      targetLanguage: 'de',
    })
    expect(ontranslation).not.toHaveBeenCalled()
  })

  it('ignores all messages after abort()', () => {
    const r = make()
    const onresult = jest.fn()
    const ontranslation = jest.fn()
    r.onresult = onresult
    r.ontranslation = ontranslation
    r.abort()
    dispatchMessage(r, { type: 'transcript', transcript: 'hello', isFinal: false })
    dispatchMessage(r, { type: 'translation', original: 'x', translated: 'y', sourceLanguage: 'ar', targetLanguage: 'de' })
    expect(onresult).not.toHaveBeenCalled()
    expect(ontranslation).not.toHaveBeenCalled()
  })
})

// ── Speech state transitions ──────────────────────────────────────────────────

describe('VoiceFlowRecognition — speech state transitions', () => {
  it('fires onspeechstart on first non-final transcript with content', () => {
    const r = make()
    const onspeechstart = jest.fn()
    r.onspeechstart = onspeechstart
    dispatchMessage(r, { type: 'transcript', transcript: 'hello', isFinal: false })
    expect(onspeechstart).toHaveBeenCalledTimes(1)
  })

  it('does NOT fire onspeechstart again while speech is already active', () => {
    const r = make()
    const onspeechstart = jest.fn()
    r.onspeechstart = onspeechstart
    dispatchMessage(r, { type: 'transcript', transcript: 'hello', isFinal: false })
    dispatchMessage(r, { type: 'transcript', transcript: 'hello world', isFinal: false })
    expect(onspeechstart).toHaveBeenCalledTimes(1)
  })

  it('fires onspeechend on final transcript', () => {
    const r = make()
    const onspeechend = jest.fn()
    r.onspeechend = onspeechend
    dispatchMessage(r, { type: 'transcript', transcript: 'hello', isFinal: false })
    dispatchMessage(r, { type: 'transcript', transcript: 'hello world', isFinal: true })
    expect(onspeechend).toHaveBeenCalledTimes(1)
  })

  it('fires onspeechstart again after a speech segment ends', () => {
    const r = make()
    const onspeechstart = jest.fn()
    r.onspeechstart = onspeechstart
    // First segment
    dispatchMessage(r, { type: 'transcript', transcript: 'first', isFinal: false })
    dispatchMessage(r, { type: 'transcript', transcript: 'first sentence', isFinal: true })
    // Second segment
    dispatchMessage(r, { type: 'transcript', transcript: 'second', isFinal: false })
    expect(onspeechstart).toHaveBeenCalledTimes(2)
  })

  it('does NOT fire onspeechstart for empty/whitespace-only transcript', () => {
    const r = make()
    const onspeechstart = jest.fn()
    r.onspeechstart = onspeechstart
    dispatchMessage(r, { type: 'transcript', transcript: '   ', isFinal: false })
    expect(onspeechstart).not.toHaveBeenCalled()
  })

  it('fires both onspeechstart and onspeechend for a standalone final transcript with content', () => {
    // A final transcript activates speech then immediately ends it in one message.
    const r = make()
    const onspeechstart = jest.fn()
    const onspeechend = jest.fn()
    r.onspeechstart = onspeechstart
    r.onspeechend = onspeechend
    dispatchMessage(r, { type: 'transcript', transcript: 'hello', isFinal: true })
    expect(onspeechstart).toHaveBeenCalledTimes(1)
    expect(onspeechend).toHaveBeenCalledTimes(1)
  })

  it('fires neither onspeechstart nor onspeechend for a final empty transcript', () => {
    const r = make()
    const onspeechstart = jest.fn()
    const onspeechend = jest.fn()
    r.onspeechstart = onspeechstart
    r.onspeechend = onspeechend
    dispatchMessage(r, { type: 'transcript', transcript: '', isFinal: true })
    expect(onspeechstart).not.toHaveBeenCalled()
    expect(onspeechend).not.toHaveBeenCalled()
  })
})

// ── Reconnection (uses start() without triggering onopen) ────────────────────

describe('VoiceFlowRecognition — reconnection', () => {
  it('increments reconnectAttempts on abnormal close (1006)', async () => {
    const r = make()
    r.start()
    await Promise.resolve() // flush microtask queue

    expect(capturedMockWs).not.toBeNull()
    capturedMockWs.onclose?.({ code: 1006, reason: '', wasClean: false })

    expect((r as any).reconnectAttempts).toBe(1)
  })

  it('schedules a reconnection after abnormal close', async () => {
    const r = make()
    r.start()
    await Promise.resolve()

    capturedMockWs.onclose?.({ code: 1006, reason: '', wasClean: false })

    // Reconnect is scheduled with setTimeout(fn, 1000 * reconnectAttempts)
    expect((r as any).reconnectTimeoutId).not.toBeNull()
  })

  it('does NOT reconnect on normal close (1000)', async () => {
    const r = make()
    r.start()
    await Promise.resolve()

    capturedMockWs.onclose?.({ code: 1000, reason: 'User stopped', wasClean: true })

    expect((r as any).reconnectAttempts).toBe(0)
    expect((r as any).reconnectTimeoutId).toBeNull()
  })

  it('does NOT reconnect when userStopped is true', async () => {
    const r = make()
    r.start()
    await Promise.resolve()

    // Simulate stop() having set userStopped before close fires
    ;(r as any).userStopped = true
    capturedMockWs.onclose?.({ code: 1006, reason: '', wasClean: false })

    expect((r as any).reconnectAttempts).toBe(0)
  })

  it('fires onerror and does NOT reconnect on auth failure (1008)', async () => {
    const r = make()
    const onerror = jest.fn()
    r.onerror = onerror

    r.start()
    await Promise.resolve()

    capturedMockWs.onclose?.({ code: 1008, reason: 'Invalid token', wasClean: false })

    expect((r as any).reconnectAttempts).toBe(0)
    expect(onerror).toHaveBeenCalledTimes(1)
    const evt = onerror.mock.calls[0][0]
    expect(evt.error).toBe('auth')
  })
})
