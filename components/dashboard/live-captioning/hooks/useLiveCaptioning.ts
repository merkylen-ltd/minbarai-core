import { useState, useEffect, useCallback } from 'react'
import { useSessionData } from '@/lib/hooks/useSessionData'
import { useUsageTracking } from '@/lib/hooks/useUsageTracking'
import { useDialog } from '@/lib/hooks/useDialog'
import { useLanguage } from '@/lib/language-context'
import { getLanguageName } from '@/constants/languages'
import { TranslationVariant } from '../types'

export interface UseLiveCaptioningReturn {
  // Text state
  sourceText: string
  setSourceText: React.Dispatch<React.SetStateAction<string>>
  targetText: string
  setTargetText: React.Dispatch<React.SetStateAction<string>>
  interimText: string
  setInterimText: React.Dispatch<React.SetStateAction<string>>
  
  // UI state
  textSize: number
  setTextSize: React.Dispatch<React.SetStateAction<number>>
  showSourcePanel: boolean
  setShowSourcePanel: React.Dispatch<React.SetStateAction<boolean>>
  isFullscreen: boolean
  setIsFullscreen: React.Dispatch<React.SetStateAction<boolean>>
  isMounted: boolean
  translationVariant: TranslationVariant
  setTranslationVariant: (variant: TranslationVariant) => Promise<void>
  isVariantLoading: boolean
  
  // Language state
  languageState: any
  setSourceLanguage: (lang: string) => void
  setTargetLanguage: (lang: string) => void
  swapLanguages: () => void
  
  // Session state
  sessionData: any
  isSessionLoading: boolean
  sessionError: string | null
  isValidForTranslation: boolean
  sessionTimeRemaining: number
  totalUsageMinutes: number
  fetchSessionData: (() => Promise<void>) | null
  
  // Usage tracking state
  isUsageActive: boolean
  usageSessionId: string | null
  usageStatus: string | null
  capAt: string | null
  startUsageSession: () => Promise<void>
  stopUsageSession: () => Promise<void>
  
  // Dialog state
  alertDialog: any
  showAlert: (title: string, description: string, options?: any) => void
  closeAlert: () => void
  
  // Utility functions
  clearTranscription: () => void
  downloadTranscript: () => void
  handleKeyDown: (event: KeyboardEvent) => void
}

export const useLiveCaptioning = (
  clearTypingAnimation: () => void
): UseLiveCaptioningReturn => {
  // Core state
  const [sourceText, setSourceText] = useState('')
  const [targetText, setTargetText] = useState('')
  const [interimText, setInterimText] = useState('')
  
  // UI state
  const [textSize, setTextSize] = useState(18)
  const [isMounted, setIsMounted] = useState(false)
  const [showSourcePanel, setShowSourcePanel] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [translationVariant, setTranslationVariant] = useState<TranslationVariant>('quran_hadith')
  const [isVariantLoading, setIsVariantLoading] = useState(false)

  // Language context
  const languageContext = useLanguage()
  const { 
    state: languageState, 
    setSourceLanguage, 
    setTargetLanguage, 
    swapLanguages 
  } = languageContext

  // Session data hook
  const { 
    sessionData, 
    isLoading: isSessionLoading, 
    error: sessionError, 
    isValidForTranslation, 
    sessionTimeRemaining, 
    totalUsageMinutes,
    fetchSessionData 
  } = useSessionData()

  // Usage tracking hook
  const {
    isActive: isUsageActive,
    sessionId: usageSessionId,
    status: usageStatus,
    capAt,
    startSession: startUsageSession,
    stopSession: stopUsageSession
  } = useUsageTracking()

  // Dialog hook
  const { alertDialog, showAlert, closeAlert } = useDialog()

  // Set mounted flag
  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Note: Usage status monitoring moved to main component since it needs access to recording state

  // Handle translation variant change with loading state
  const handleTranslationVariantChange = useCallback(async (variant: TranslationVariant) => {
    setIsVariantLoading(true)
    try {
      setTranslationVariant(variant)
      // Small delay to show loading state
      await new Promise(resolve => setTimeout(resolve, 100))
    } finally {
      setIsVariantLoading(false)
    }
  }, [])

  // Clear transcription
  const clearTranscription = useCallback(() => {
    setSourceText('')
    setTargetText('')
    setInterimText('')
    clearTypingAnimation()
  }, [clearTypingAnimation])

  // Download transcript
  const downloadTranscript = useCallback(() => {
    const transcript = `MinbarAI Session Transcript
Generated: ${isMounted ? new Date().toLocaleDateString() : 'Loading...'} ${isMounted ? new Date().toLocaleTimeString() : 'Loading...'}

${getLanguageName(languageState.sourceLanguage).toUpperCase()}:
${sourceText}

${getLanguageName(languageState.targetLanguage).toUpperCase()}:
${targetText}
`
    const blob = new Blob([transcript], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `minberai-transcript-${languageState.sourceLanguage}-to-${languageState.targetLanguage}-${isMounted ? new Date().toISOString().split('T')[0] : 'session'}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [sourceText, targetText, languageState.sourceLanguage, languageState.targetLanguage, isMounted])

  // Keyboard shortcuts handler (Space key handled in main component)
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Only handle shortcuts when not typing in input fields
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
      return
    }

    switch (event.key.toLowerCase()) {
      case 'h':
        event.preventDefault()
        setShowSourcePanel(prev => !prev)
        break
      case 'f':
        event.preventDefault()
        setIsFullscreen(prev => !prev)
        break
      // Note: Space key handling moved to main component since it needs recording functions
    }
  }, [])

  // Keyboard shortcuts listener
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleKeyDown])

  return {
    // Text state
    sourceText,
    setSourceText,
    targetText,
    setTargetText,
    interimText,
    setInterimText,
    
    // UI state
    textSize,
    setTextSize,
    showSourcePanel,
    setShowSourcePanel,
    isFullscreen,
    setIsFullscreen,
    isMounted,
    translationVariant,
    setTranslationVariant: handleTranslationVariantChange,
    isVariantLoading,
    
    // Language state
    languageState,
    setSourceLanguage,
    setTargetLanguage,
    swapLanguages,
    
    // Session state
    sessionData,
    isSessionLoading,
    sessionError,
    isValidForTranslation,
    sessionTimeRemaining,
    totalUsageMinutes,
    fetchSessionData,
    
    // Usage tracking state
    isUsageActive,
    usageSessionId,
    usageStatus,
    capAt,
    startUsageSession,
    stopUsageSession,
    
    // Dialog state
    alertDialog,
    showAlert,
    closeAlert,
    
    // Utility functions
    clearTranscription,
    downloadTranscript,
    handleKeyDown
  }
}

