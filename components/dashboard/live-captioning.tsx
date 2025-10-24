'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Mic, MicOff, Download, Eye, EyeOff, Maximize2, Minimize2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LanguagePairSelector } from '@/components/ui/language-selector'
import LogoBrand from '@/components/ui/logo-brand'
import { LanguageProvider, useLanguage } from '@/lib/language-context'
import { CaptionData, ConnectionStatus } from '@/types'
import { useSessionData } from '@/lib/hooks/useSessionData'
import { useUsageTracking } from '@/lib/hooks/useUsageTracking'
import { useDialog } from '@/lib/hooks/useDialog'
import { 
  getASRLanguageCode, 
  getLanguageName
} from '@/constants/languages'
import { VoiceFlowAdapter } from '@/lib/voiceflow/adapter'
import { getVoiceFlowConfig, isVoiceFlowConfigured } from '@/lib/voiceflow/config'
import { AlertDialog } from '@/components/ui/dialog'
import DismissibleBanner from '@/components/ui/dismissible-banner'

// Import VoiceFlow types
import type { 
  SpeechRecognitionEvent, 
  SpeechRecognitionErrorEvent 
} from '@/lib/voiceflow/adapter'

// Mobile browser detection utility
function isMobileBrowser(): boolean {
  return /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

interface LiveCaptioningProps {
  userId: string
}

// VoiceFlow compatibility check
const checkVoiceFlowCompatibility = () => {
  if (typeof window === 'undefined') return { compatible: false, reason: 'SSR' }
  
  const hasMediaDevices = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
  const hasAudioContext = typeof window.AudioContext !== 'undefined' || typeof (window as any).webkitAudioContext !== 'undefined'
  const isConfigured = isVoiceFlowConfigured()
  
  return {
    voiceFlow: isConfigured,
    mediaDevices: hasMediaDevices,
    audioContext: hasAudioContext,
    isSupported: !!(isConfigured && hasMediaDevices && hasAudioContext)
  }
}

// Language-specific VoiceFlow configuration
const getLanguageSpecificConfig = (languageCode: string) => {
  const config: any = {}
  
  // Arabic variants
  if (languageCode === 'ar') {
    config.alternativeLanguageCodes = ['ar-SA', 'ar-EG', 'ar-MA', 'ar-AE', 'ar-JO', 'ar-LB', 'ar-KW', 'ar-QA', 'ar-TN', 'ar-DZ']
  }
  
  // English variants
  else if (languageCode === 'en') {
    config.alternativeLanguageCodes = ['en-US', 'en-GB', 'en-AU', 'en-CA', 'en-IN', 'en-IE', 'en-NZ', 'en-ZA']
  }
  
  // Chinese variants
  else if (languageCode === 'zh') {
    config.alternativeLanguageCodes = ['zh-CN', 'zh-TW', 'zh-HK']
  }
  
  // Spanish variants
  else if (languageCode === 'es') {
    config.alternativeLanguageCodes = ['es-ES', 'es-MX', 'es-AR', 'es-CO', 'es-PE', 'es-VE', 'es-CL', 'es-EC', 'es-GT', 'es-CU', 'es-BO', 'es-DO', 'es-HN', 'es-PY', 'es-SV', 'es-NI', 'es-CR', 'es-PA', 'es-UY', 'es-PR']
  }
  
  // Portuguese variants
  else if (languageCode === 'pt') {
    config.alternativeLanguageCodes = ['pt-BR', 'pt-PT']
  }
  
  // French variants
  else if (languageCode === 'fr') {
    config.alternativeLanguageCodes = ['fr-FR', 'fr-CA', 'fr-BE', 'fr-CH', 'fr-LU', 'fr-MC']
  }
  
  // German variants
  else if (languageCode === 'de') {
    config.alternativeLanguageCodes = ['de-DE', 'de-AT', 'de-CH', 'de-LU', 'de-LI']
  }
  
  // Russian variants
  else if (languageCode === 'ru') {
    config.alternativeLanguageCodes = ['ru-RU', 'ru-BY', 'ru-KZ', 'ru-KG', 'ru-MD', 'ru-UA']
  }
  
  // Hindi variants
  else if (languageCode === 'hi') {
    config.alternativeLanguageCodes = ['hi-IN']
  }
  
  // Japanese variants
  else if (languageCode === 'ja') {
    config.alternativeLanguageCodes = ['ja-JP']
  }
  
  // Korean variants
  else if (languageCode === 'ko') {
    config.alternativeLanguageCodes = ['ko-KR']
  }
  
  // Turkish variants
  else if (languageCode === 'tr') {
    config.alternativeLanguageCodes = ['tr-TR', 'tr-CY']
  }
  
  // Italian variants
  else if (languageCode === 'it') {
    config.alternativeLanguageCodes = ['it-IT', 'it-CH', 'it-SM', 'it-VA']
  }
  
  // Dutch variants
  else if (languageCode === 'nl') {
    config.alternativeLanguageCodes = ['nl-NL', 'nl-BE']
  }
  
  // Swedish variants
  else if (languageCode === 'sv') {
    config.alternativeLanguageCodes = ['sv-SE', 'sv-FI']
  }
  
  // Norwegian variants
  else if (languageCode === 'no') {
    config.alternativeLanguageCodes = ['nb-NO', 'nn-NO']
  }
  
  // Polish variants
  else if (languageCode === 'pl') {
    config.alternativeLanguageCodes = ['pl-PL']
  }
  
  // Czech variants
  else if (languageCode === 'cs') {
    config.alternativeLanguageCodes = ['cs-CZ']
  }
  
  // Hungarian variants
  else if (languageCode === 'hu') {
    config.alternativeLanguageCodes = ['hu-HU']
  }
  
  // Romanian variants
  else if (languageCode === 'ro') {
    config.alternativeLanguageCodes = ['ro-RO', 'ro-MD']
  }
  
  // Bulgarian variants
  else if (languageCode === 'bg') {
    config.alternativeLanguageCodes = ['bg-BG']
  }
  
  // Croatian variants
  else if (languageCode === 'hr') {
    config.alternativeLanguageCodes = ['hr-HR', 'hr-BA']
  }
  
  // Serbian variants
  else if (languageCode === 'sr') {
    config.alternativeLanguageCodes = ['sr-RS', 'sr-BA', 'sr-ME']
  }
  
  // Ukrainian variants
  else if (languageCode === 'uk') {
    config.alternativeLanguageCodes = ['uk-UA']
  }
  
  // Greek variants
  else if (languageCode === 'el') {
    config.alternativeLanguageCodes = ['el-GR', 'el-CY']
  }
  
  // Hebrew variants
  else if (languageCode === 'he') {
    config.alternativeLanguageCodes = ['he-IL']
  }
  
  // Thai variants
  else if (languageCode === 'th') {
    config.alternativeLanguageCodes = ['th-TH']
  }
  
  // Vietnamese variants
  else if (languageCode === 'vi') {
    config.alternativeLanguageCodes = ['vi-VN']
  }
  
  // Indonesian variants
  else if (languageCode === 'id') {
    config.alternativeLanguageCodes = ['id-ID']
  }
  
  // Malay variants
  else if (languageCode === 'ms') {
    config.alternativeLanguageCodes = ['ms-MY', 'ms-BN']
  }
  
  // Filipino variants
  else if (languageCode === 'fil') {
    config.alternativeLanguageCodes = ['fil-PH']
  }
  
  // Swahili variants
  else if (languageCode === 'sw') {
    config.alternativeLanguageCodes = ['sw-KE', 'sw-TZ', 'sw-UG']
  }
  
  // Persian variants
  else if (languageCode === 'fa') {
    config.alternativeLanguageCodes = ['fa-IR', 'fa-AF']
  }
  
  // Urdu variants
  else if (languageCode === 'ur') {
    config.alternativeLanguageCodes = ['ur-PK', 'ur-IN']
  }
  
  // Bengali variants
  else if (languageCode === 'bn') {
    config.alternativeLanguageCodes = ['bn-BD', 'bn-IN']
  }
  
  // Tamil variants
  else if (languageCode === 'ta') {
    config.alternativeLanguageCodes = ['ta-IN', 'ta-LK', 'ta-SG', 'ta-MY']
  }
  
  // Telugu variants
  else if (languageCode === 'te') {
    config.alternativeLanguageCodes = ['te-IN']
  }
  
  // Gujarati variants
  else if (languageCode === 'gu') {
    config.alternativeLanguageCodes = ['gu-IN']
  }
  
  // Kannada variants
  else if (languageCode === 'kn') {
    config.alternativeLanguageCodes = ['kn-IN']
  }
  
  // Malayalam variants
  else if (languageCode === 'ml') {
    config.alternativeLanguageCodes = ['ml-IN']
  }
  
  // Marathi variants
  else if (languageCode === 'mr') {
    config.alternativeLanguageCodes = ['mr-IN']
  }
  
  // Punjabi variants
  else if (languageCode === 'pa') {
    config.alternativeLanguageCodes = ['pa-Guru-IN', 'pa-Arab-PK']
  }
  
  // Sinhala variants
  else if (languageCode === 'si') {
    config.alternativeLanguageCodes = ['si-LK']
  }
  
  // Nepali variants
  else if (languageCode === 'ne') {
    config.alternativeLanguageCodes = ['ne-NP', 'ne-IN']
  }
  
  // Myanmar variants
  else if (languageCode === 'my') {
    config.alternativeLanguageCodes = ['my-MM']
  }
  
  // Khmer variants
  else if (languageCode === 'km') {
    config.alternativeLanguageCodes = ['km-KH']
  }
  
  // Lao variants
  else if (languageCode === 'lo') {
    config.alternativeLanguageCodes = ['lo-LA']
  }
  
  // Kazakh variants
  else if (languageCode === 'kk') {
    config.alternativeLanguageCodes = ['kk-KZ']
  }
  
  // Uzbek variants
  else if (languageCode === 'uz') {
    config.alternativeLanguageCodes = ['uz-UZ']
  }
  
  // Kyrgyz variants
  else if (languageCode === 'ky') {
    config.alternativeLanguageCodes = ['ky-KG']
  }
  
  // Tajik variants
  else if (languageCode === 'tg') {
    config.alternativeLanguageCodes = ['tg-TJ']
  }
  
  // Mongolian variants
  else if (languageCode === 'mn') {
    config.alternativeLanguageCodes = ['mn-MN']
  }
  
  // Georgian variants
  else if (languageCode === 'ka') {
    config.alternativeLanguageCodes = ['ka-GE']
  }
  
  // Armenian variants
  else if (languageCode === 'hy') {
    config.alternativeLanguageCodes = ['hy-AM']
  }
  
  // Azerbaijani variants
  else if (languageCode === 'az') {
    config.alternativeLanguageCodes = ['az-AZ']
  }
  
  // Estonian variants
  else if (languageCode === 'et') {
    config.alternativeLanguageCodes = ['et-EE']
  }
  
  // Latvian variants
  else if (languageCode === 'lv') {
    config.alternativeLanguageCodes = ['lv-LV']
  }
  
  // Lithuanian variants
  else if (languageCode === 'lt') {
    config.alternativeLanguageCodes = ['lt-LT']
  }
  
  // Finnish variants
  else if (languageCode === 'fi') {
    config.alternativeLanguageCodes = ['fi-FI']
  }
  
  // Danish variants
  else if (languageCode === 'da') {
    config.alternativeLanguageCodes = ['da-DK']
  }
  
  // Icelandic variants
  else if (languageCode === 'is') {
    config.alternativeLanguageCodes = ['is-IS']
  }
  
  // Slovak variants
  else if (languageCode === 'sk') {
    config.alternativeLanguageCodes = ['sk-SK']
  }
  
  // Slovenian variants
  else if (languageCode === 'sl') {
    config.alternativeLanguageCodes = ['sl-SI']
  }
  
  // Macedonian variants
  else if (languageCode === 'mk') {
    config.alternativeLanguageCodes = ['mk-MK']
  }
  
  // Albanian variants
  else if (languageCode === 'sq') {
    config.alternativeLanguageCodes = ['sq-AL', 'sq-XK', 'sq-MK']
  }
  
  // Maltese variants
  else if (languageCode === 'mt') {
    config.alternativeLanguageCodes = ['mt-MT']
  }
  
  // Welsh variants
  else if (languageCode === 'cy') {
    config.alternativeLanguageCodes = ['cy-GB']
  }
  
  // Irish variants
  else if (languageCode === 'ga') {
    config.alternativeLanguageCodes = ['ga-IE']
  }
  
  // Basque variants
  else if (languageCode === 'eu') {
    config.alternativeLanguageCodes = ['eu-ES']
  }
  
  // Catalan variants
  else if (languageCode === 'ca') {
    config.alternativeLanguageCodes = ['ca-ES', 'ca-AD', 'ca-FR', 'ca-IT']
  }
  
  // Galician variants
  else if (languageCode === 'gl') {
    config.alternativeLanguageCodes = ['gl-ES']
  }
  
  // Afrikaans variants
  else if (languageCode === 'af') {
    config.alternativeLanguageCodes = ['af-ZA']
  }
  
  // Amharic variants
  else if (languageCode === 'am') {
    config.alternativeLanguageCodes = ['am-ET']
  }
  
  // Hausa variants
  else if (languageCode === 'ha') {
    config.alternativeLanguageCodes = ['ha-NG', 'ha-GH']
  }
  
  // Yoruba variants
  else if (languageCode === 'yo') {
    config.alternativeLanguageCodes = ['yo-NG']
  }
  
  // Igbo variants
  else if (languageCode === 'ig') {
    config.alternativeLanguageCodes = ['ig-NG']
  }
  
  // Zulu variants
  else if (languageCode === 'zu') {
    config.alternativeLanguageCodes = ['zu-ZA']
  }
  
  // Xhosa variants
  else if (languageCode === 'xh') {
    config.alternativeLanguageCodes = ['xh-ZA']
  }
  
  // Sesotho variants
  else if (languageCode === 'st') {
    config.alternativeLanguageCodes = ['st-ZA', 'st-LS']
  }
  
  // Shona variants
  else if (languageCode === 'sn') {
    config.alternativeLanguageCodes = ['sn-ZW']
  }
  
  // Somali variants
  else if (languageCode === 'so') {
    config.alternativeLanguageCodes = ['so-SO', 'so-ET', 'so-KE', 'so-DJ']
  }
  
  // Pashto variants
  else if (languageCode === 'ps') {
    config.alternativeLanguageCodes = ['ps-AF', 'ps-PK']
  }
  
  // Sindhi variants
  else if (languageCode === 'sd') {
    config.alternativeLanguageCodes = ['sd-PK', 'sd-IN']
  }
  
  // Javanese variants
  else if (languageCode === 'jv') {
    config.alternativeLanguageCodes = ['jv-ID']
  }
  
  // Sundanese variants
  else if (languageCode === 'su') {
    config.alternativeLanguageCodes = ['su-ID']
  }
  
  // Cebuano variants
  else if (languageCode === 'ceb') {
    config.alternativeLanguageCodes = ['ceb-PH']
  }
  
  // Chichewa variants
  else if (languageCode === 'ny') {
    config.alternativeLanguageCodes = ['ny-MW', 'ny-ZW']
  }
  
  // Kinyarwanda variants
  else if (languageCode === 'rw') {
    config.alternativeLanguageCodes = ['rw-RW']
  }
  
  // Malagasy variants
  else if (languageCode === 'mg') {
    config.alternativeLanguageCodes = ['mg-MG']
  }
  
  // Samoan variants
  else if (languageCode === 'sm') {
    config.alternativeLanguageCodes = ['sm-WS', 'sm-AS']
  }
  
  // Maori variants
  else if (languageCode === 'mi') {
    config.alternativeLanguageCodes = ['mi-NZ']
  }
  
  // Fijian variants
  else if (languageCode === 'fj') {
    config.alternativeLanguageCodes = ['fj-FJ']
  }
  
  // Hawaiian variants
  else if (languageCode === 'haw') {
    config.alternativeLanguageCodes = ['haw-US']
  }
  
  // Yiddish variants
  else if (languageCode === 'yi') {
    config.alternativeLanguageCodes = ['yi-XX']
  }
  
  return config
}


// Internal component that uses language context
function LiveCaptioningInternal({ userId }: LiveCaptioningProps) {
  // Core state
  const [isRecording, setIsRecording] = useState(false)
  const [sourceText, setSourceText] = useState('')
  const [targetText, setTargetText] = useState('')
  const [interimText, setInterimText] = useState('')
  const [status, setStatus] = useState<ConnectionStatus>({
    connected: false,
    status: 'disconnected'
  })

  
  // UI state
  const [textSize, setTextSize] = useState(18)
  const [isMounted, setIsMounted] = useState(false)
  const [showSourcePanel, setShowSourcePanel] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [avgTranslationTime, setAvgTranslationTime] = useState(0)
  const translationTimesRef = useRef<number[]>([])
  const lastFinalResultTimeRef = useRef<number | null>(null)
  const lastResultEventStartRef = useRef<number | null>(null)


  // Language context
  const { 
    state, 
    setSourceLanguage, 
    setTargetLanguage, 
    swapLanguages 
  } = useLanguage()

  // Session data hook for optimized validation
  const { 
    sessionData, 
    isLoading: isSessionLoading, 
    error: sessionError, 
    isValidForTranslation, 
    sessionTimeRemaining, 
    totalUsageMinutes,
    fetchSessionData 
  } = useSessionData()

  // Usage tracking hook for ping-based session management
  const {
    isActive: isUsageActive,
    sessionId: usageSessionId,
    status: usageStatus,
    capAt,
    startSession: startUsageSession,
    stopSession: stopUsageSession
  } = useUsageTracking()

  // Dialog hook for user notifications
  const { alertDialog, showAlert, closeAlert } = useDialog()

  // Refs for speech recognition management
  const recognitionRef = useRef<VoiceFlowAdapter | null>(null)
  const promptRef = useRef<string>('')
  const sourceScrollRef = useRef<HTMLDivElement>(null)
  const targetScrollRef = useRef<HTMLDivElement>(null)
  
  // Simple state tracking
  const isUserStoppedRef = useRef<boolean>(false)

  // Set mounted flag to prevent hydration mismatches
  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Utility function for scrolling
  const scrollToBottom = useCallback((ref: React.RefObject<HTMLDivElement>) => {
    if (ref.current) {
      ref.current.scrollTop = ref.current.scrollHeight
    }
  }, [])

  // Enhanced translation handler with better error handling
  // Removed: HTTP translation path. Voiceflow handles translation server-side.
  const handleTranslation = useCallback((_text: string) => {}, [])


  // Session management (now handled by usage tracking hook)
  const startSession = useCallback(async () => {
    try {
      await startUsageSession()
    } catch (error) {
      console.error('Error starting usage session:', error)
      setStatus({ 
        connected: false, 
        status: 'error', 
        message: 'Failed to start session. Please refresh and try again.' 
      })
    }
  }, [startUsageSession])

  const endSession = useCallback(async () => {
    try {
      await stopUsageSession()
      
      // Refresh session data to get updated usage totals
      setTimeout(() => {
        if (fetchSessionData) {
          fetchSessionData()
        }
      }, 1000) // Wait 1 second for backend to process
    } catch (error) {
      console.warn('Error ending usage session:', error)
    }
  }, [stopUsageSession, fetchSessionData])

  // Helper function to set up recognition event handlers
  const setupRecognitionHandlers = useCallback((recognition: VoiceFlowAdapter) => {
    recognition.onstart = () => {
      setStatus({ connected: true, status: 'connected' })
    }

    recognition.onend = () => {
      
      // VoiceFlow should handle continuous streaming internally
      // If onend is called, it means either user stopped or there was an error
      if (isUserStoppedRef.current) {
        setStatus({ connected: false, status: 'disconnected' })
      } else {
        setStatus({ 
          connected: false, 
          status: 'error', 
          message: 'Speech recognition ended. Click Start to resume.' 
        })
        setIsRecording(false)
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
        setIsRecording(false)
        isUserStoppedRef.current = true
      } else if (event.error === 'network') {
        errorMessage = 'Connection Error'
        errorDetails = 'Unable to connect to speech recognition service. Please check your internet connection and try again.'
        variant = 'warning'
      } else if (event.error === 'auth') {
        errorMessage = 'Authentication Failed'
        errorDetails = 'VoiceFlow authentication failed. Please contact support if this issue persists.'
        variant = 'destructive'
      } else if (event.error === 'service') {
        errorMessage = 'Service Temporarily Unavailable'
        errorDetails = 'The speech recognition service is temporarily unavailable. Please try again in a few moments.'
        variant = 'warning'
      } else {
        errorMessage = 'Speech Recognition Error'
        errorDetails = `An unexpected error occurred: ${event.error}. Please try again or contact support if the problem persists.`
        variant = 'destructive'
      }
      
        setStatus({ 
          connected: false, 
          status: 'error', 
        message: errorMessage 
      })
      
      // Show user-friendly notification
      showAlert(
        errorMessage,
        errorDetails,
        {
          variant,
          buttonText: 'OK'
        }
      )
    }

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      // Metrics: measure handler processing time
      lastResultEventStartRef.current = performance.now()
      let interimTranscript = ''
      let finalTranscript = ''

      // Process results faster
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        const confidence = event.results[i][0].confidence
        const isFinal = event.results[i].isFinal
        
        // CRITICAL: Filter out empty final transcripts to prevent clearing display
        if (isFinal && (!transcript || transcript.trim() === '')) {
          continue;
        }
        
        if (isFinal) {
          finalTranscript += transcript
          // Metrics: mark when final transcript was observed
          lastFinalResultTimeRef.current = performance.now()
        } else {
          interimTranscript += transcript
        }
      }

      // Update UI immediately
      setInterimText(interimTranscript)

      if (finalTranscript) {
        setSourceText(prev => prev + ' ' + finalTranscript)
        // Immediate scroll without timeout
        scrollToBottom(sourceScrollRef)
        
        // Translation is handled by Voiceflow server on final transcripts
        setInterimText('')
        // Metrics: simple caption processing latency (handler time)
        if (lastResultEventStartRef.current != null) {
          const captionProcessingMs = performance.now() - lastResultEventStartRef.current
          console.log('[Metrics] Caption handler processing time (ms):', Math.round(captionProcessingMs))
        }
      } else if (interimTranscript) {
        // Immediate scroll for interim text
        scrollToBottom(sourceScrollRef)
      }
    }
    
    // Handle translation events from Voiceflow
    recognition.ontranslation = (e: any) => {
      if (!e || !e.translated) {
        console.warn('[Live Captioning] Translation event missing translated text:', e)
        return
      }
      // Metrics: measure translation latency from last final transcript to translation arrival
      if (lastFinalResultTimeRef.current != null) {
        const now = performance.now()
        const deltaMs = now - lastFinalResultTimeRef.current
        translationTimesRef.current.push(deltaMs)
        // keep last 20 samples
        if (translationTimesRef.current.length > 20) translationTimesRef.current.shift()
        const avg = translationTimesRef.current.reduce((a, b) => a + b, 0) / translationTimesRef.current.length
        setAvgTranslationTime(Math.round(avg))
        console.log('[Metrics] Translation latency (ms):', Math.round(deltaMs), '| avg (last 20):', Math.round(avg))
      }
      
      setTargetText(prev => (prev ? prev + '\n' : '') + e.translated)
      scrollToBottom(targetScrollRef)
    }
  }, [state.sourceLanguage, scrollToBottom, handleTranslation, showAlert])

  // Enhanced start recording with intelligent error handling
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
      
      // Show user-friendly notification
      showAlert(
        errorMessage,
        errorDetails,
        {
          variant: 'warning',
          buttonText: 'OK'
        }
      )
      return
    }
    
    try {
      // Check if we're in browser environment
      if (typeof window === 'undefined' || !navigator.mediaDevices) {
        throw new Error('Media devices not available')
      }
      
      // Check microphone permission with mobile-friendly constraints
      let stream: MediaStream;
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
        console.warn('[Live Captioning] Exact audio constraints failed, trying ideal constraints:', error);
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
      await startSession()
      
      // Wait for usage tracking to initialize (the ping will be sent)
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Start speech recognition
      if (recognitionRef.current) {
        
        setIsRecording(true)
        try {
          // Snapshot the UI language selections at click time to avoid race conditions
          const chosenSource = state.sourceLanguage
          const chosenTarget = state.targetLanguage
          const sourceNameSnapshot = getLanguageName(chosenSource)
          const targetNameSnapshot = getLanguageName(chosenTarget)

          // Load prompt template from server using the snapshotted languages
          const res = await fetch(`/api/prompts?target=${encodeURIComponent(targetNameSnapshot)}&source=${encodeURIComponent(sourceNameSnapshot)}`, { cache: 'no-store' })
          const data = await res.json()
          const prompt = (data && typeof data.prompt === 'string') ? data.prompt : ''
          
          // Set translation config via adapter before start
          // IMPORTANT: sourceLanguage MUST match the ASR languageCode (what you're actually speaking)
          if (prompt.trim()) {
            const targetName = targetNameSnapshot
            const sourceLangBase = chosenSource // e.g., 'ar', 'en'
            const targetLangBase = chosenTarget // e.g., 'en', 'ar'
            const asrLangCode = (recognitionRef.current as any).lang || getASRLanguageCode(chosenSource) // The actual language being recognized
            
            // CRITICAL: Validate source != target (can't translate language to itself)
            if (sourceLangBase === targetLangBase) {
              console.error('[Live Captioning] Source and target languages are the same! Translation disabled.')
              showAlert(
                'Invalid Language Selection',
                `You cannot translate ${getLanguageName(sourceLangBase)} to ${getLanguageName(targetLangBase)}. Please select a different target language.`,
                { variant: 'warning', buttonText: 'OK' }
              )
              // Continue without translation
              recognitionRef.current.start()
              console.log('[Live Captioning] VoiceFlow recognition started without translation')
              return
            }
            
            // Ensure the prompt contains the required placeholders per README
            const hasTranscript = /\{\s*transcript\s*\}/.test(prompt)
            const hasSource = /\{\s*sourceLanguage\s*\}/.test(prompt)
            const hasTarget = /\{\s*targetLanguage\s*\}/.test(prompt)
            // Use server-provided prompt only; no inline fallback
            const effectivePrompt = prompt
            // Save for dynamic updates
            promptRef.current = effectivePrompt

            
            
            // Configure translation via adapter pre-start (included in start message)
            try {
              recognitionRef.current.setTranslationConfig({
                prompt: effectivePrompt,
                sourceLanguage: asrLangCode,
                targetLanguage: targetName,
                geminiModelConfig: {
                  model: 'gemini-2.5-flash-lite',
                  temperature: 0.7,
                  maxTokens: 1000,
                  topP: 0.8
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
      
      // Reset refs on error
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
          errorMessage = error.message // Use the error message directly
        }
      }
      
      setStatus({ connected: false, status: 'error', message: errorMessage })
      
      // Show mobile-specific alert if on mobile
      if (isMobileBrowser() && errorDetails) {
        showAlert(
          errorMessage,
          errorDetails,
          {
            variant: 'warning',
            buttonText: 'OK'
          }
        )
      }
    }
  }, [isRecording, isValidForTranslation, startSession, sessionData, totalUsageMinutes, state, showAlert])


  // Enhanced stop recording
  const stopRecording = useCallback(() => {
    if (!isRecording) {
      return
    }
    
    
    isUserStoppedRef.current = true
    setIsRecording(false)
    
    
    // Stop recognition
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
        
      } catch (error) {
        console.warn('[Live Captioning] Error stopping recognition:', error)
      }
    }
    
    // End session
    endSession()
    
    // Clear interim text
    setInterimText('')
    
    
  }, [isRecording, endSession])


  // Session loading is now handled by usage tracking hook

  // Handle language changes during recording
  useEffect(() => {
    if (recognitionRef.current && isRecording) {
      const languageCode = getASRLanguageCode(state.sourceLanguage)
      const languageConfig = getLanguageSpecificConfig(state.sourceLanguage)
      
      // Update the recognition language
      recognitionRef.current.setLanguage(languageCode)
    }
  }, [state.sourceLanguage, isRecording])

  // Initialize speech recognition when component mounts (only once)
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
      const languageCode = getASRLanguageCode(state.sourceLanguage)
      const languageConfig = getLanguageSpecificConfig(state.sourceLanguage)
      
      
      const recognition = new VoiceFlowAdapter(config, {
        // Multi-language optimized settings
        model: 'latest_long',
        wordTimeOffsets: true,
        spokenPunctuation: true,
        endpointing: { singleUtterance: false },
        emitStability: false,
        phraseHints: ["MinbarAI"],
        // Language-specific optimizations
        ...getLanguageSpecificConfig(state.sourceLanguage),
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

        // Set up event handlers using the helper function
        setupRecognitionHandlers(recognition)

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
      // CRITICAL FIX: Only cleanup if component is actually unmounting, not if dependencies changed
      // Check if the component is still mounted and recording is still active
      if (recognitionRef.current) {
        try {
          // Don't stop if we're still recording - only stop on actual unmount
          // The dependency array no longer includes handleTranslation/scrollToBottom to prevent premature cleanup
          
          recognitionRef.current.stop()
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    }
  }, [isMounted]) // CRITICAL: Remove handleTranslation and scrollToBottom from dependencies

  // Update recognition language when source language changes
  useEffect(() => {
    if (recognitionRef.current && isRecording) {
      const languageCode = getASRLanguageCode(state.sourceLanguage)
      // Update ASR language
      recognitionRef.current.setLanguage(languageCode)
      // Also update translation source to keep server in sync
      try {
        recognitionRef.current.enableTranslation({
          prompt: promptRef.current || '',
          sourceLanguage: languageCode,
          targetLanguage: getLanguageName(state.targetLanguage),
          geminiModelConfig: {
            model: 'gemini-2.5-flash-lite',
            temperature: 0.7,
            maxTokens: 1000,
            topP: 0.8
          }
        })
      } catch (err) {
        console.warn('[VoiceFlow] Failed to update translation source language dynamically:', err)
      }
    }
  }, [state.sourceLanguage, isRecording])

  // Update translation target language dynamically
  useEffect(() => {
    if (recognitionRef.current && isRecording) {
      try {
        recognitionRef.current.enableTranslation({
          prompt: promptRef.current || '',
          sourceLanguage: getASRLanguageCode(state.sourceLanguage),
          targetLanguage: getLanguageName(state.targetLanguage),
          geminiModelConfig: {
            model: 'gemini-2.5-flash-lite',
            temperature: 0.7,
            maxTokens: 1000,
            topP: 0.8
          }
        })
      } catch (err) {
        console.warn('[VoiceFlow] Failed to update translation target language dynamically:', err)
      }
    }
  }, [state.targetLanguage, isRecording])

  // Monitor usage status changes and auto-stop if session becomes inactive DURING recording
  useEffect(() => {
    // CRITICAL FIX: Only stop for definitive end states, not temporary status changes
    // This prevents false triggers during normal operation
    if (isRecording && usageSessionId && usageStatus && 
        (usageStatus === 'expired' || usageStatus === 'capped' || usageStatus === 'closed')) {
      
      
      // Update refs before stopping
      isUserStoppedRef.current = true
      
      stopRecording()
      
      // Show appropriate message based on status
      let message = 'Session has been stopped.'
      if (usageStatus === 'expired') {
        message = 'Your session has expired due to inactivity. Please start a new session to continue.'
      } else if (usageStatus === 'capped') {
        message = 'Your session has reached the maximum duration limit (3 hours). Please start a new session to continue.'
      } else if (usageStatus === 'closed') {
        message = 'Your session has been closed. Please start a new session to continue.'
      }
      
      setStatus({
        connected: false,
        status: 'error',
        message
      })
    }
  }, [isRecording, usageSessionId, usageStatus, stopRecording])

  // Keyboard shortcuts
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Only handle shortcuts when not typing in input fields
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
      return
    }

    switch (event.key.toLowerCase()) {
      case 'h':
        event.preventDefault()
        setShowSourcePanel(!showSourcePanel)
        break
      case 'f':
        event.preventDefault()
        setIsFullscreen(!isFullscreen)
        break
      case ' ':
        event.preventDefault()
        if (isRecording) {
          stopRecording()
        } else {
          startRecording()
        }
        break
    }
  }, [showSourcePanel, isFullscreen, isRecording, startRecording, stopRecording])

  // Keyboard shortcuts only
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleKeyDown])

  // Utility functions
  const clearTranscription = useCallback(() => {
    setSourceText('')
    setTargetText('')
    setInterimText('')
  }, [])

  const downloadTranscript = useCallback(() => {
    const transcript = `MinbarAI Session Transcript
Generated: ${isMounted ? new Date().toLocaleDateString() : 'Loading...'} ${isMounted ? new Date().toLocaleTimeString() : 'Loading...'}

${getLanguageName(state.sourceLanguage).toUpperCase()}:
${sourceText}

${getLanguageName(state.targetLanguage).toUpperCase()}:
${targetText}
`
    const blob = new Blob([transcript], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `minberai-transcript-${state.sourceLanguage}-to-${state.targetLanguage}-${isMounted ? new Date().toISOString().split('T')[0] : 'session'}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [sourceText, targetText, state.sourceLanguage, state.targetLanguage, isMounted])

  // Auto-scroll when text size changes
  useEffect(() => {
    if (sourceText || targetText) {
      setTimeout(() => {
        scrollToBottom(sourceScrollRef)
        scrollToBottom(targetScrollRef)
      }, 100)
    }
  }, [textSize, sourceText, targetText, scrollToBottom])

  // Mouse wheel handler for font size control in fullscreen mode
  const handleWheel = useCallback((e: WheelEvent) => {
    if (!isFullscreen) return
    
    
    
    // Prevent default scroll behavior
    e.preventDefault()
    e.stopPropagation()
    
    // Check if Ctrl/Cmd key is held for more precise control
    const isCtrlHeld = e.ctrlKey || e.metaKey
    const delta = e.deltaY
    
    // Calculate font size change
    const changeAmount = isCtrlHeld ? 1 : 3 // Smaller increments with Ctrl/Cmd
    const newSize = delta > 0 
      ? Math.max(12, textSize - changeAmount) // Scroll down = decrease size
      : Math.min(120, textSize + changeAmount) // Scroll up = increase size
    
    
    
    if (newSize !== textSize) {
      setTextSize(newSize)
    }
  }, [isFullscreen, textSize])

  // Ref for the fullscreen container
  const fullscreenRef = useRef<HTMLDivElement>(null)

  // Add wheel event listener when in fullscreen mode
  useEffect(() => {
    if (isFullscreen && fullscreenRef.current) {
      const container = fullscreenRef.current
      
      container.addEventListener('wheel', handleWheel, { passive: false })
      return () => {
        
        container.removeEventListener('wheel', handleWheel)
      }
    }
  }, [isFullscreen, handleWheel])

  // Prevent hydration mismatches
  if (!isMounted) {
    return (
      <div className="space-y-6">
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg shadow-lg p-4">
          <div className="text-center text-neutral-400">Loading...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Dismissible Beta Banner */}
      <DismissibleBanner 
        variant="beta"
        title="Live Captioning Beta"
        message="Real-time translation in development • Some features may be limited"
        storageKey="dashboard-beta-banner-dismissed"
      />

      {/* Control Panel */}
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg shadow-lg p-4">
        {/* Header Section */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            <h2 className="text-lg font-heading text-white">Control Panel</h2>
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${
                status.connected ? 'bg-green-400' : 'bg-red-400'
              }`} />
              <span className="text-xs text-neutral-400">
                {status.connected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>
          
          {/* Session Status */}
          <div className="flex items-center space-x-4">
            {isSessionLoading ? (
              <div className="text-sm text-neutral-400">Loading...</div>
            ) : sessionData ? (
              <div className="flex items-center space-x-3">
                <div className="bg-primary-700/30 border border-accent-500/20 rounded-lg px-3 py-1.5">
                  <div className="text-sm text-neutral-300">
                    <span className="font-heading text-white">
                      {sessionTimeRemaining <= 0 ? '0h 0m' : `${Math.floor(sessionTimeRemaining / 60)}h ${sessionTimeRemaining % 60}m`}
                    </span>
                    <span className="ml-1">remaining</span>
                  </div>
                </div>
                {/* Only show non-active status if we have a session ID (means it was actively used) */}
                {usageStatus && usageStatus !== 'active' && !isRecording && usageSessionId && (
                  <div className="text-sm text-orange-400 font-body bg-orange-500/10 border border-orange-500/20 rounded-lg px-2 py-1">
                    Session {usageStatus}
                  </div>
                )}
                {/* Show active indicator when recording */}
                {isRecording && isUsageActive && (
                  <div className="text-sm text-green-400 font-body bg-green-500/10 border border-green-500/20 rounded-lg px-2 py-1 flex items-center gap-1">
                    <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                    <span>Session active</span>
                  </div>
                )}
                {sessionTimeRemaining <= 30 && sessionTimeRemaining > 0 && (
                  <div className="text-sm text-yellow-400 font-body bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-2 py-1">
                    {sessionTimeRemaining}m left
                  </div>
                )}
                {sessionTimeRemaining <= 0 && (
                  <div className="text-sm text-red-400 font-body bg-red-500/10 border border-red-500/20 rounded-lg px-2 py-1">
                    Limit reached
                  </div>
                )}
                {!isValidForTranslation && (
                  <div className="text-sm text-red-400 font-body bg-red-500/10 border border-red-500/20 rounded-lg px-2 py-1">
                    Invalid subscription
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-neutral-400">No session</div>
            )}
          </div>
        </div>

        {/* Controls Section - Responsive Design */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-4 lg:gap-6">
          {/* Left Side - Primary Controls */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={isRecording ? stopRecording : startRecording}
              className={`inline-flex items-center justify-center px-4 h-12 text-sm font-body rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] md:min-h-0 ${
                isRecording 
                  ? 'bg-red-500 hover:bg-red-600 text-white focus:ring-red-500 shadow-lg hover:shadow-xl' 
                  : 'bg-accent-500 hover:bg-accent-400 text-white focus:ring-accent-500 shadow-lg hover:shadow-xl'
              }`}
            >
              {isRecording ? <MicOff className="h-4 w-4 mr-2" /> : <Mic className="h-4 w-4 mr-2" />}
              <span>{isRecording ? 'Stop' : 'Start'}</span>
            </button>

            <button
              onClick={clearTranscription}
              className="inline-flex items-center justify-center px-4 h-12 text-sm font-body rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 bg-white/10 text-white border border-white/20 hover:bg-white/20 hover:border-white/30 focus:ring-white/50 min-h-[44px] md:min-h-0"
            >
              <span>Clear</span>
            </button>

            {/* Panel Visibility Toggle */}
            <button
              onClick={() => setShowSourcePanel(!showSourcePanel)}
              className={`inline-flex items-center justify-center px-4 h-12 text-sm font-body rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 min-h-[44px] md:min-h-0 ${
                showSourcePanel 
                  ? 'bg-accent-500/20 text-accent-400 border border-accent-500/30 hover:bg-accent-500/30 focus:ring-accent-500' 
                  : 'bg-white/10 text-white border border-white/20 hover:bg-white/20 hover:border-white/30 focus:ring-white/50'
              }`}
              title={`${showSourcePanel ? 'Hide' : 'Show'} source panel (Press H)`}
            >
              {showSourcePanel ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
              <span className="hidden sm:inline">{showSourcePanel ? 'Hide Source' : 'Show Source'}</span>
            </button>
          </div>

          {/* Center - Language Selection */}
          <div className="flex-1 min-w-0">
            <div className="bg-primary-700/30 border border-accent-500/20 rounded-lg px-4 py-3 h-12 flex items-center">
              <LanguagePairSelector
                sourceLanguage={state.sourceLanguage}
                targetLanguage={state.targetLanguage}
                onSourceChange={setSourceLanguage}
                onTargetChange={setTargetLanguage}
                onSwap={swapLanguages}
                disabled={isRecording}
                showPopularOnly={false}
                className="min-w-0 w-full"
              />
            </div>
          </div>

          {/* Right Side - Settings & Actions */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Text Size Control */}
            <div className="bg-primary-700/30 border border-accent-500/20 rounded-lg px-4 py-3 h-12 flex items-center">
              <div className="flex items-center space-x-2">
                <span className="text-sm text-neutral-400 font-display">A</span>
                <input
                  type="range"
                  min="12"
                  max="120"
                  value={textSize}
                  onChange={(e) => setTextSize(Number(e.target.value))}
                  className="w-16 h-2 bg-white/20 rounded-lg appearance-none cursor-pointer slider-thumb"
                  style={{
                    background: `linear-gradient(to right, #55a39a 0%, #55a39a ${((textSize - 12) / (120 - 12)) * 100}%, rgba(255,255,255,0.2) ${((textSize - 12) / (120 - 12)) * 100}%, rgba(255,255,255,0.2) 100%)`
                  }}
                />
                <span className="text-sm text-neutral-400 font-display">A</span>
                <span className="text-sm text-neutral-300 font-mono font-heading">{textSize}px</span>
                {isFullscreen && (
                  <span className="text-xs text-neutral-500 ml-2 opacity-70">
                    (scroll wheel)
                  </span>
                )}
              </div>
            </div>

            {/* Fullscreen Toggle */}
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className={`inline-flex items-center justify-center px-4 h-12 text-sm font-body rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 min-h-[44px] md:min-h-0 ${
                isFullscreen 
                  ? 'bg-accent-500/20 text-accent-400 border border-accent-500/30 hover:bg-accent-500/30 focus:ring-accent-500' 
                  : 'bg-white/10 text-white border border-white/20 hover:bg-white/20 hover:border-white/30 focus:ring-white/50'
              }`}
              title={`${isFullscreen ? 'Exit' : 'Enter'} fullscreen mode (Press F)`}
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4 mr-2" /> : <Maximize2 className="h-4 w-4 mr-2" />}
              <span className="hidden sm:inline">{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
            </button>

            {/* Download Button */}
            <button
              onClick={downloadTranscript}
              className="inline-flex items-center justify-center px-4 h-12 text-sm font-body rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed bg-white/10 text-white border border-white/20 hover:bg-white/20 hover:border-white/30 focus:ring-white/50 min-h-[44px] md:min-h-0"
              disabled={!sourceText && !targetText}
            >
              <Download className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Download</span>
            </button>
          </div>
        </div>
      </div>

      {/* Live Transcription Display - Responsive Layout */}
      <div 
        ref={fullscreenRef}
        className={`transition-all duration-500 ease-in-out ${
          isFullscreen ? 'fixed inset-0 z-50 bg-black/95 backdrop-blur-sm flex flex-col safe-area-inset-top safe-area-inset-bottom' : ''
        }`}>
        <div className={`${isFullscreen ? 'flex-1 flex flex-col p-responsive-lg overflow-hidden' : ''}`}>
          <div className={`transition-all duration-500 ease-in-out ${
            showSourcePanel ? 'space-y-4 md:space-y-6' : ''
          } ${isFullscreen ? 'flex-1 flex flex-col' : ''}`}>
            {/* Source Language Panel */}
            {showSourcePanel && (
              <div className={`bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg shadow-lg p-4 md:p-6 transition-all duration-500 ease-in-out ${
                isFullscreen ? 'flex-1 flex flex-col' : ''
              }`}>
              <div className="relative flex items-center justify-center mb-4">
                <div className="absolute left-0">
                  <LogoBrand size="md" variant="subtle" className="opacity-60 hover:opacity-80 transition-opacity duration-200" />
                </div>
                <h3 className="text-lg font-heading text-white">
                  {state.sourceConfig.name} Original
                </h3>
                <div className="absolute right-0 flex items-center space-x-2">
                  <div className="w-2 h-2 rounded-full bg-accent-400 animate-pulse" />
                  <span className="text-sm text-neutral-400">Live</span>
                  {state.sourceConfig.isRTL && (
                    <span className="text-xs bg-accent-500/20 text-accent-400 border border-accent-500/30 px-2 py-1 rounded">RTL</span>
                  )}
                </div>
              </div>
              
              <div
                ref={sourceScrollRef}
                className={`${isFullscreen ? 'flex-1 overflow-y-auto' : 'h-96 overflow-y-auto'} p-4 bg-white/5 rounded-lg border border-white/10 leading-relaxed custom-scrollbar ${
                  state.sourceConfig.family === 'arabic' ? 'font-arabic' :
                  state.sourceConfig.family === 'chinese' ? 'font-chinese' :
                  state.sourceConfig.family === 'cyrillic' ? 'font-cyrillic' :
                  state.sourceConfig.family === 'devanagari' ? 'font-devanagari' :
                  state.sourceConfig.family === 'hebrew' ? 'font-hebrew' :
                  state.sourceConfig.family === 'thai' ? 'font-thai' :
                  'font-latin'
                }`}
                style={{ 
                  direction: state.sourceConfig.isRTL ? 'rtl' : 'ltr',
                  textAlign: state.sourceConfig.isRTL ? 'right' : 'left',
                  fontSize: `${textSize}px`
                }}
              >
                <span className="text-white">{sourceText}</span>
                <span className="text-neutral-400 italic">{interimText}</span>
                <span className={`inline-block w-0.5 h-6 bg-accent-400 animate-blink-cursor ${
                  state.sourceConfig.isRTL ? 'mr-1' : 'ml-1'
                }`} />
              </div>
              </div>
            )}

            {/* Target Language Panel */}
            <div className={`bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg shadow-lg p-4 md:p-6 transition-all duration-500 ease-in-out ${
              isFullscreen ? 'flex-1 flex flex-col' : ''
            }`}>
              <div className="relative flex items-center justify-center mb-4">
                <div className="absolute left-0">
                  <LogoBrand size="md" variant="subtle" className="opacity-60 hover:opacity-80 transition-opacity duration-200" />
                </div>
                <h3 className="text-lg font-heading text-white">{state.targetConfig.name} Translation</h3>
                <div className="absolute right-0 flex items-center space-x-2">
                  <div className="text-sm text-neutral-400">AI Powered</div>
                  {state.targetConfig.isRTL && (
                    <span className="text-xs bg-accent-500/20 text-accent-400 border border-accent-500/30 px-2 py-1 rounded">RTL</span>
                  )}
                  {!showSourcePanel && (
                    <span className="text-xs bg-green-500/20 text-green-400 border border-green-500/30 px-2 py-1 rounded flex items-center gap-1">
                      <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                      Focus Mode
                    </span>
                  )}
                </div>
              </div>
              
              <div
                ref={targetScrollRef}
                className={`${isFullscreen ? 'flex-1 overflow-y-auto' : showSourcePanel ? 'h-96 overflow-y-auto' : 'h-[600px] overflow-y-auto'} p-4 bg-white/5 rounded-lg border border-white/10 leading-relaxed custom-scrollbar ${
                  state.targetConfig.family === 'arabic' ? 'font-arabic' :
                  state.targetConfig.family === 'chinese' ? 'font-chinese' :
                  state.targetConfig.family === 'cyrillic' ? 'font-cyrillic' :
                  state.targetConfig.family === 'devanagari' ? 'font-devanagari' :
                  state.targetConfig.family === 'hebrew' ? 'font-hebrew' :
                  state.targetConfig.family === 'thai' ? 'font-thai' :
                  'font-latin'
                }`}
                style={{ 
                  direction: state.targetConfig.isRTL ? 'rtl' : 'ltr',
                  textAlign: state.targetConfig.isRTL ? 'right' : 'left',
                  fontSize: `${textSize}px`
                }}
              >
                <span className="text-white">{targetText}</span>
                <span className={`inline-block w-0.5 h-6 bg-accent-400 animate-blink-cursor ${
                  state.targetConfig.isRTL ? 'mr-1' : 'ml-1'
                }`} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Keyboard Shortcuts Help */}
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg shadow-lg p-4">
        <div className="flex items-center justify-between">
          <div className="text-sm text-neutral-400">
            <span className="font-heading text-white">Keyboard Shortcuts:</span>
            <span className="ml-4">
              <kbd className="px-2 py-1 bg-white/10 border border-white/20 rounded text-xs">H</kbd> Toggle source panel
            </span>
            <span className="ml-4">
              <kbd className="px-2 py-1 bg-white/10 border border-white/20 rounded text-xs">F</kbd> Fullscreen
            </span>
            <span className="ml-4">
              <kbd className="px-2 py-1 bg-white/10 border border-white/20 rounded text-xs">Space</kbd> Start/Stop recording
            </span>
          </div>
          {!showSourcePanel && (
            <div className="text-sm text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-1 flex items-center gap-2">
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                <span className="w-2 h-2 bg-green-400 rounded-full"></span>
              </div>
              <span className="font-medium">Focus Mode Active</span>
              <span className="text-green-300">- Translation Only</span>
            </div>
          )}
        </div>
      </div>

      {/* Status Information */}
      {status.message && (
        <div className="bg-red-500/10 backdrop-blur-sm border border-red-500/30 rounded-lg shadow-lg p-4">
          <p className="text-red-400">
            <strong>Error:</strong> {status.message}
          </p>
        </div>
      )}

      {/* Session Error Information */}
      {sessionError && (
        <div className="bg-red-500/10 backdrop-blur-sm border border-red-500/30 rounded-lg shadow-lg p-4">
          <p className="text-red-400">
            <strong>Session Error:</strong> {sessionError}
          </p>
        </div>
      )}

      {/* Alert Dialog for Notifications */}
      <AlertDialog
        open={alertDialog.open}
        onOpenChange={closeAlert}
        title={alertDialog.title}
        description={alertDialog.description}
        buttonText={alertDialog.buttonText}
        variant={alertDialog.variant}
        onButtonClick={alertDialog.onButtonClick}
      />
    </div>
  )
}

// Main component with language provider
export default function LiveCaptioning({ userId }: LiveCaptioningProps) {
  return (
    <LanguageProvider defaultSource="en" defaultTarget="ar">
      <LiveCaptioningInternal userId={userId} />
    </LanguageProvider>
  )
}