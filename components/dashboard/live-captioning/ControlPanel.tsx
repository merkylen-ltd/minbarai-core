import React from 'react'
import { Mic, MicOff, Download, Eye, EyeOff, Maximize2, Minimize2, Trash2 } from 'lucide-react'
import { LanguagePairSelector } from '@/components/ui/language-selector'
import { ConnectionStatus, TranslationVariant } from './types'
import { TranslationVariantSelector } from './TranslationVariantSelector'

interface ControlPanelProps {
  // Recording state
  isRecording: boolean
  status: ConnectionStatus
  onStartRecording: () => void
  onStopRecording: () => void
  
  // Language state
  sourceLanguage: string
  targetLanguage: string
  onSourceLanguageChange: (lang: string) => void
  onTargetLanguageChange: (lang: string) => void
  onSwapLanguages: () => void
  
  // Translation variant state
  translationVariant: TranslationVariant
  onTranslationVariantChange: (variant: TranslationVariant) => Promise<void>
  isVariantLoading: boolean
  
  // UI state
  textSize: number
  onTextSizeChange: (size: number) => void
  showSourcePanel: boolean
  onToggleSourcePanel: () => void
  isFullscreen: boolean
  onToggleFullscreen: () => void
  
  // Session state
  isSessionLoading: boolean
  sessionData: any
  sessionTimeRemaining: number
  isValidForTranslation: boolean
  isUsageActive: boolean
  usageSessionId: string | null
  usageStatus: string | null
  
  // Actions
  onClear: () => void
  onDownload: () => void
  hasContent: boolean
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  isRecording,
  status,
  onStartRecording,
  onStopRecording,
  sourceLanguage,
  targetLanguage,
  onSourceLanguageChange,
  onTargetLanguageChange,
  onSwapLanguages,
  translationVariant,
  onTranslationVariantChange,
  isVariantLoading,
  textSize,
  onTextSizeChange,
  showSourcePanel,
  onToggleSourcePanel,
  isFullscreen,
  onToggleFullscreen,
  isSessionLoading,
  sessionData,
  sessionTimeRemaining,
  isValidForTranslation,
  isUsageActive,
  usageSessionId,
  usageStatus,
  onClear,
  onDownload,
  hasContent
}) => {
  return (
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
              {/* Only show non-active status if we have a session ID */}
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
              {sessionTimeRemaining <= 0 && !isSessionLoading && (
                <div className="text-sm text-red-400 font-body bg-red-500/10 border border-red-500/20 rounded-lg px-2 py-1">
                  Limit reached
                </div>
              )}
              {!isValidForTranslation && !isSessionLoading && (
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

      {/* Controls Section - Single Row Layout */}
      <div className="flex flex-wrap items-center gap-3">
        {/* 1. Start/Stop Button - Primary Action */}
        <button
          onClick={isRecording ? onStopRecording : onStartRecording}
          className={`inline-flex items-center justify-center px-6 h-10 text-sm font-body rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed min-w-[100px] ${
            isRecording 
              ? 'bg-red-500 hover:bg-red-600 text-white focus:ring-red-500 shadow-lg hover:shadow-xl' 
              : 'bg-accent-500 hover:bg-accent-400 text-white focus:ring-accent-500 shadow-lg hover:shadow-xl'
          }`}
          title={`${isRecording ? 'Stop recording (Space)' : 'Start recording (Space)'}`}
        >
          {isRecording ? <MicOff className="h-4 w-4 mr-2" /> : <Mic className="h-4 w-4 mr-2" />}
          <span>{isRecording ? 'Stop' : 'Start'}</span>
        </button>

        {/* 2. Language Selection - Core Configuration */}
        <div className="flex-1 min-w-[250px] max-w-[450px]" title="Select source and target languages for translation">
          <div className="bg-primary-700/30 border border-accent-500/20 rounded-lg px-3 py-2 h-10 flex items-center overflow-hidden">
            <LanguagePairSelector
              sourceLanguage={sourceLanguage}
              targetLanguage={targetLanguage}
              onSourceChange={onSourceLanguageChange}
              onTargetChange={onTargetLanguageChange}
              onSwap={onSwapLanguages}
              disabled={isRecording}
              showPopularOnly={false}
              className="min-w-0 w-full overflow-hidden"
            />
          </div>
        </div>

        {/* 3. Mode Selector - Translation Type */}
        <div className="flex-shrink-0 min-w-[140px]" title="Select translation mode (Quran, Hadith, or General)">
          <div className="bg-primary-700/30 border border-accent-500/20 rounded-lg px-3 py-2 h-10 flex items-center">
            <div className="flex items-center space-x-2 w-full">
              <span className="text-xs text-neutral-400 font-display whitespace-nowrap">Mode:</span>
              <TranslationVariantSelector
                value={translationVariant}
                onChange={onTranslationVariantChange}
                disabled={isRecording}
                isLoading={isVariantLoading}
              />
            </div>
          </div>
        </div>

        {/* 4. Clear Button */}
        <button
          onClick={onClear}
          className="inline-flex items-center justify-center w-10 h-10 text-sm font-body rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 bg-white/10 text-white border border-white/20 hover:bg-white/20 hover:border-white/30 focus:ring-white/50"
          title="Clear all transcription text (C)"
        >
          <Trash2 className="h-4 w-4" />
        </button>

        {/* 5. Hide/Show Source Panel */}
        <button
          onClick={onToggleSourcePanel}
          className={`inline-flex items-center justify-center w-10 h-10 text-sm font-body rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
            showSourcePanel 
              ? 'bg-accent-500/20 text-accent-400 border border-accent-500/30 hover:bg-accent-500/30 focus:ring-accent-500' 
              : 'bg-white/10 text-white border border-white/20 hover:bg-white/20 hover:border-white/30 focus:ring-white/50'
          }`}
          title={`${showSourcePanel ? 'Hide source panel (H)' : 'Show source panel (H)'}`}
        >
          {showSourcePanel ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>

        {/* 6. Text Size Control */}
        <div className="bg-primary-700/30 border border-accent-500/20 rounded-lg px-3 py-2 h-10 flex items-center min-w-[120px]" title="Adjust text size (12-120px)">
          <div className="flex items-center space-x-2 w-full">
            <span className="text-xs text-neutral-400 font-display">A</span>
            <input
              type="range"
              min="12"
              max="120"
              value={textSize}
              onChange={(e) => onTextSizeChange(Number(e.target.value))}
              className="w-10 h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer slider-thumb flex-1"
              style={{
                background: `linear-gradient(to right, #55a39a 0%, #55a39a ${((textSize - 12) / (120 - 12)) * 100}%, rgba(255,255,255,0.2) ${((textSize - 12) / (120 - 12)) * 100}%, rgba(255,255,255,0.2) 100%)`
              }}
            />
            <span className="text-xs text-neutral-400 font-display">A</span>
            <span className="text-xs text-neutral-300 font-mono min-w-[30px] text-right">{textSize}</span>
          </div>
        </div>

        {/* 7. Fullscreen Toggle */}
        <button
          onClick={onToggleFullscreen}
          className={`inline-flex items-center justify-center w-10 h-10 text-sm font-body rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
            isFullscreen 
              ? 'bg-accent-500/20 text-accent-400 border border-accent-500/30 hover:bg-accent-500/30 focus:ring-accent-500' 
              : 'bg-white/10 text-white border border-white/20 hover:bg-white/20 hover:border-white/30 focus:ring-white/50'
          }`}
          title={`${isFullscreen ? 'Exit fullscreen mode (F)' : 'Enter fullscreen mode (F)'}`}
        >
          {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>

        {/* 8. Download Button */}
        <button
          onClick={onDownload}
          className="inline-flex items-center justify-center w-10 h-10 text-sm font-body rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed bg-white/10 text-white border border-white/20 hover:bg-white/20 hover:border-white/30 focus:ring-white/50"
          disabled={!hasContent}
          title={hasContent ? "Download transcript as text file" : "No content to download"}
        >
          <Download className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

