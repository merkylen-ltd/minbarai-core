'use client'

import React, { useRef, useCallback, useEffect } from 'react'
import { LanguageProvider, useLanguage } from '@/lib/language-context'
import { AlertDialog } from '@/components/ui/dialog'
import DismissibleBanner from '@/components/ui/dismissible-banner'
import { LiveCaptioningProps } from './types'
import { ControlPanel } from './ControlPanel'
import { TranscriptionDisplay } from './TranscriptionDisplay'
import { useTypingAnimation } from './hooks/useTypingAnimation'
import { useSpeechRecognition } from './hooks/useSpeechRecognition'
import { useLiveCaptioning } from './hooks/useLiveCaptioning'

// Internal component that uses language context
function LiveCaptioningInternal({ userId }: LiveCaptioningProps) {
  const { state: languageState } = useLanguage()
  
  // Refs for scrolling
  const sourceScrollRef = useRef<HTMLDivElement>(null)
  const targetScrollRef = useRef<HTMLDivElement>(null)
  const fullscreenRef = useRef<HTMLDivElement>(null)

  // Typing animation hook
  const typingAnimation = useTypingAnimation(targetScrollRef)
  
  // Main state management hook (provides session data and UI state)
  const liveCaptioning = useLiveCaptioning(typingAnimation.clearAll)

  // Speech recognition hook with proper callbacks
  const speechRecognition = useSpeechRecognition({
    sourceLanguage: languageState.sourceLanguage,
    targetLanguage: languageState.targetLanguage,
    translationVariant: liveCaptioning.translationVariant,
    isValidForTranslation: liveCaptioning.isValidForTranslation,
    sessionData: liveCaptioning.sessionData,
    totalUsageMinutes: liveCaptioning.totalUsageMinutes,
    sourceScrollRef,
    onInterimText: liveCaptioning.setInterimText,
    onFinalText: (text: string) => {
      liveCaptioning.setSourceText(prev => prev + ' ' + text)
      typingAnimation.scrollToBottom(sourceScrollRef)
    },
    onTranslation: (translation: string) => {
      typingAnimation.queueTranslation(translation)
    },
    onError: liveCaptioning.showAlert,
    scrollToBottom: typingAnimation.scrollToBottom,
    startUsageSession: liveCaptioning.startUsageSession,
    endUsageSession: liveCaptioning.stopUsageSession
  })

  // Monitor usage status and auto-stop if session becomes inactive during recording
  useEffect(() => {
    if (speechRecognition.isRecording && liveCaptioning.usageSessionId && liveCaptioning.usageStatus && 
        (liveCaptioning.usageStatus === 'expired' || liveCaptioning.usageStatus === 'capped' || liveCaptioning.usageStatus === 'closed')) {
      
      speechRecognition.stopRecording()
      
      let message = 'Session has been stopped.'
      if (liveCaptioning.usageStatus === 'expired') {
        message = 'Your session has expired due to inactivity. Please start a new session to continue.'
      } else if (liveCaptioning.usageStatus === 'capped') {
        message = 'Your session has reached the maximum duration limit (3 hours). Please start a new session to continue.'
      } else if (liveCaptioning.usageStatus === 'closed') {
        message = 'Your session has been closed. Please start a new session to continue.'
      }
      
      liveCaptioning.showAlert('Session Stopped', message, { variant: 'warning', buttonText: 'OK' })
    }
  }, [speechRecognition.isRecording, liveCaptioning.usageSessionId, liveCaptioning.usageStatus, speechRecognition.stopRecording, liveCaptioning.showAlert])

  // Add Space key handler for start/stop recording
  useEffect(() => {
    const handleSpaceKey = (event: KeyboardEvent) => {
      // Only handle when not typing in input fields
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return
      }

      if (event.key === ' ') {
        event.preventDefault()
        if (speechRecognition.isRecording) {
          speechRecognition.stopRecording()
        } else {
          speechRecognition.startRecording()
        }
      }
    }

    document.addEventListener('keydown', handleSpaceKey)
    return () => {
      document.removeEventListener('keydown', handleSpaceKey)
    }
  }, [speechRecognition.isRecording, speechRecognition.startRecording, speechRecognition.stopRecording])

  // Auto-scroll when text size changes or content updates
  // Note: Typing text scroll is handled internally by useTypingAnimation hook
  useEffect(() => {
    if (liveCaptioning.sourceText || typingAnimation.completedTranslations) {
      setTimeout(() => {
        typingAnimation.scrollToBottom(sourceScrollRef)
        typingAnimation.scrollToBottom(targetScrollRef)
      }, 100)
    }
  }, [liveCaptioning.textSize, liveCaptioning.sourceText, typingAnimation.completedTranslations, typingAnimation.scrollToBottom])

  // Mouse wheel handler for font size control in fullscreen mode
  const handleWheel = useCallback((e: WheelEvent) => {
    if (!liveCaptioning.isFullscreen) return
    
    e.preventDefault()
    e.stopPropagation()
    
    const isCtrlHeld = e.ctrlKey || e.metaKey
    const delta = e.deltaY
    
    const changeAmount = isCtrlHeld ? 1 : 3
    const newSize = delta > 0 
      ? Math.max(12, liveCaptioning.textSize - changeAmount)
      : Math.min(120, liveCaptioning.textSize + changeAmount)
    
    if (newSize !== liveCaptioning.textSize) {
      liveCaptioning.setTextSize(newSize)
    }
  }, [liveCaptioning.isFullscreen, liveCaptioning.textSize, liveCaptioning.setTextSize])

  // Clear transcription handler
  const handleClear = useCallback(() => {
    liveCaptioning.clearTranscription()
  }, [liveCaptioning])

  // Prevent hydration mismatches
  if (!liveCaptioning.isMounted) {
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
      <ControlPanel
        isRecording={speechRecognition.isRecording}
        status={speechRecognition.status}
        onStartRecording={speechRecognition.startRecording}
        onStopRecording={speechRecognition.stopRecording}
        sourceLanguage={liveCaptioning.languageState.sourceLanguage}
        targetLanguage={liveCaptioning.languageState.targetLanguage}
        onSourceLanguageChange={liveCaptioning.setSourceLanguage}
        onTargetLanguageChange={liveCaptioning.setTargetLanguage}
        onSwapLanguages={liveCaptioning.swapLanguages}
        translationVariant={liveCaptioning.translationVariant}
        onTranslationVariantChange={liveCaptioning.setTranslationVariant}
        textSize={liveCaptioning.textSize}
        onTextSizeChange={liveCaptioning.setTextSize}
        showSourcePanel={liveCaptioning.showSourcePanel}
        onToggleSourcePanel={() => liveCaptioning.setShowSourcePanel(!liveCaptioning.showSourcePanel)}
        isFullscreen={liveCaptioning.isFullscreen}
        onToggleFullscreen={() => liveCaptioning.setIsFullscreen(!liveCaptioning.isFullscreen)}
        isSessionLoading={liveCaptioning.isSessionLoading}
        sessionData={liveCaptioning.sessionData}
        sessionTimeRemaining={liveCaptioning.sessionTimeRemaining}
        isValidForTranslation={liveCaptioning.isValidForTranslation}
        isUsageActive={liveCaptioning.isUsageActive}
        usageSessionId={liveCaptioning.usageSessionId}
        usageStatus={liveCaptioning.usageStatus}
        onClear={handleClear}
        onDownload={liveCaptioning.downloadTranscript}
        hasContent={!!(liveCaptioning.sourceText || typingAnimation.completedTranslations)}
      />

      {/* Live Transcription Display */}
      <TranscriptionDisplay
        showSourcePanel={liveCaptioning.showSourcePanel}
        sourceText={liveCaptioning.sourceText}
        interimText={liveCaptioning.interimText}
        sourceConfig={liveCaptioning.languageState.sourceConfig}
        sourceScrollRef={sourceScrollRef}
        completedTranslations={typingAnimation.completedTranslations}
        typingText={typingAnimation.typingText}
        targetConfig={liveCaptioning.languageState.targetConfig}
        targetScrollRef={targetScrollRef}
        textSize={liveCaptioning.textSize}
        isFullscreen={liveCaptioning.isFullscreen}
        fullscreenRef={fullscreenRef}
        onWheel={handleWheel}
      />

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
          {!liveCaptioning.showSourcePanel && (
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
      {speechRecognition.status.message && (
        <div className="bg-red-500/10 backdrop-blur-sm border border-red-500/30 rounded-lg shadow-lg p-4">
          <p className="text-red-400">
            <strong>Error:</strong> {speechRecognition.status.message}
          </p>
        </div>
      )}

      {/* Session Error Information */}
      {liveCaptioning.sessionError && (
        <div className="bg-red-500/10 backdrop-blur-sm border border-red-500/30 rounded-lg shadow-lg p-4">
          <p className="text-red-400">
            <strong>Session Error:</strong> {liveCaptioning.sessionError}
          </p>
        </div>
      )}

      {/* Alert Dialog for Notifications */}
      <AlertDialog
        open={liveCaptioning.alertDialog.open}
        onOpenChange={liveCaptioning.closeAlert}
        title={liveCaptioning.alertDialog.title}
        description={liveCaptioning.alertDialog.description}
        buttonText={liveCaptioning.alertDialog.buttonText}
        variant={liveCaptioning.alertDialog.variant}
        onButtonClick={liveCaptioning.alertDialog.onButtonClick}
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

