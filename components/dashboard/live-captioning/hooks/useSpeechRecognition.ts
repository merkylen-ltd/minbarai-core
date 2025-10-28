import { useState, useEffect, useRef, useCallback } from 'react'
import { VoiceFlowAdapter } from '@/lib/voiceflow/adapter'
import { getVoiceFlowConfig } from '@/lib/voiceflow/config'
import { getASRLanguageCode, getLanguageName } from '@/constants/languages'
import { ConnectionStatus, TranslationVariant } from '../types'
import { checkVoiceFlowCompatibility, isMobileBrowser } from '../utils/browser-utils'
import { getLanguageSpecificConfig } from '../utils/language-config'
import { setupRecognitionHandlers } from '../utils/speech-recognition'

// Debounce utility for language changes
const debounce = <T extends (...args: any[]) => void>(
  func: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: NodeJS.Timeout | null = null
  
  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
    timeoutId = setTimeout(() => func(...args), delay)
  }
}

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
        setPromptLanguages({ source: currentSource, target: currentTarget })
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

  // Validate if cached prompt is valid for current language pair
  const isPromptValid = useCallback(() => {
    if (!cachedPrompt || !promptLanguages) {
      return false
    }
    
    // Check if cached prompt matches current language selection
    if (promptLanguages.source !== sourceLanguage || promptLanguages.target !== targetLanguage) {
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
  }, [isMounted])

  // Debounced language change handler for recording sessions
  const debouncedLanguageChange = useCallback(
    debounce(async (sourceLang: string, targetLang: string) => {
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
        
        // Check if we need a new prompt
        const needsNewPrompt = !promptLanguages || 
          promptLanguages.source !== sourceLang || 
          promptLanguages.target !== targetLang
        
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
              setPromptLanguages({ source: sourceLang, target: targetLang })
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
                temperature: 0.2,
                maxTokens: 1000,
                topP: 1.0
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
    }, 500), // 500ms debounce delay
    [isRecording, promptLanguages, translationVariant, onError]
  )

  // Handle language changes during recording with debouncing
  useEffect(() => {
    if (!recognitionRef.current || !isRecording) return
    
    // Store pending language change
    pendingLanguageChangeRef.current = { source: sourceLanguage, target: targetLanguage }
    
    // Clear any existing timeout
    if (languageChangeTimeoutRef.current) {
      clearTimeout(languageChangeTimeoutRef.current)
    }
    
    // Debounce the language change
    debouncedLanguageChange(sourceLanguage, targetLanguage)
  }, [sourceLanguage, targetLanguage, isRecording, debouncedLanguageChange])

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
            setPromptLanguages({ source: chosenSource, target: chosenTarget })
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
            temperature: 0.2,
            maxTokens: 1000,
            topP: 1.0
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
      
      // STEP 3: Start session tracking FIRST (fire and forget - truly non-blocking)
      // This starts the session but we don't wait for it
      Promise.resolve().then(() => {
        startUsageSession().catch(() => {
          // Background session start failed - silently handle
        })
      })
      
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
    isPromptLoading: isPromptLoading || isLanguageChanging,
    promptError
  }
}

