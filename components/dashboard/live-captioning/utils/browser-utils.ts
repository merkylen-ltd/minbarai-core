import { isVoiceFlowConfigured } from '@/lib/voiceflow/config'
import { CompatibilityCheck } from '../types'

// Mobile browser detection utility
export function isMobileBrowser(): boolean {
  return /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
}

// VoiceFlow compatibility check
export const checkVoiceFlowCompatibility = (): CompatibilityCheck => {
  if (typeof window === 'undefined') {
    return { 
      voiceFlow: false, 
      mediaDevices: false, 
      audioContext: false, 
      isSupported: false 
    }
  }
  
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

