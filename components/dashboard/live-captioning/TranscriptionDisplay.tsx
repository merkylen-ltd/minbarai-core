import React, { useEffect, useRef, useCallback } from 'react'
import LogoBrand from '@/components/ui/logo-brand'

interface LanguageConfig {
  name: string
  isRTL: boolean
  family: string
}

interface TranscriptionDisplayProps {
  // Source panel
  showSourcePanel: boolean
  sourceText: string
  interimText: string
  sourceConfig: LanguageConfig
  sourceScrollRef: React.RefObject<HTMLDivElement>

  // Target panel
  completedTranslations: string
  typingText: string
  targetConfig: LanguageConfig
  targetScrollRef: React.RefObject<HTMLDivElement>

  // Layout
  textSize: number
  isFullscreen: boolean
  fullscreenRef: React.RefObject<HTMLDivElement>
  isRecording?: boolean
  onWheel?: (e: WheelEvent) => void
}

export const TranscriptionDisplay: React.FC<TranscriptionDisplayProps> = ({
  showSourcePanel,
  sourceText,
  interimText,
  sourceConfig,
  sourceScrollRef,
  completedTranslations,
  typingText,
  targetConfig,
  targetScrollRef,
  textSize,
  isFullscreen,
  fullscreenRef,
  isRecording = false,
  onWheel
}) => {
  // Add wheel event listener when in fullscreen mode
  useEffect(() => {
    if (isFullscreen && fullscreenRef.current && onWheel) {
      const container = fullscreenRef.current
      
      container.addEventListener('wheel', onWheel, { passive: false })
      return () => {
        container.removeEventListener('wheel', onWheel)
      }
    }
  }, [isFullscreen, fullscreenRef, onWheel])

  const getFontClass = (family: string) => {
    switch (family) {
      case 'arabic': return 'font-arabic'
      case 'chinese': return 'font-chinese'
      case 'cyrillic': return 'font-cyrillic'
      case 'devanagari': return 'font-devanagari'
      case 'hebrew': return 'font-hebrew'
      case 'thai': return 'font-thai'
      default: return 'font-latin'
    }
  }

  // Segment color logic:
  // - typingText = orange (in progress)
  // - last completed segment = green (just finished), but only while nothing is typing
  // - all other completed segments = white (history)
  const completedSegments = completedTranslations ? completedTranslations.split('\n') : []
  const lastNonEmptyIdx = !typingText
    ? completedSegments.reduce((found, s, i) => (s ? i : found), -1)
    : -1

  return (
    <div 
      ref={fullscreenRef}
      className={`transition-all duration-500 ease-in-out ${
        isFullscreen ? 'fixed inset-0 z-50 bg-black/95 backdrop-blur-sm flex flex-col safe-area-inset-top safe-area-inset-bottom' : ''
      }`}
    >
      <div className={`${isFullscreen ? 'flex-1 flex flex-col p-4 md:p-6 min-h-0' : ''}`}>
        <div className={`transition-all duration-500 ease-in-out ${
          showSourcePanel && !isFullscreen ? 'space-y-4 md:space-y-6' : ''
        } ${isFullscreen ? 'flex-1 flex flex-col gap-4 min-h-0' : ''}`}>
          
          {/* Source Language Panel */}
          {showSourcePanel && (
            <div className={`bg-gradient-to-br from-primary-700/30 to-primary-800/30 border border-accent-500/10 rounded-xl p-4 md:p-6 transition-all duration-500 ease-in-out ${
              isFullscreen ? 'flex-1 flex flex-col min-h-0' : ''
            }`}>
              <div className="relative flex items-center justify-center mb-4">
                <div className="absolute left-0">
                  <LogoBrand size="md" variant="subtle" className="opacity-60 hover:opacity-80 transition-opacity duration-200" />
                </div>
                <h3 className="text-lg font-heading text-neutral-0">
                  {sourceConfig.name} Original
                </h3>
                <div className="absolute right-0 flex items-center space-x-2">
                  <div className="w-2 h-2 rounded-full bg-accent-400 animate-pulse" />
                  <span className="text-sm text-neutral-400">Live</span>
                  {sourceConfig.isRTL && (
                    <span className="text-xs bg-accent-500/20 text-accent-400 border border-accent-500/30 px-2 py-1 rounded">RTL</span>
                  )}
                </div>
              </div>
              
              <div
                ref={sourceScrollRef}
                className={`${isFullscreen ? 'flex-1 min-h-0 overflow-y-auto' : 'h-96 overflow-y-auto'} p-4 bg-primary-900/40 rounded-xl border border-accent-500/10 leading-relaxed custom-scrollbar ${
                  getFontClass(sourceConfig.family)
                }`}
                style={{
                  direction: sourceConfig.isRTL ? 'rtl' : 'ltr',
                  textAlign: sourceConfig.isRTL ? 'right' : 'left',
                  fontSize: `${textSize}px`
                }}
              >
                <span className="text-neutral-0">{sourceText}</span>
                {interimText && <span className="text-accent-300 italic">{interimText}</span>}
                <span className={`inline-block w-0.5 h-[1em] align-middle bg-accent-400 animate-blink-cursor ${
                  sourceConfig.isRTL ? 'mr-1' : 'ml-1'
                }`} />
              </div>
            </div>
          )}

          {/* Target Language Panel */}
          <div className={`bg-gradient-to-br from-primary-700/30 to-primary-800/30 border border-accent-500/10 rounded-xl p-4 md:p-6 transition-all duration-500 ease-in-out ${
            isFullscreen ? 'flex-1 flex flex-col min-h-0' : ''
          }`}>
            <div className="relative flex items-center justify-center mb-4">
              <div className="absolute left-0">
                <LogoBrand size="md" variant="subtle" className="opacity-60 hover:opacity-80 transition-opacity duration-200" />
              </div>
              <h3 className="text-lg font-heading text-neutral-0">{targetConfig.name} Translation</h3>
              <div className="absolute right-0 flex items-center space-x-2">
                <div className="text-sm text-neutral-400">AI Powered</div>
                {targetConfig.isRTL && (
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
              className={`${isFullscreen ? 'flex-1 min-h-0 overflow-y-auto' : showSourcePanel ? 'h-96 overflow-y-auto' : 'h-[600px] overflow-y-auto'} p-4 bg-primary-900/40 rounded-xl border border-accent-500/10 leading-relaxed custom-scrollbar ${
                getFontClass(targetConfig.family)
              }`}
              style={{
                direction: targetConfig.isRTL ? 'rtl' : 'ltr',
                textAlign: targetConfig.isRTL ? 'right' : 'left',
                fontSize: `${textSize}px`
              }}
            >
              {!completedTranslations && !typingText && isRecording ? (
                <div className="flex items-center gap-2 text-neutral-400 opacity-60" aria-live="polite" aria-label="Waiting for speech">
                  <div className="w-1.5 h-1.5 bg-accent-400 rounded-full animate-pulse flex-shrink-0"></div>
                  <span>Waiting for speech…</span>
                </div>
              ) : (
                <div className="flex flex-col gap-3 items-start w-full">
                  {/* History segments (white) and the most-recently-completed segment (green) */}
                  {completedSegments.map((segment, i) =>
                    segment ? (
                      <p key={i} className={i === lastNonEmptyIdx ? 'text-green-400' : 'text-neutral-0'}>
                        {segment}
                      </p>
                    ) : null
                  )}

                  {/* Currently incoming segment — orange while typing */}
                  {typingText && (
                    <p className="text-orange-400">
                      {typingText}
                      <span className={`inline-block w-0.5 h-[1em] align-middle bg-orange-400 animate-blink-cursor ${
                        targetConfig.isRTL ? 'mr-1' : 'ml-1'
                      }`} />
                    </p>
                  )}

                  {/* Idle cursor when not typing but have content */}
                  {!typingText && (completedTranslations || isRecording) && (
                    <span className={`inline-block w-0.5 h-[1em] align-middle bg-accent-400/50 animate-blink-cursor ${
                      targetConfig.isRTL ? 'mr-1' : 'ml-1'
                    }`} />
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

