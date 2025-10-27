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
  isStarting: boolean
  isPromptLoading: boolean
  promptError: string | null
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
  const [isStarting, setIsStarting] = useState(false)
  const [status, setStatus] = useState<ConnectionStatus>({
    connected: false,
    status: 'disconnected'
  })
  const [avgTranslationTime, setAvgTranslationTime] = useState(0)
  const [isMounted, setIsMounted] = useState(false)
  const [cachedPrompt, setCachedPrompt] = useState<string>('')
  const [isPromptLoading, setIsPromptLoading] = useState(false)
  const [promptError, setPromptError] = useState<string | null>(null)
  const [promptLanguages, setPromptLanguages] = useState<{source: string, target: string} | null>(null)

  const recognitionRef = useRef<VoiceFlowAdapter | null>(null)
  const promptRef = useRef<string>('')
  const isUserStoppedRef = useRef<boolean>(false)
  const lastFinalResultTimeRef = useRef<number | null>(null)
  const lastResultEventStartRef = useRef<number | null>(null)
  const translationTimesRef = useRef<number[]>([])

  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Pre-load prompt when language or variant changes
  const preloadPrompt = useCallback(async () => {
    setIsPromptLoading(true)
    setPromptError(null)
    
    try {
      const sourceName = getLanguageName(sourceLanguage)
      const targetName = getLanguageName(targetLanguage)
      
      console.log(`[Speech Recognition] Loading prompt for ${sourceName} → ${targetName} (${translationVariant})`)
      
      const res = await fetch(`/api/prompts?target=${encodeURIComponent(targetName)}&source=${encodeURIComponent(sourceName)}&variant=${translationVariant}`, { cache: 'no-store' })
      const data = await res.json()
      const prompt = (data && typeof data.prompt === 'string') ? data.prompt : ''
      
      if (!prompt) {
        throw new Error('Empty prompt received from server')
      }
      
      setCachedPrompt(prompt)
      setPromptLanguages({ source: sourceLanguage, target: targetLanguage })
      setIsPromptLoading(false)
      console.log(`[Speech Recognition] Prompt loaded successfully for ${sourceName} → ${targetName}`)
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      console.error('[Speech Recognition] Failed to load prompt:', errorMsg)
      setCachedPrompt('')
      setPromptLanguages(null)
      setPromptError(`Failed to load translation prompt: ${errorMsg}`)
      setIsPromptLoading(false)
    }
  }, [sourceLanguage, targetLanguage, translationVariant])

  // Pre-load prompt on mount and when dependencies change
  useEffect(() => {
    if (isMounted) {
      preloadPrompt()
    }
  }, [isMounted, preloadPrompt])

  // Validate if cached prompt is valid for current language pair
  const isPromptValid = useCallback(() => {
    if (!cachedPrompt || !promptLanguages) {
      return false
    }
    
    // Check if cached prompt matches current language selection
    if (promptLanguages.source !== sourceLanguage || promptLanguages.target !== targetLanguage) {
      console.warn('[Speech Recognition] Cached prompt is for wrong language pair')
      return false
    }
    
    return true
  }, [cachedPrompt, promptLanguages, sourceLanguage, targetLanguage])

  // Pre-initialize speech recognition immediately for zero-delay start
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

    // Pre-initialize recognition instance immediately for instant start
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
        console.log('[Speech Recognition] Pre-initialized for instant start')
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

  // Handle language changes during recording - reload prompt and update config
  useEffect(() => {
    if (!recognitionRef.current || !isRecording) return
    
    const updateLanguageConfig = async () => {
      const sourceName = getLanguageName(sourceLanguage)
      const targetName = getLanguageName(targetLanguage)
      
      console.log(`[Speech Recognition] Language changed during recording: ${sourceName} → ${targetName}`)
      
      // Check if we need a new prompt
      if (!promptLanguages || promptLanguages.source !== sourceLanguage || promptLanguages.target !== targetLanguage) {
        console.log('[Speech Recognition] Fetching new prompt for language change...')
        
        try {
          const res = await fetch(`/api/prompts?target=${encodeURIComponent(targetName)}&source=${encodeURIComponent(sourceName)}&variant=${translationVariant}`, { cache: 'no-store' })
          const data = await res.json()
          const newPrompt = (data && typeof data.prompt === 'string') ? data.prompt : ''
          
          if (!newPrompt) {
            console.error('[Speech Recognition] Failed to fetch prompt for language change')
            onError(
              'Language Change Warning',
              'Could not load translation prompt for new language pair. Translations may be incorrect until you restart.',
              'warning'
            )
            return
          }
          
          // Update cache
          setCachedPrompt(newPrompt)
          setPromptLanguages({ source: sourceLanguage, target: targetLanguage })
          promptRef.current = newPrompt
          
          console.log('[Speech Recognition] New prompt loaded for language change')
        } catch (error) {
          console.error('[Speech Recognition] Error fetching prompt during language change:', error)
          onError(
            'Language Change Warning',
            'Failed to update translation settings. Please restart recording for correct translations.',
            'warning'
          )
          return
        }
      }
      
      // Update ASR language
      const languageCode = getASRLanguageCode(sourceLanguage)
      if (recognitionRef.current) {
        recognitionRef.current.setLanguage(languageCode)
        
        // Update translation configuration with the correct prompt
        try {
          recognitionRef.current.enableTranslation({
            prompt: promptRef.current || '',
            sourceLanguage: languageCode,
            targetLanguage: targetName,
            geminiModelConfig: {
              model: 'gemini-2.5-flash-lite',
              temperature: 0.2,
              maxTokens: 1000,
              topP: 1.0
            }
          })
          console.log('[Speech Recognition] Translation config updated for language change')
        } catch (err) {
          console.error('[VoiceFlow] Failed to update translation config during language change:', err)
          onError(
            'Configuration Error',
            'Failed to update translation settings. Please restart recording.',
            'warning'
          )
        }
      }
    }
    
    updateLanguageConfig()
  }, [sourceLanguage, targetLanguage, isRecording, translationVariant, promptLanguages, onError])

  // Start recording
  const startRecording = useCallback(async () => {
    if (isRecording || isStarting) return
    
    isUserStoppedRef.current = false
    setIsStarting(true)
    
    // Check session validity before starting
    if (!isValidForTranslation) {
      setIsStarting(false)
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
      setIsStarting(false)
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
      
      setIsStarting(false)
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
      
      // Snapshot the UI language selections at click time to avoid race conditions
      const chosenSource = sourceLanguage
      const chosenTarget = targetLanguage
      const sourceNameSnapshot = getLanguageName(chosenSource)
      const targetNameSnapshot = getLanguageName(chosenTarget)
      
      console.log(`[Speech Recognition] Starting with languages: ${chosenSource} (${sourceNameSnapshot}) → ${chosenTarget} (${targetNameSnapshot})`)
      
      // CRITICAL: Validate source != target (can't translate language to itself)
      if (chosenSource === chosenTarget) {
        setIsStarting(false)
        console.error('[Live Captioning] Source and target languages are the same!')
        onError(
          'Invalid Language Selection',
          `You cannot translate ${sourceNameSnapshot} to ${targetNameSnapshot}. Please select a different target language.`,
          'warning'
        )
        return
      }
      
      // STEP 1: Ensure we have a valid prompt BEFORE starting VoiceFlow
      let prompt = cachedPrompt
      
      // If prompt is not valid for current language pair, fetch it
      if (!isPromptValid()) {
        console.log(`[Speech Recognition] Prompt not valid for ${sourceNameSnapshot} → ${targetNameSnapshot}, fetching...`)
        
        try {
          const res = await fetch(`/api/prompts?target=${encodeURIComponent(targetNameSnapshot)}&source=${encodeURIComponent(sourceNameSnapshot)}&variant=${translationVariant}`, { cache: 'no-store' })
          const data = await res.json()
          prompt = (data && typeof data.prompt === 'string') ? data.prompt : ''
          
          if (!prompt) {
            throw new Error('Empty prompt received from server')
          }
          
          // Update cache
          setCachedPrompt(prompt)
          setPromptLanguages({ source: chosenSource, target: chosenTarget })
          console.log(`[Speech Recognition] Prompt fetched successfully`)
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Failed to fetch prompt'
          console.error('[Speech Recognition] Failed to fetch prompt:', errorMsg)
          setIsStarting(false)
          onError(
            'Translation Setup Failed',
            `Could not load translation prompt: ${errorMsg}. Please try again.`,
            'destructive'
          )
          return
        }
      } else {
        console.log(`[Speech Recognition] Using valid cached prompt for ${sourceNameSnapshot} → ${targetNameSnapshot}`)
      }
      
      // STEP 2: Configure ASR language and translation BEFORE starting VoiceFlow
      if (!recognitionRef.current) {
        throw new Error('VoiceFlow recognition not initialized')
      }
      
      // CRITICAL: Update ASR language to match the currently selected source language
      const asrLangCode = getASRLanguageCode(chosenSource)
      recognitionRef.current.setLanguage(asrLangCode)
      console.log(`[Live Captioning] ASR language set to: ${asrLangCode} for ${sourceNameSnapshot}`)
      
      promptRef.current = prompt
      
      try {
        recognitionRef.current.setTranslationConfig({
          prompt: prompt,
          sourceLanguage: asrLangCode,
          targetLanguage: targetNameSnapshot,
          geminiModelConfig: {
            model: 'gemini-2.5-flash-lite',
            temperature: 0.2,
            maxTokens: 1000,
            topP: 1.0
          }
        })
        console.log(`[Live Captioning] Translation configured: ${sourceNameSnapshot} (${asrLangCode}) → ${targetNameSnapshot}`)
      } catch (err) {
        console.error('[Live Captioning] Failed to set translation config:', err)
        setIsStarting(false)
        onError(
          'Configuration Error',
          'Failed to configure translation. Please try again.',
          'destructive'
        )
        return
      }
      
      // STEP 3: Start session tracking FIRST (fire and forget - truly non-blocking)
      // This starts the session but we don't wait for it
      Promise.resolve().then(() => {
        startUsageSession().catch(err => {
          console.warn('[Speech Recognition] Background session start failed:', err)
        })
      })
      
      // STEP 4: NOW start VoiceFlow immediately with proper configuration
      setIsRecording(true)
      setIsStarting(false)
      recognitionRef.current.start()
      console.log('[Live Captioning] VoiceFlow recognition started with proper prompt configuration')
      
    } catch (error) {
      console.error('[Live Captioning] Failed to start recording:', error)
      
      isUserStoppedRef.current = true
      setIsRecording(false)
      setIsStarting(false)
      
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
    isStarting,
    isValidForTranslation, 
    sessionData, 
    totalUsageMinutes, 
    sourceLanguage, 
    targetLanguage, 
    translationVariant,
    cachedPrompt,
    isPromptValid,
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
    avgTranslationTime,
    isStarting,
    isPromptLoading,
    promptError
  }
}

