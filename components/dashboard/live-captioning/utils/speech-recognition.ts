import { VoiceFlowAdapter } from '@/lib/voiceflow/adapter'
import type { 
  SpeechRecognitionEvent, 
  SpeechRecognitionErrorEvent 
} from '@/lib/voiceflow/adapter'
import { ConnectionStatus } from '../types'

// Translation validation constants
const MAX_TRANSLATION_LENGTH = 2000 // Max characters for a single translation
const MAX_REPETITION_COUNT = 3 // Max times a phrase can repeat before flagged as garbage
const MIN_TRANSLATION_LENGTH = 1 // Minimum characters for a valid translation

// Track seen translation IDs to prevent duplicates
const seenTranslationIds = new Set<number>()
const recentTranslationHashes = new Set<string>()
const MAX_HASH_CACHE_SIZE = 100

/**
 * Simple hash function for translation deduplication
 */
function hashString(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return hash.toString(36)
}

/**
 * Detect repetitive patterns that indicate garbage/hallucination
 * Returns true if the text appears to be garbage
 */
function detectGarbagePattern(text: string): boolean {
  if (!text || text.length < 10) return false
  
  // Check for excessive punctuation (more than 20% of text)
  const punctuationCount = (text.match(/[.,!?;:'"،؟]/g) || []).length
  if (punctuationCount / text.length > 0.2) {
    console.warn('[Translation Validation] Excessive punctuation detected')
    return true
  }
  
  // Check for repeated phrases (3+ times)
  const words = text.split(/\s+/)
  if (words.length >= 6) {
    // Check for repeated 2-3 word phrases
    for (let phraseLen = 2; phraseLen <= 3; phraseLen++) {
      const phraseCounts: Record<string, number> = {}
      for (let i = 0; i <= words.length - phraseLen; i++) {
        const phrase = words.slice(i, i + phraseLen).join(' ').toLowerCase()
        phraseCounts[phrase] = (phraseCounts[phrase] || 0) + 1
        if (phraseCounts[phrase] >= MAX_REPETITION_COUNT) {
          console.warn('[Translation Validation] Repeated phrase detected:', phrase)
          return true
        }
      }
    }
  }
  
  // Check for control characters or unusual Unicode
  if (/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(text)) {
    console.warn('[Translation Validation] Control characters detected')
    return true
  }
  
  return false
}

/**
 * Validate translation content before displaying
 * Returns null if translation should be rejected
 * @param translated - The translated text
 * @param translationId - Optional unique ID for deduplication
 * @param sourceLength - Optional source text length for hallucination detection
 */
function validateTranslation(translated: string, translationId?: number, sourceLength?: number): string | null {
  // Check for empty or too short
  if (!translated || translated.trim().length < MIN_TRANSLATION_LENGTH) {
    console.warn('[Translation Validation] Translation too short or empty')
    return null
  }
  
  // Hallucination detection: translation shouldn't be more than 4x longer than source
  // (German/Arabic expansion is typically 1.2-2.5x, anything over 4x is suspicious)
  if (sourceLength && sourceLength > 0) {
    const ratio = translated.length / sourceLength
    if (ratio > 4) {
      console.warn('[Translation Validation] Translation ratio too high (likely hallucination):', ratio.toFixed(2), 'x source length')
      // Truncate to reasonable length (2.5x source as max reasonable expansion)
      const maxLen = Math.floor(sourceLength * 2.5)
      translated = translated.substring(0, maxLen) + '...'
      console.log('[Translation Validation] Truncated hallucinated translation to', maxLen, 'chars')
    }
  }
  
  // Check for duplicate by ID
  if (translationId !== undefined) {
    if (seenTranslationIds.has(translationId)) {
      console.warn('[Translation Validation] Duplicate translationId:', translationId)
      return null
    }
    seenTranslationIds.add(translationId)
    
    // Limit cache size
    if (seenTranslationIds.size > MAX_HASH_CACHE_SIZE) {
      const firstKey = seenTranslationIds.values().next().value
      if (firstKey !== undefined) {
        seenTranslationIds.delete(firstKey)
      }
    }
  }
  
  // Check for duplicate by content hash
  const hash = hashString(translated.trim())
  if (recentTranslationHashes.has(hash)) {
    console.warn('[Translation Validation] Duplicate translation content detected')
    return null
  }
  recentTranslationHashes.add(hash)
  
  // Limit cache size
  if (recentTranslationHashes.size > MAX_HASH_CACHE_SIZE) {
    const firstKey = recentTranslationHashes.values().next().value
    if (firstKey !== undefined) {
      recentTranslationHashes.delete(firstKey)
    }
  }
  
  // Check for excessive length
  if (translated.length > MAX_TRANSLATION_LENGTH) {
    console.warn('[Translation Validation] Translation exceeds max length, truncating')
    translated = translated.substring(0, MAX_TRANSLATION_LENGTH) + '...'
  }
  
  // Check for garbage patterns
  if (detectGarbagePattern(translated)) {
    console.warn('[Translation Validation] Garbage pattern detected, rejecting translation')
    return null
  }
  
  return translated.trim()
}

export interface RecognitionHandlers {
  onStatusChange: (status: ConnectionStatus) => void
  onInterimText: (text: string) => void
  onFinalText: (text: string) => void
  onTranslation: (translation: string) => void
  onError: (errorMessage: string, errorDetails: string, variant: 'warning' | 'destructive') => void
  scrollToBottom: (ref: React.RefObject<HTMLDivElement>) => void
  sourceScrollRef: React.RefObject<HTMLDivElement>
  isUserStoppedRef: React.MutableRefObject<boolean>
  setIsRecording: (recording: boolean) => void
  lastFinalResultTimeRef: React.MutableRefObject<number | null>
  lastResultEventStartRef: React.MutableRefObject<number | null>
  translationTimesRef: React.MutableRefObject<number[]>
  setAvgTranslationTime: (time: number) => void
}

// Setup recognition event handlers
export const setupRecognitionHandlers = (
  recognition: VoiceFlowAdapter,
  handlers: RecognitionHandlers
) => {
  recognition.onstart = () => {
    handlers.onStatusChange({ connected: true, status: 'connected' })
  }

  recognition.onend = () => {
    // VoiceFlow should handle continuous streaming internally
    // If onend is called, it means either user stopped or there was an error
    if (handlers.isUserStoppedRef.current) {
      handlers.onStatusChange({ connected: false, status: 'disconnected' })
    } else {
      handlers.onStatusChange({ 
        connected: false, 
        status: 'error', 
        message: 'Speech recognition ended. Click Start to resume.' 
      })
      handlers.setIsRecording(false)
    }
  }

  recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
    console.error('[VoiceFlow] Error:', event.error, event.message)
    
    if (event.error === 'no-speech' || event.error === 'aborted') {
      // These are normal, don't show errors
      return
    }
    
    let errorMessage = 'Speech recognition error occurred.'
    let errorDetails = ''
    let variant: 'warning' | 'destructive' = 'warning'
    
    // Handle permission errors (new explicit permission type)
    if (event.error === 'permission' || event.error === 'not-allowed') {
      errorMessage = 'Microphone Permission Required'
      
      // Use the detailed message from the error if available
      if (event.message && event.message.length > 0) {
        errorDetails = event.message
      } else {
        // Fallback message
        errorDetails = 'Please allow microphone access:\n\n' +
          '1. Look for the microphone icon in your browser\'s address bar\n' +
          '2. Click it and select "Allow"\n' +
          '3. If you don\'t see the icon, check your browser settings\n' +
          '4. For embedded browsers (Cursor, VS Code): You may need to open this page in your system browser (Chrome, Firefox, etc.)\n\n' +
          'Then refresh the page and try again.'
      }
      variant = 'warning'
      handlers.setIsRecording(false)
      handlers.isUserStoppedRef.current = true
    } 
    // Handle initialization errors with detailed message
    else if (event.error === 'initialization') {
      errorMessage = 'Initialization Failed'
      
      // Use the detailed message from the error if available
      if (event.message && event.message.length > 0) {
        errorDetails = event.message + '\n\nIf this problem persists, try:\n' +
          '1. Refreshing the page\n' +
          '2. Checking your browser\'s microphone settings\n' +
          '3. Using a different browser (Chrome, Firefox, Edge recommended)\n' +
          '4. Opening this page in your system browser instead of an embedded browser'
      } else {
        errorDetails = 'Failed to initialize audio capture. Please refresh the page and try again.'
      }
      variant = 'warning'
      handlers.setIsRecording(false)
      handlers.isUserStoppedRef.current = true
    }
    else if (event.error === 'network') {
      errorMessage = 'Connection Error'
      errorDetails = 'Unable to connect to speech recognition service. Please check your internet connection and try again.'
      variant = 'warning'
    } else if (event.error === 'auth') {
      errorMessage = 'Authentication Failed'
      errorDetails = 'VoiceFlow authentication failed. Please contact support if this issue persists.'
      variant = 'destructive'
    } else if (event.error === 'service') {
      // Check if it's a timeout error (common in development with hot reload)
      const isTimeoutError = event.message?.includes('Audio Timeout') || event.message?.includes('audio should be sent close to real time')
      
      if (isTimeoutError) {
        // Don't stop recording - this is likely a temporary glitch from hot reload
        console.warn('[VoiceFlow] Audio timeout detected (likely due to hot reload) - continuing...')
        return // Silent recovery - don't show error to user
      }
      
      errorMessage = 'Service Temporarily Unavailable'
      errorDetails = 'The speech recognition service is temporarily unavailable. Please stop and restart recording.'
      variant = 'warning'
    } else {
      errorMessage = 'Speech Recognition Error'
      errorDetails = `An unexpected error occurred: ${event.error}${event.message ? ` - ${event.message}` : ''}. Please try again or contact support if the problem persists.`
      variant = 'destructive'
    }
    
    handlers.onStatusChange({ 
      connected: false, 
      status: 'error', 
      message: errorMessage 
    })
    
    // Show user-friendly notification
    handlers.onError(errorMessage, errorDetails, variant)
  }

  recognition.onresult = (event: SpeechRecognitionEvent) => {
    // Metrics: measure handler processing time
    handlers.lastResultEventStartRef.current = performance.now()
    let interimTranscript = ''
    let finalTranscript = ''

    // Process results faster
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript
      const confidence = event.results[i][0].confidence
      const isFinal = event.results[i].isFinal
      
      // CRITICAL: Filter out empty final transcripts to prevent clearing display
      if (isFinal && (!transcript || transcript.trim() === '')) {
        continue
      }
      
      if (isFinal) {
        finalTranscript += transcript
        // Metrics: mark when final transcript was observed
        handlers.lastFinalResultTimeRef.current = performance.now()
      } else {
        interimTranscript += transcript
      }
    }

    // Update UI immediately
    handlers.onInterimText(interimTranscript)

    if (finalTranscript) {
      handlers.onFinalText(finalTranscript)
      // Immediate scroll without timeout
      handlers.scrollToBottom(handlers.sourceScrollRef)
      
      // Translation is handled by Voiceflow server on final transcripts
      handlers.onInterimText('')
      // Metrics: simple caption processing latency (handler time)
      if (handlers.lastResultEventStartRef.current != null) {
        const captionProcessingMs = performance.now() - handlers.lastResultEventStartRef.current
        console.log('[Metrics] Caption handler processing time (ms):', Math.round(captionProcessingMs))
      }
    } else if (interimTranscript) {
      // Immediate scroll for interim text
      handlers.scrollToBottom(handlers.sourceScrollRef)
    }
  }
  
  // Handle translation events from Voiceflow
  recognition.ontranslation = (e: any) => {
    console.log('[Live Captioning] Translation event received:', e)
    
    if (!e || !e.translated) {
      console.warn('[Live Captioning] Translation event missing translated text:', e)
      return
    }
    
    // Get source text length for hallucination detection
    // VoiceFlow sends the source text in e.sourceText or e.original
    const sourceLength = (e.sourceText || e.original || e.transcript || '')?.length || 0
    
    // Validate and sanitize translation before displaying
    const validatedTranslation = validateTranslation(e.translated, e.translationId, sourceLength)
    if (!validatedTranslation) {
      console.warn('[Live Captioning] Translation rejected by validation, original:', e.translated?.substring(0, 100))
      return
    }
    
    console.log('[Live Captioning] Translation passed validation:', validatedTranslation.substring(0, 100))
    
    // Metrics: measure translation latency from last final transcript to translation arrival
    if (handlers.lastFinalResultTimeRef.current != null) {
      const now = performance.now()
      const deltaMs = now - handlers.lastFinalResultTimeRef.current
      handlers.translationTimesRef.current.push(deltaMs)
      // keep last 20 samples
      if (handlers.translationTimesRef.current.length > 20) {
        handlers.translationTimesRef.current.shift()
      }
      const avg = handlers.translationTimesRef.current.reduce((a, b) => a + b, 0) / handlers.translationTimesRef.current.length
      handlers.setAvgTranslationTime(Math.round(avg))
      console.log('[Metrics] Translation latency (ms):', Math.round(deltaMs), '| avg (last 20):', Math.round(avg))
    }
    
    handlers.onTranslation(validatedTranslation)
  }

  // Handle info events (stream rotation, ready, stopped)
  recognition.oninfo = (e: any) => {
    const data = e?.info || e?.data
    if (!data) return
    
    // Handle stream rotation notifications
    if (data.type === 'info' && data.message === 'infinite_stream_rotated') {
      const streamId = data.streamId
      const bridgingOffset = data.bridgingOffset
      console.log(`[VoiceFlow] Stream rotated → #${streamId} (bridging offset: ${bridgingOffset}ms)`)
      // Stream rotation is seamless - no action needed, just log for debugging
    } else if (data.type === 'ready') {
      console.log('[VoiceFlow] Server ready')
      handlers.onStatusChange({ connected: true, status: 'connected' })
    } else if (data.type === 'stopped') {
      console.log('[VoiceFlow] Server stopped stream')
      // Server stopped - this is usually followed by reconnection
    }
  }
}

