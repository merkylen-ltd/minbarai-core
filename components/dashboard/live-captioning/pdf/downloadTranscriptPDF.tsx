import { LanguageConfig } from '@/constants/languages'
import { TranslationVariant } from '../types'

export interface DownloadTranscriptPDFOptions {
  sourceText: string
  translationText: string
  sourceConfig: LanguageConfig
  targetConfig: LanguageConfig
  translationVariant: TranslationVariant
  sessionStartedAt: string | null
  onGeneratingChange: (generating: boolean) => void
}

export async function downloadTranscriptPDF(
  options: DownloadTranscriptPDFOptions
): Promise<void> {
  // Guard: browser-only
  if (typeof window === 'undefined') return

  const {
    sourceText,
    translationText,
    sourceConfig,
    targetConfig,
    translationVariant,
    sessionStartedAt,
    onGeneratingChange,
  } = options

  onGeneratingChange(true)

  try {
    // Dynamic imports — load-bearing for avoiding SSR build failure
    const [{ pdf }, { TranscriptPDFDocument }] = await Promise.all([
      import('@react-pdf/renderer'),
      import('./TranscriptPDFDocument'),
    ])

    // Derive font families from language family field
    // Amiri supports Arabic and Hebrew (RTL scripts); Helvetica for everything else
    const RTL_FAMILIES = new Set(['arabic', 'hebrew'])
    const sourceFontFamily = RTL_FAMILIES.has(sourceConfig.family)
      ? 'Amiri'
      : 'Helvetica'
    const targetFontFamily = RTL_FAMILIES.has(targetConfig.family)
      ? 'Amiri'
      : 'Helvetica'

    const generatedAt = new Date()

    // Create the PDF document element
    const element = (
      <TranscriptPDFDocument
        sourceText={sourceText.trim()}
        translationText={translationText.trim()}
        sourceLangName={sourceConfig.name}
        targetLangName={targetConfig.name}
        sourceIsRTL={sourceConfig.isRTL}
        targetIsRTL={targetConfig.isRTL}
        sourceFontFamily={sourceFontFamily}
        targetFontFamily={targetFontFamily}
        translationVariant={translationVariant}
        sessionStartedAt={sessionStartedAt}
        generatedAt={generatedAt}
      />
    )

    // Generate PDF blob
    const blob = await pdf(element).toBlob()

    // Build filename
    const dateStr = generatedAt.toISOString().split('T')[0]
    const filename = `minbarai-transcript-${sourceConfig.code}-to-${targetConfig.code}-${dateStr}.pdf`

    // Programmatic download
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)

    // Delay revoke to allow download to start
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  } catch (error) {
    console.error('[downloadTranscriptPDF] Failed to generate PDF:', error)
    // Re-throw so the caller can display an error alert
    throw error
  } finally {
    onGeneratingChange(false)
  }
}
