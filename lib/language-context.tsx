'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { LanguageConfig, getLanguageConfig, isLanguagePairSupported, POPULAR_LANGUAGES } from '@/constants/languages'

export interface LanguageState {
  sourceLanguage: string
  targetLanguage: string
  sourceConfig: LanguageConfig
  targetConfig: LanguageConfig
  isTranslationSupported: boolean
}

export interface LanguageContextType {
  // Current language state
  state: LanguageState
  
  // Language setters
  setSourceLanguage: (language: string) => void
  setTargetLanguage: (language: string) => void
  swapLanguages: () => void
  
  // UI preferences
  showPopularOnly: boolean
  setShowPopularOnly: (show: boolean) => void
  
  // Language lists
  popularLanguages: LanguageConfig[]
  
  // Helper functions
  getLanguageDisplayName: (code: string) => string
  isLanguageSupported: (source: string, target: string) => boolean
  
  // Storage functions
  saveLanguagePreferences: () => void
  loadLanguagePreferences: () => void
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

interface LanguageProviderProps {
  children: ReactNode
  defaultSource?: string
  defaultTarget?: string
}

export function LanguageProvider({ 
  children, 
  defaultSource = 'en', 
  defaultTarget = 'de' 
}: LanguageProviderProps) {
  const [sourceLanguage, setSourceLanguageState] = useState(defaultSource)
  const [targetLanguage, setTargetLanguageState] = useState(defaultTarget)
  const [showPopularOnly, setShowPopularOnly] = useState(true)

  // Create language state
  const createLanguageState = (source: string, target: string): LanguageState => {
    const sourceConfig = getLanguageConfig(source)
    const targetConfig = getLanguageConfig(target)
    const isTranslationSupported = isLanguagePairSupported(source, target)
    
    return {
      sourceLanguage: source,
      targetLanguage: target,
      sourceConfig,
      targetConfig,
      isTranslationSupported
    }
  }

  const [state, setState] = useState(() => createLanguageState(sourceLanguage, targetLanguage))

  // Update state when languages change
  useEffect(() => {
    setState(createLanguageState(sourceLanguage, targetLanguage))
  }, [sourceLanguage, targetLanguage])

  // Language setters with validation
  const setSourceLanguage = (language: string) => {
    if (language === targetLanguage) {
      // If setting source to current target, swap them
      setTargetLanguageState(sourceLanguage)
    }
    setSourceLanguageState(language)
    saveLanguagePreferences()
  }

  const setTargetLanguage = (language: string) => {
    if (language === sourceLanguage) {
      // If setting target to current source, swap them
      setSourceLanguageState(targetLanguage)
    }
    setTargetLanguageState(language)
    saveLanguagePreferences()
  }

  const swapLanguages = () => {
    const newSource = targetLanguage
    const newTarget = sourceLanguage
    setSourceLanguageState(newSource)
    setTargetLanguageState(newTarget)
    saveLanguagePreferences()
  }

  // Popular languages with configs
  const popularLanguages = POPULAR_LANGUAGES.map(getLanguageConfig)

  // Helper functions
  const getLanguageDisplayName = (code: string): string => {
    return getLanguageConfig(code).name
  }

  const isLanguageSupported = (source: string, target: string): boolean => {
    return isLanguagePairSupported(source, target)
  }

  // Storage functions
  const saveLanguagePreferences = () => {
    try {
      const preferences = {
        sourceLanguage,
        targetLanguage,
        showPopularOnly,
        timestamp: Date.now()
      }
      localStorage.setItem('minberai-language-preferences', JSON.stringify(preferences))
    } catch (error) {
      console.warn('Failed to save language preferences:', error)
    }
  }

  const loadLanguagePreferences = () => {
    try {
      const stored = localStorage.getItem('minberai-language-preferences')
      if (stored) {
        const preferences = JSON.parse(stored)
        
        // Validate stored preferences
        if (preferences.sourceLanguage && preferences.targetLanguage) {
          setSourceLanguageState(preferences.sourceLanguage)
          setTargetLanguageState(preferences.targetLanguage)
        }
        
        if (typeof preferences.showPopularOnly === 'boolean') {
          setShowPopularOnly(preferences.showPopularOnly)
        }
      }
    } catch (error) {
      console.warn('Failed to load language preferences:', error)
    }
  }

  // Load preferences on mount
  useEffect(() => {
    loadLanguagePreferences()
  }, [])

  const contextValue: LanguageContextType = {
    state,
    setSourceLanguage,
    setTargetLanguage,
    swapLanguages,
    showPopularOnly,
    setShowPopularOnly,
    popularLanguages,
    getLanguageDisplayName,
    isLanguageSupported,
    saveLanguagePreferences,
    loadLanguagePreferences
  }

  return (
    <LanguageContext.Provider value={contextValue}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage(): LanguageContextType {
  const context = useContext(LanguageContext)
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return context
}

// Specific hooks for common use cases
export function useSourceLanguage() {
  const { state, setSourceLanguage } = useLanguage()
  return {
    language: state.sourceLanguage,
    config: state.sourceConfig,
    setLanguage: setSourceLanguage
  }
}

export function useTargetLanguage() {
  const { state, setTargetLanguage } = useLanguage()
  return {
    language: state.targetLanguage,
    config: state.targetConfig,
    setLanguage: setTargetLanguage
  }
}

export function useLanguagePair() {
  const { state, swapLanguages } = useLanguage()
  return {
    source: state.sourceLanguage,
    target: state.targetLanguage,
    sourceConfig: state.sourceConfig,
    targetConfig: state.targetConfig,
    isSupported: state.isTranslationSupported,
    swap: swapLanguages
  }
}
