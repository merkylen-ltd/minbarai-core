// Component-specific types for live-captioning
export interface LiveCaptioningProps {
  userId: string
}

// Re-export shared types
export type { CaptionData, ConnectionStatus } from '@/types'

export interface CompatibilityCheck {
  voiceFlow: boolean
  mediaDevices: boolean
  audioContext: boolean
  isSupported: boolean
}

export interface LanguageSpecificConfig {
  alternativeLanguageCodes?: string[]
}

// Translation variant types
export type TranslationVariant = 'normal' | 'quran' | 'hadith' | 'quran_hadith'

export interface TranslationVariantOption {
  value: TranslationVariant
  label: string
  description?: string
}

export const TRANSLATION_VARIANTS: TranslationVariantOption[] = [
  { value: 'normal', label: 'Normal', description: 'Standard translation' },
  { value: 'quran', label: 'Quran', description: 'Optimized for Quranic verses' },
  { value: 'hadith', label: 'Hadith', description: 'Optimized for Hadith' },
  { value: 'quran_hadith', label: 'Quran & Hadith', description: 'Optimized for Islamic texts' }
]

