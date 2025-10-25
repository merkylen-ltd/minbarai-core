import { useState, useEffect, useRef, useCallback } from 'react'
import { VoiceFlowAdapter } from '@/lib/voiceflow/adapter'
import { getVoiceFlowConfig } from '@/lib/voiceflow/config'
import { getASRLanguageCode, getLanguageName } from '@/constants/languages'
import { ConnectionStatus, TranslationVariant } from '../types'
import { checkVoiceFlowCompatibility, isMobileBrowser } from '../utils/browser-utils'
import { getLanguageSpecificConfig } from '../utils/language-config'
import { setupRecognitionHandlers } from '../utils/speech-recognition'

export interface UseSpeechRecognitionProps {
  sourceLanguage: string
  targetLanguage: string
  translationVariant: TranslationVariant
  isValidForTranslation: boolean
  sessionData: any
  totalUsageMinutes: number
  sourceScrollRef: React.RefObject<HTMLDivElement>
  onInterimText: (text: string) => void
  onFinalText: (text: string) => void
  onTranslation: (translation: string) => void
  onError: (title: string, details: string, variant: 'warning' | 'destructive') => void
  scrollToBottom: (ref: React.RefObject<HTMLDivElement>) => void
  startUsageSession: () => Promise<void>
  endUsageSession: () => Promise<void>
}

export interface UseSpeechRecognitionReturn {
  isRecording: boolean
  status: ConnectionStatus
  startRecording: () => Promise<void>
  stopRecording: () => void
  recognitionRef: React.MutableRefObject<VoiceFlowAdapter | null>
  avgTranslationTime: number
}

export const useSpeechRecognition = ({
  sourceLanguage,
  targetLanguage,
  translationVariant,
  isValidForTranslation,
  sessionData,
  totalUsageMinutes,
  sourceScrollRef,
  onInterimText,
  onFinalText,
  onTranslation,
  onError,
  scrollToBottom,
  startUsageSession,
  endUsageSession
}: UseSpeechRecognitionProps): UseSpeechRecognitionReturn => {
  const [isRecording, setIsRecording] = useState(false)
  const [status, setStatus] = useState<ConnectionStatus>({
    connected: false,
    status: 'disconnected'
  })
  const [avgTranslationTime, setAvgTranslationTime] = useState(0)
  const [isMounted, setIsMounted] = useState(false)

  const recognitionRef = useRef<VoiceFlowAdapter | null>(null)
  const promptRef = useRef<string>('')
  const isUserStoppedRef = useRef<boolean>(false)
  const lastFinalResultTimeRef = useRef<number | null>(null)
  const lastResultEventStartRef = useRef<number | null>(null)
  const translationTimesRef = useRef<number[]>([])

  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Initialize speech recognition when component mounts
  useEffect(() => {
    if (!isMounted) return

    const compatibility = checkVoiceFlowCompatibility()
    if (!compatibility.isSupported) {
      let errorMessage = 'Speech recognition not available. '
      if (!compatibility.voiceFlow) {
        errorMessage += 'VoiceFlow not configured. Please check environment variables.'
      } else if (!compatibility.mediaDevices) {
        errorMessage += 'Microphone access not supported.'
      } else if (!compatibility.audioContext) {
        errorMessage += 'Audio processing not supported.'
      }
      
      setStatus({ 
        connected: false, 
        status: 'error', 
        message: errorMessage
      })
      return
    }

    // Only create recognition instance if it doesn't exist
    if (!recognitionRef.current) {
      try {
        const config = getVoiceFlowConfig()
        const languageCode = getASRLanguageCode(sourceLanguage)
        
        const recognition = new VoiceFlowAdapter(config, {
          // Multi-language optimized settings
          model: 'latest_long',
          wordTimeOffsets: true,
          spokenPunctuation: true,
          endpointing: { singleUtterance: false },
          emitStability: false,
          phraseHints: ["MinbarAI"],
          // Language-specific optimizations
          ...getLanguageSpecificConfig(sourceLanguage),
          metadata: {
            interactionType: 'DISCUSSION',
            microphoneDistance: 'NEARFIELD',
            originalMediaType: 'AUDIO',
            recordingDeviceType: 'PC'
          }
        })
        recognition.continuous = true
        recognition.interimResults = true
        recognition.setLanguage(languageCode)
        recognition.maxAlternatives = 1

        // Set up event handlers
        setupRecognitionHandlers(recognition, {
          onStatusChange: setStatus,
          onInterimText,
          onFinalText,
          onTranslation,
          onError,
          scrollToBottom,
          sourceScrollRef,
          isUserStoppedRef,
          setIsRecording,
          lastFinalResultTimeRef,
          lastResultEventStartRef,
          translationTimesRef,
          setAvgTranslationTime
        })

        recognitionRef.current = recognition
      } catch (error) {
        setStatus({ 
          connected: false, 
          status: 'error', 
          message: 'Failed to initialize speech recognition.' 
        })
      }
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop()
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    }
  }, [isMounted])

  // Update recognition language when source language changes
  useEffect(() => {
    if (recognitionRef.current && isRecording) {
      const languageCode = getASRLanguageCode(sourceLanguage)
      // Update ASR language
      recognitionRef.current.setLanguage(languageCode)
      // Also update translation source to keep server in sync
      try {
        recognitionRef.current.enableTranslation({
          prompt: promptRef.current || '',
          sourceLanguage: languageCode,
          targetLanguage: getLanguageName(targetLanguage),
          geminiModelConfig: {
            model: 'gemini-2.5-flash-lite',
            temperature: 0.2,
            maxTokens: 1000,
            topP: 1.0
          }
        })
      } catch (err) {
        console.warn('[VoiceFlow] Failed to update translation source language dynamically:', err)
      }
    }
  }, [sourceLanguage, isRecording, targetLanguage])

  // Update translation target language dynamically
  useEffect(() => {
    if (recognitionRef.current && isRecording) {
      try {
        recognitionRef.current.enableTranslation({
          prompt: promptRef.current || '',
          sourceLanguage: getASRLanguageCode(sourceLanguage),
          targetLanguage: getLanguageName(targetLanguage),
          geminiModelConfig: {
            model: 'gemini-2.5-flash-lite',
            temperature: 0.2,
            maxTokens: 1000,
            topP: 1.0
          }
        })
      } catch (err) {
        console.warn('[VoiceFlow] Failed to update translation target language dynamically:', err)
      }
    }
  }, [targetLanguage, isRecording, sourceLanguage])

  // Start recording
  const startRecording = useCallback(async () => {
    if (isRecording) return
    
    isUserStoppedRef.current = false
    
    // Check session validity before starting
    if (!isValidForTranslation) {
      setStatus({ 
        connected: false, 
        status: 'error', 
        message: 'Invalid subscription or session expired. Please check your account status.' 
      })
      return
    }
    
    // Check if user has time remaining
    const sessionLimitMinutes = sessionData?.sessionLimitMinutes ?? 0
    if (totalUsageMinutes >= sessionLimitMinutes) {
      setStatus({ 
        connected: false, 
        status: 'error', 
        message: `Session limit already reached (${sessionLimitMinutes} minutes). Please contact support@minbarai.com.` 
      })
      return
    }
    
    // Check VoiceFlow compatibility
    const compatibility = checkVoiceFlowCompatibility()
    if (!compatibility.isSupported) {
      let errorMessage = 'VoiceFlow speech recognition is not available.'
      let errorDetails = ''
      
      if (!compatibility.voiceFlow) {
        errorMessage = 'VoiceFlow Configuration Missing'
        errorDetails = 'VoiceFlow WebSocket URL and token are not configured. Please contact support to enable speech recognition.'
      } else if (!compatibility.mediaDevices) {
        errorMessage = 'Microphone Access Required'
        errorDetails = 'Your browser does not support microphone access. Please use a modern browser like Chrome, Firefox, or Safari.'
      } else if (!compatibility.audioContext) {
        errorMessage = 'Audio Processing Not Supported'
        errorDetails = 'Your browser does not support audio processing. Please update your browser or try a different one.'
      }
      
      setStatus({ 
        connected: false, 
        status: 'error', 
        message: errorMessage 
      })
      
      onError(errorMessage, errorDetails, 'warning')
      return
    }
    
    try {
      // Check if we're in browser environment
      if (typeof window === 'undefined' || !navigator.mediaDevices) {
        throw new Error('Media devices not available')
      }
      
      // Check microphone permission with mobile-friendly constraints
      let stream: MediaStream
      try {
        // Try exact constraints first (preserves desktop behavior)
        stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          } 
        })
      } catch (error) {
        // Fallback to ideal constraints for mobile compatibility
        console.warn('[Live Captioning] Exact audio constraints failed, trying ideal constraints:', error)
        stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: { ideal: true },
            noiseSuppression: { ideal: true },
            autoGainControl: { ideal: true }
          } 
        })
      }
      stream.getTracks().forEach(track => track.stop()) // Stop test stream
      
      // Start usage session first
      await startUsageSession()
      
      // Wait for usage tracking to initialize (the ping will be sent)
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Start speech recognition
      if (recognitionRef.current) {
        setIsRecording(true)
        try {
          // Snapshot the UI language selections at click time to avoid race conditions
          const chosenSource = sourceLanguage
          const chosenTarget = targetLanguage
          const sourceNameSnapshot = getLanguageName(chosenSource)
          const targetNameSnapshot = getLanguageName(chosenTarget)

          // Load prompt template from server using the snapshotted languages and variant
          const res = await fetch(`/api/prompts?target=${encodeURIComponent(targetNameSnapshot)}&source=${encodeURIComponent(sourceNameSnapshot)}&variant=${translationVariant}`, { cache: 'no-store' })
          const data = await res.json()
          const prompt = (data && typeof data.prompt === 'string') ? data.prompt : ''
          
          console.log(`[Speech Recognition] Loading prompt with variant: ${translationVariant}`)
          
          // Set translation config via adapter before start
          if (prompt.trim()) {
            const targetName = targetNameSnapshot
            const sourceLangBase = chosenSource
            const targetLangBase = chosenTarget
            const asrLangCode = (recognitionRef.current as any).lang || getASRLanguageCode(chosenSource)
            
            // CRITICAL: Validate source != target (can't translate language to itself)
            if (sourceLangBase === targetLangBase) {
              console.error('[Live Captioning] Source and target languages are the same! Translation disabled.')
              onError(
                'Invalid Language Selection',
                `You cannot translate ${getLanguageName(sourceLangBase)} to ${getLanguageName(targetLangBase)}. Please select a different target language.`,
                'warning'
              )
              // Continue without translation
              recognitionRef.current.start()
              console.log('[Live Captioning] VoiceFlow recognition started without translation')
              return
            }
            
            const effectivePrompt = prompt
            promptRef.current = effectivePrompt
            
            // Configure translation via adapter pre-start
            try {
              recognitionRef.current.setTranslationConfig({
                prompt: effectivePrompt,
                sourceLanguage: asrLangCode,
                targetLanguage: targetName,
                geminiModelConfig: {
                  model: 'gemini-2.5-flash-lite',
                  temperature: 0.2,
                  maxTokens: 1000,
                  topP: 1.0
                }
              })
            } catch (err) {
              console.error('[Live Captioning] Failed to set translation config:', err)
            }
          } else {
            console.warn('[Live Captioning] No translation prompt loaded')
          }
        } catch (e) {
          console.error('[Live Captioning] Failed to load translation prompt:', e)
        }
        recognitionRef.current.start()
      } else {
        throw new Error('VoiceFlow recognition not initialized')
      }
    } catch (error) {
      console.error('[Live Captioning] Failed to start recording:', error)
      
      isUserStoppedRef.current = true
      
      let errorMessage = 'Failed to start recording. '
      let errorDetails = ''
      
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          if (isMobileBrowser()) {
            errorMessage = 'Microphone Permission Required'
            errorDetails = 'Please allow microphone access in your browser settings and refresh the page. On mobile, you may need to tap the microphone icon in your browser\'s address bar.'
          } else {
            errorMessage += 'Please allow microphone access.'
          }
        } else if (error.name === 'NotFoundError') {
          if (isMobileBrowser()) {
            errorMessage = 'No Microphone Found'
            errorDetails = 'No microphone detected on this device. Please check your device\'s microphone settings.'
          } else {
            errorMessage += 'No microphone found.'
          }
        } else if (error.name === 'NotSupportedError') {
          if (isMobileBrowser()) {
            errorMessage = 'Audio Not Supported'
            errorDetails = 'Your mobile browser doesn\'t support the required audio features. Please try using Chrome or Safari on your mobile device.'
          } else {
            errorMessage = error.message
          }
        } else {
          errorMessage = error.message
        }
      }
      
      setStatus({ connected: false, status: 'error', message: errorMessage })
      
      if (isMobileBrowser() && errorDetails) {
        onError(errorMessage, errorDetails, 'warning')
      }
    }
  }, [
    isRecording, 
    isValidForTranslation, 
    sessionData, 
    totalUsageMinutes, 
    sourceLanguage, 
    targetLanguage, 
    startUsageSession,
    onError
  ])

  // Stop recording
  const stopRecording = useCallback(() => {
    if (!isRecording) return
    
    isUserStoppedRef.current = true
    setIsRecording(false)
    
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch (error) {
        console.warn('[Live Captioning] Error stopping recognition:', error)
      }
    }
    
    endUsageSession()
    onInterimText('')
  }, [isRecording, endUsageSession, onInterimText])

  return {
    isRecording,
    status,
    startRecording,
    stopRecording,
    recognitionRef,
    avgTranslationTime
  }
}

