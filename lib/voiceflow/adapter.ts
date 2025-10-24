import { VoiceFlowRecognition, VoiceFlowExtras } from './client';
import { VoiceFlowConfig } from './config';

// WebSpeech-compatible event types for the UI
export interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

export interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

export interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

export interface SpeechRecognitionResult {
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}

export interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

/**
 * Adapter that wraps VoiceFlowRecognition to provide WebSpeech-compatible interface
 * for seamless integration with existing UI code.
 */
export class VoiceFlowAdapter {
  continuous = true;
  interimResults = true;
  lang = "en-US";
  maxAlternatives = 1;
  grammars: any = null;

  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null = null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null = null;
  onaudioend: (() => void) | null = null;
  ontranslation: ((event: any) => void) | null = null;

  private recognition: VoiceFlowRecognition;
  private config: VoiceFlowConfig;

  constructor(config: VoiceFlowConfig, extras?: Partial<VoiceFlowExtras>) {
    this.config = config;
    
    // Initialize VoiceFlow recognition with config
    this.recognition = new VoiceFlowRecognition(config.url, {
      token: config.token,
      // Default settings optimized for live captioning
      model: 'latest_long',
      wordTimeOffsets: true,
      spokenPunctuation: true,
      endpointing: { singleUtterance: false },
      emitStability: false,
      phraseHints: ["MinbarAI"],
      captureMode: 'WEBM_OPUS',
      ...extras
    });

    // Wire up event forwarding
    this.setupEventForwarding();
  }

  start(): void {
    this.recognition.start();
  }

  stop(): void {
    this.recognition.stop();
  }

  abort(): void {
    this.recognition.abort();
  }

  private setupEventForwarding(): void {
    // Forward start event
    this.recognition.onstart = () => {
      this.onstart?.();
    };

    // Forward end event
    this.recognition.onend = () => {
      this.onend?.();
    };

    // Forward error event with proper typing
    this.recognition.onerror = (event: any) => {
      const errorEvent: SpeechRecognitionErrorEvent = {
        ...new Event('error'),
        error: event.error || 'unknown',
        message: event.message
      };
      this.onerror?.(errorEvent);
    };

    // Forward result event with proper typing
    this.recognition.onresult = (event: any) => {
      const resultEvent: SpeechRecognitionEvent = {
        ...new Event('result'),
        resultIndex: event.resultIndex || 0,
        results: event.results
      };
      this.onresult?.(resultEvent);
    };

    // Forward speech events
    this.recognition.onaudioend = () => {
      this.onaudioend?.();
    };

    // Forward translation events
    (this.recognition as any).ontranslation = (event: any) => {
      this.ontranslation?.(event);
    };
  }

  // Update language dynamically
  setLanguage(lang: string): void {
    this.lang = lang;
    this.recognition.lang = lang;
    
    // VoiceFlow is continuous - no need to restart for language changes
    // The language will be updated in the next start message sent to the server
    console.log('[VoiceFlow] Language updated to:', lang, '(continuous mode - no restart needed)');
  }

  // Translation controls
  enableTranslation(config: { prompt: string; sourceLanguage: string; targetLanguage: string; geminiModelConfig?: { model: string; temperature?: number; maxTokens?: number; topP?: number; topK?: number; stopSequences?: string[] } }): void {
    (this.recognition as any).enableTranslation?.(config);
  }

  disableTranslation(): void {
    (this.recognition as any).disableTranslation?.();
  }

  setTranslationPrompt(prompt: string): void {
    (this.recognition as any).setTranslationPrompt?.(prompt);
  }

  // Set translation config before starting (included in initial start message)
  setTranslationConfig(config: { prompt: string; sourceLanguage: string; targetLanguage: string; geminiModelConfig?: { model: string; temperature?: number; maxTokens?: number; topP?: number; topK?: number; stopSequences?: string[] } }): void {
    
    const rec = this.recognition as any;
    if (rec.voiceFlow) {
      rec.voiceFlow.translation = { enabled: true, ...config };
      
    } else {
      console.error('[VoiceFlow Adapter] ✗ recognition.voiceFlow not available!');
    }
  }

}
