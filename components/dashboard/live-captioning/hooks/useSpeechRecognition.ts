import { useState, useEffect, useRef, useCallback } from 'react'
import { VoiceFlowAdapter } from '@/lib/voiceflow/adapter'

/**
 * Pure function that checks whether the cached prompt is still valid for the
 * current language pair and translation variant. Exported for unit testing.
 *
 * Returns false if any of the three values diverge from what was cached, or if
 * there is no cached prompt/promptLanguages at all.
 */
export function checkPromptValid(
  cachedPrompt: string,
  promptLanguages: { source: string; target: string; variant: string } | null,
  sourceLanguage: string,
  targetLanguage: string,
  translationVariant: string
): boolean {
  if (!cachedPrompt || !promptLanguages) return false
  return (
    promptLanguages.source === sourceLanguage &&
    promptLanguages.target === targetLanguage &&
    promptLanguages.variant === translationVariant
  )
}
import { getVoiceFlowConfig } from '@/lib/voiceflow/config'
import { getASRLanguageCode, getLanguageName } from '@/constants/languages'
import { ConnectionStatus, TranslationVariant } from '../types'
import { checkVoiceFlowCompatibility, isMobileBrowser } from '../utils/browser-utils'
import { getLanguageSpecificConfig } from '../utils/language-config'
import { setupRecognitionHandlers, resetValidationState } from '../utils/speech-recognition'


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
  onClearTranslationQueue?: () => void
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
  endUsageSession,
  onClearTranslationQueue
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
  const [promptLanguages, setPromptLanguages] = useState<{source: string, target: string, variant: string} | null>(null)
  const [isLanguageChanging, setIsLanguageChanging] = useState(false)

  const recognitionRef = useRef<VoiceFlowAdapter | null>(null)
  const promptRef = useRef<string>('')
  const isUserStoppedRef = useRef<boolean>(false)
  const lastFinalResultTimeRef = useRef<number | null>(null)
  const lastResultEventStartRef = useRef<number | null>(null)
  const translationTimesRef = useRef<number[]>([])
  
  // Request cancellation and debouncing refs
  const abortControllerRef = useRef<AbortController | null>(null)
  const languageChangeTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const pendingLanguageChangeRef = useRef<{source: string, target: string} | null>(null)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Pre-load prompt when language or variant changes with cancellation support
  const preloadPrompt = useCallback(async (sourceLang?: string, targetLang?: string, variant?: TranslationVariant) => {
    const currentSource = sourceLang || sourceLanguage
    const currentTarget = targetLang || targetLanguage
    const currentVariant = variant || translationVariant
    
    // Cancel any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    
    // Create new abort controller
    abortControllerRef.current = new AbortController()
    const currentAbortController = abortControllerRef.current
    
    setIsPromptLoading(true)
    setPromptError(null)
    
    try {
      const sourceName = getLanguageName(currentSource)
      const targetName = getLanguageName(currentTarget)
      
      const res = await fetch(`/api/prompts?target=${encodeURIComponent(targetName)}&source=${encodeURIComponent(sourceName)}&variant=${currentVariant}`, { 
        cache: 'no-store',
        signal: currentAbortController.signal
      })
      
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`)
      }
      
      const data = await res.json()
      const prompt = (data && typeof data.prompt === 'string') ? data.prompt : ''
      
      if (!prompt) {
        throw new Error('Empty prompt received from server')
      }
      
      // Only update if this request wasn't cancelled and is still the current request
      if (!currentAbortController.signal.aborted && abortControllerRef.current === currentAbortController) {
        setCachedPrompt(prompt)
        setPromptLanguages({ source: currentSource, target: currentTarget, variant: currentVariant })
        setIsPromptLoading(false)
      }
    } catch (error) {
      // Don't update state if request was cancelled
      if (currentAbortController.signal.aborted) {
        return
      }
      
      // Only show error if this is still the current request
      if (abortControllerRef.current !== currentAbortController) {
        return
      }
      
      // Handle specific abort errors gracefully
      if (error instanceof Error && error.name === 'AbortError') {
        return
      }
      
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      console.error('[Speech Recognition] Failed to load translation setting:', errorMsg)
      setCachedPrompt('')
      setPromptLanguages(null)
      setPromptError(`Failed to load translation setting: ${errorMsg}`)
      setIsPromptLoading(false)
    }
  }, [sourceLanguage, targetLanguage, translationVariant])

  // Pre-load prompt on mount and when dependencies change
  useEffect(() => {
    if (isMounted) {
      preloadPrompt()
    }
  }, [isMounted, preloadPrompt])

  // Validate if cached prompt is valid for current language pair and variant
  const isPromptValid = useCallback(() => {
    return checkPromptValid(cachedPrompt, promptLanguages, sourceLanguage, targetLanguage, translationVariant)
  }, [cachedPrompt, promptLanguages, sourceLanguage, targetLanguage, translationVariant])

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
      
      // Cleanup abort controller
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
        abortControllerRef.current = null
      }
      
      // Cleanup timeouts
      if (languageChangeTimeoutRef.current) {
        clearTimeout(languageChangeTimeoutRef.current)
        languageChangeTimeoutRef.current = null
      }
    }
    // Intentionally mount-only: adding callback deps would destroy/recreate the
    // VoiceFlow recognition instance on every render. Callbacks are stable refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMounted])

  // Language change handler for recording sessions
  const handleLanguageChange = useCallback(async (sourceLang: string, targetLang: string) => {
      if (!recognitionRef.current || !isRecording) return
      
      setIsLanguageChanging(true)
      
      try {
        const sourceName = getLanguageName(sourceLang)
        const targetName = getLanguageName(targetLang)
        
        // Validate language pair
        if (sourceLang === targetLang) {
          setIsLanguageChanging(false)
          return
        }
        
        // Check if we need a new prompt (language pair or variant changed)
        const needsNewPrompt = !promptLanguages ||
          promptLanguages.source !== sourceLang ||
          promptLanguages.target !== targetLang ||
          promptLanguages.variant !== translationVariant
        
        if (needsNewPrompt) {
          // Cancel any existing prompt request
          if (abortControllerRef.current) {
            abortControllerRef.current.abort()
          }
          
          abortControllerRef.current = new AbortController()
          const currentAbortController = abortControllerRef.current
          
          try {
            const res = await fetch(`/api/prompts?target=${encodeURIComponent(targetName)}&source=${encodeURIComponent(sourceName)}&variant=${translationVariant}`, { 
              cache: 'no-store',
              signal: currentAbortController.signal
            })
            
            if (!res.ok) {
              throw new Error(`HTTP ${res.status}: ${res.statusText}`)
            }
            
            const data = await res.json()
            const newPrompt = (data && typeof data.prompt === 'string') ? data.prompt : ''
            
            if (!newPrompt) {
              throw new Error('Empty prompt received from server')
            }
            
            // Only update if request wasn't cancelled and is still the current request
            if (!currentAbortController.signal.aborted && abortControllerRef.current === currentAbortController) {
              setCachedPrompt(newPrompt)
              setPromptLanguages({ source: sourceLang, target: targetLang, variant: translationVariant })
              promptRef.current = newPrompt
            }
          } catch (error) {
            if (currentAbortController.signal.aborted) {
              setIsLanguageChanging(false)
              return
            }
            
            // Only show error if this is still the current request
            if (abortControllerRef.current !== currentAbortController) {
              setIsLanguageChanging(false)
              return
            }
            
            // Handle specific abort errors gracefully
            if (error instanceof Error && error.name === 'AbortError') {
              setIsLanguageChanging(false)
              return
            }
            
            onError(
              'Language Change Warning',
              'Failed to update translation settings. Please restart recording for correct translations.',
              'warning'
            )
            setIsLanguageChanging(false)
            return
          }
        }
        
        // Update ASR language and translation config
        const languageCode = getASRLanguageCode(sourceLang)
        if (recognitionRef.current && !abortControllerRef.current?.signal.aborted) {
          try {
            // Update ASR language first
            recognitionRef.current.setLanguage(languageCode)
            
            // Update translation configuration
            recognitionRef.current.setTranslationConfig({
              prompt: promptRef.current || '',
              sourceLanguage: languageCode,
              targetLanguage: targetName,
              geminiModelConfig: {
                model: 'gemini-2.5-flash-lite',
                temperature: 0.7,
                maxTokens: 1000,
                topP: 0.8
              }
            })
          } catch (err) {
            onError(
              'Configuration Error',
              'Failed to update translation settings. Please restart recording.',
              'warning'
            )
          }
        }
        
        setIsLanguageChanging(false)
      } catch (error) {
        setIsLanguageChanging(false)
        onError(
          'Language Change Error',
          'An unexpected error occurred during language change. Please restart recording.',
          'warning'
        )
      }
  }, [isRecording, promptLanguages, translationVariant, onError])

  // Handle language changes during recording with debouncing.
  // The timeout ID is tracked in languageChangeTimeoutRef so it can be cancelled
  // on effect cleanup (dep change or unmount). The old debounce() utility stored
  // the ID in a closure-local variable that became unreachable whenever useCallback
  // recreated the function, making cancellation impossible.
  useEffect(() => {
    if (!recognitionRef.current || !isRecording) return

    pendingLanguageChangeRef.current = { source: sourceLanguage, target: targetLanguage }

    if (languageChangeTimeoutRef.current) {
      clearTimeout(languageChangeTimeoutRef.current)
    }

    languageChangeTimeoutRef.current = setTimeout(() => {
      handleLanguageChange(sourceLanguage, targetLanguage)
    }, 500)

    return () => {
      if (languageChangeTimeoutRef.current) {
        clearTimeout(languageChangeTimeoutRef.current)
        languageChangeTimeoutRef.current = null
      }
    }
  }, [sourceLanguage, targetLanguage, isRecording, handleLanguageChange])

  // Start recording with language change protection
  const startRecording = useCallback(async () => {
    if (isRecording || isStarting || isLanguageChanging) return
    
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
      
      // CRITICAL: Validate source != target (can't translate language to itself)
      if (chosenSource === chosenTarget) {
        setIsStarting(false)
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
        
        try {
          // Cancel any existing request
          if (abortControllerRef.current) {
            abortControllerRef.current.abort()
          }
          
          abortControllerRef.current = new AbortController()
          const currentAbortController = abortControllerRef.current
          
          const res = await fetch(`/api/prompts?target=${encodeURIComponent(targetNameSnapshot)}&source=${encodeURIComponent(sourceNameSnapshot)}&variant=${translationVariant}`, { 
            cache: 'no-store',
            signal: currentAbortController.signal
          })
          
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`)
          }
          
          const data = await res.json()
          prompt = (data && typeof data.prompt === 'string') ? data.prompt : ''
          
          if (!prompt) {
            throw new Error('Empty prompt received from server')
          }
          
          // Only update if request wasn't cancelled and is still the current request
          if (!currentAbortController.signal.aborted && abortControllerRef.current === currentAbortController) {
            setCachedPrompt(prompt)
            setPromptLanguages({ source: chosenSource, target: chosenTarget, variant: translationVariant })
          }
        } catch (error) {
          // Don't show error if request was cancelled
          if (abortControllerRef.current?.signal.aborted) {
            setIsStarting(false)
            return
          }
          
          // Handle specific abort errors gracefully
          if (error instanceof Error && error.name === 'AbortError') {
            setIsStarting(false)
            return
          }
          
          const errorMsg = error instanceof Error ? error.message : 'Failed to fetch prompt'
          setIsStarting(false)
          onError(
            'Translation Setup Failed',
            `Could not load translation setting: ${errorMsg}. Please try again.`,
            'destructive'
          )
          return
        }
      }
      
      // STEP 2: Configure ASR language and translation BEFORE starting VoiceFlow
      if (!recognitionRef.current) {
        throw new Error('VoiceFlow recognition not initialized')
      }
      
      // CRITICAL: Update ASR language to match the currently selected source language
      const asrLangCode = getASRLanguageCode(chosenSource)
      recognitionRef.current.setLanguage(asrLangCode)
      
      promptRef.current = prompt
      
      try {
        recognitionRef.current.setTranslationConfig({
          prompt: prompt,
          sourceLanguage: asrLangCode,
          targetLanguage: targetNameSnapshot,
          geminiModelConfig: {
            model: 'gemini-2.5-flash-lite',
            temperature: 0.7,
            maxTokens: 1000,
            topP: 0.8
          }
        })
      } catch (err) {
        setIsStarting(false)
        onError(
          'Configuration Error',
          'Failed to configure translation. Please try again.',
          'destructive'
        )
        return
      }
      
      // Reset cross-session deduplication state so IDs and content hashes from a
      // previous session do not reject valid translations in this new session.
      resetValidationState()

      // STEP 3: Start session tracking (fire and forget - non-blocking)
      // This starts the session but we don't wait for it
      startUsageSession().catch((err) => {
        console.error('[Speech] Failed to start usage session:', err?.message || err)
      })
      
      // Re-validate subscription — async prompt fetch above can take several seconds
      // and the session may have expired or been capped in the meantime.
      if (!isValidForTranslation) {
        setIsStarting(false)
        setStatus({
          connected: false,
          status: 'error',
          message: 'Session expired during setup. Please try again.'
        })
        return
      }

      // STEP 4: NOW start VoiceFlow immediately with proper configuration
      setIsRecording(true)
      setIsStarting(false)
      recognitionRef.current.start()
      
    } catch (error) {
      
      isUserStoppedRef.current = true
      setIsRecording(false)
      setIsStarting(false)
      
      let errorMessage = 'Failed to start recording. '
      let errorDetails = ''
      let showDetailedError = false
      
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          if (isMobileBrowser()) {
            errorMessage = 'Microphone Permission Required'
            errorDetails = 'Please allow microphone access in your browser settings and refresh the page. On mobile, you may need to tap the microphone icon in your browser\'s address bar.'
            showDetailedError = true
          } else {
            errorMessage = 'Microphone Permission Required'
            errorDetails = 'Please allow microphone access:\n\n' +
              '1. Look for the microphone icon in your browser\'s address bar\n' +
              '2. Click it and select "Allow"\n' +
              '3. If you don\'t see the icon, check your browser settings\n' +
              '4. For embedded browsers: You may need to open this page in your system browser (Chrome, Firefox, etc.)\n\n' +
              'Then refresh the page and try again.'
            showDetailedError = true
          }
        } else if (error.name === 'NotFoundError') {
          if (isMobileBrowser()) {
            errorMessage = 'No Microphone Found'
            errorDetails = 'No microphone detected on this device. Please check your device\'s microphone settings.'
            showDetailedError = true
          } else {
            errorMessage = 'No Microphone Found'
            errorDetails = 'No microphone detected. Please check that:\n\n' +
              '1. Your microphone is properly connected\n' +
              '2. Your system recognizes the microphone\n' +
              '3. No other application is using the microphone'
            showDetailedError = true
          }
        } else if (error.name === 'NotSupportedError') {
          if (isMobileBrowser()) {
            errorMessage = 'Audio Not Supported'
            errorDetails = 'Your mobile browser doesn\'t support the required audio features. Please try using Chrome or Safari on your mobile device.'
            showDetailedError = true
          } else {
            errorMessage = 'Audio Not Supported'
            errorDetails = 'Your browser doesn\'t support the required audio features. Please try using a modern browser like Chrome, Firefox, or Edge.'
            showDetailedError = true
          }
        } else if (error.message && error.message.includes('Permission denied')) {
          errorMessage = 'Microphone Permission Denied'
          errorDetails = 'Microphone access was denied. Please check your browser settings and grant permission to use the microphone.'
          showDetailedError = true
        } else {
          errorMessage = error.message
        }
      }
      
      setStatus({ connected: false, status: 'error', message: errorMessage })
      
      if (showDetailedError && errorDetails) {
        onError(errorMessage, errorDetails, 'warning')
      }
    }
  }, [
    isRecording,
    isStarting,
    isLanguageChanging,
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

  // Stop recording with cleanup
  const stopRecording = useCallback(() => {
    if (!isRecording) return
    
    isUserStoppedRef.current = true
    setIsRecording(false)
    
    // Cancel any pending language changes
    if (languageChangeTimeoutRef.current) {
      clearTimeout(languageChangeTimeoutRef.current)
      languageChangeTimeoutRef.current = null
    }
    
    // Cancel any pending prompt requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    
    // Clear pending language change
    pendingLanguageChangeRef.current = null
    
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch (error) {
        // Silently handle stop errors
      }
    }
    
    // Clear any pending translations in the typing queue
    onClearTranslationQueue?.()
    
    endUsageSession()
    onInterimText('')
  }, [isRecording, endUsageSession, onInterimText, onClearTranslationQueue])

  return {
    isRecording,
    status,
    startRecording,
    stopRecording,
    recognitionRef,
    avgTranslationTime,
    isStarting,
    isPromptLoading: isPromptLoading || isLanguageChanging,
    promptError
  }
}

