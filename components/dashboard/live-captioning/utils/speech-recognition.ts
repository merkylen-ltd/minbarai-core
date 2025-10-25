import { VoiceFlowAdapter } from '@/lib/voiceflow/adapter'
import type { 
  SpeechRecognitionEvent, 
  SpeechRecognitionErrorEvent 
} from '@/lib/voiceflow/adapter'
import { ConnectionStatus } from '../types'

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
    
    if (event.error === 'not-allowed') {
      errorMessage = 'Microphone Permission Required'
      errorDetails = 'Please allow microphone access in your browser and refresh the page to continue with speech recognition.'
      variant = 'warning'
      handlers.setIsRecording(false)
      handlers.isUserStoppedRef.current = true
    } else if (event.error === 'network') {
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
      errorDetails = `An unexpected error occurred: ${event.error}. Please try again or contact support if the problem persists.`
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
    if (!e || !e.translated) {
      console.warn('[Live Captioning] Translation event missing translated text:', e)
      return
    }
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
    
    handlers.onTranslation(e.translated)
  }
}

