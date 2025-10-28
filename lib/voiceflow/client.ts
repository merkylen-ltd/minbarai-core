type Alt = { transcript: string; confidence?: number; words?: { word: string; startSec: number; endSec: number }[] };
type ServerTranscriptMsg = { type: "transcript"; transcript: string; isFinal: boolean; confidence?: number; stability?: number; words?: Alt["words"]; segment?: { startSec: number; endSec: number } };
type ServerTranslationMsg = {
  type: "translation";
  original: string;
  translated: string;
  sourceLanguage: string;
  targetLanguage: string;
  translationId?: number;
  timestamp?: number;
};
type ServerInfoMsg = { type: "info" | "ready" | "stopped" | "error" | "ping" | "pong"; [k: string]: any };

// Mobile browser detection utility
function isMobileBrowser(): boolean {
  return /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

export interface VoiceFlowExtras {
  // Model & quality
  model?: string;
  useEnhanced?: boolean;
  
  // Recognition features
  wordTimeOffsets?: boolean;
  enableWordConfidence?: boolean;
  profanityFilter?: boolean;
  spokenPunctuation?: boolean;
  spokenEmojis?: boolean;
  
  // Hints & context
  phraseHints?: string[];
  
  // Multi-speaker/channel
  diarization?: { enable: boolean; maxSpeakers?: number; minSpeakers?: number };
  audioChannelCount?: number;
  enableSeparateRecognitionPerChannel?: boolean;
  
  // Multi-language
  alternativeLanguageCodes?: string[];
  
  // Recording metadata
  metadata?: {
    interactionType?: "DISCUSSION" | "PRESENTATION" | "PHONE_CALL" | "VOICEMAIL" | "PROFESSIONALLY_PRODUCED" | "VOICE_SEARCH" | "VOICE_COMMAND" | "DICTATION";
    industryNaicsCodeOfAudio?: number;
    microphoneDistance?: "NEARFIELD" | "MIDFIELD" | "FARFIELD";
    originalMediaType?: "AUDIO" | "VIDEO";
    recordingDeviceType?: "SMARTPHONE" | "PC" | "PHONE_LINE" | "VEHICLE" | "OTHER_OUTDOOR_DEVICE" | "OTHER_INDOOR_DEVICE";
    recordingDeviceName?: string;
    originalMimeType?: string;
    audioTopic?: string;
  };
  
  // Custom vocabulary
  adaptation?: {
    phraseSets?: Array<{
      phrases: string[];
      boost?: number;
    }>;
    customClasses?: Array<{
      name: string;
      items: Array<{ value: string }>;
    }>;
  };
  
  // Transcript normalization
  transcriptNormalization?: {
    entries?: Array<{
      search: string;
      replace: string;
      caseSensitive?: boolean;
    }>;
  };
  
  // Client-side settings
  endpointing?: { singleUtterance?: boolean };
  emitStability?: boolean;
  token?: string;
  captureMode?: "auto" | "PCM16" | "WEBM_OPUS";
  frameMs?: number;
  targetHz?: number;
  extraConfig?: Record<string, unknown>;
  url?: string;

  // Translation (Voiceflow-managed)
  translation?: {
    enabled: boolean;
    prompt: string;
    targetLanguage: string;
    sourceLanguage: string;
    geminiModelConfig?: {
      model: string;
      temperature?: number;
      maxTokens?: number;
      topP?: number;
      topK?: number;
      stopSequences?: string[];
    };
  };
}

export class VoiceFlowRecognition {
  lang = "en-US";
  continuous = true;
  interimResults = true;
  maxAlternatives = 1;
  grammars: any = null;

  onstart: ((e: Event) => void) | null = null;
  onaudioend: ((e: Event) => void) | null = null;
  onresult: ((e: any) => void) | null = null;
  ontranslation: ((e: any) => void) | null = null;
  onerror: ((e: any) => void) | null = null;
  onend: ((e: Event) => void) | null = null;

  voiceFlow: VoiceFlowExtras = {};

  private ws?: WebSocket;
  private cleanup?: () => void;
  public started = false;
  private url: string;
  private audioContextClosed = false;
  private userStopped = false;

  constructor(url: string, extras?: Partial<VoiceFlowExtras>) {
    this.url = url;
    if (extras) Object.assign(this.voiceFlow, extras);
  }

  async start() {
    if (this.started) {
      console.warn("Speech recognition already started");
      return;
    }
    
    // Clean up any existing connection
    if (this.ws) {
      this.ws.close();
    }
    
    this.started = true;

    const url = this.voiceFlow.url || this.url;
    const token = this.voiceFlow.token;
    
    try {
      const protocols = token ? ["bearer", token] : undefined;
      
      this.ws = new WebSocket(url, protocols);
      this.ws.binaryType = "arraybuffer";
      this.ws.onopen = () => {
        this.handleOpen();
      };
      this.ws.onmessage = (ev) => this.handleMessage(ev);
      this.ws.onerror = (ev) => {
        console.error("WebSocket error:", ev);
        this.emitError("network", (ev as any).message || "ws_error");
      };
      this.ws.onclose = (ev) => {
        if (ev.code === 1008) {
          this.emitError("auth", "Authentication failed: " + (ev.reason || "Invalid token"));
          this.finish("end");
          return;
        }
        
        // CRITICAL FIX: Don't end session on normal closures (1000, 1005)
        // VoiceFlow handles stream rotation internally - we should NOT call finish()
        // Only end session on authentication errors (1008) or critical errors
        // WebSocket closed - VoiceFlow will handle reconnection
        
        // Reset state but don't call finish() - let VoiceFlow handle reconnection
        this.started = false;
        this.userStopped = false;
      };
    } catch (error) {
      console.error("Failed to create WebSocket:", error);
      this.started = false;
      this.emitError("network", "Failed to create WebSocket connection");
    }
  }

  stop(): void {
    this.userStopped = true;
    try { 
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: "stop" })); 
      }
    } catch {}
    this.finish("stop");
  }

  abort(): void {
    this.userStopped = true;
    this.finish("abort");
  }

  // ---- Translation controls ----
  enableTranslation(config: { prompt: string; targetLanguage: string; sourceLanguage: string; geminiModelConfig?: { model: string; temperature?: number; maxTokens?: number; topP?: number; topK?: number; stopSequences?: string[] } }): void {
    this.voiceFlow.translation = { enabled: true, ...config } as any;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.sendTranslationConfig();
    }
  }

  disableTranslation(): void {
    if (this.voiceFlow.translation) {
      this.voiceFlow.translation.enabled = false;
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.sendTranslationConfig();
      }
    }
  }

  setTranslationPrompt(prompt: string): void {
    if (this.voiceFlow.translation) {
      this.voiceFlow.translation.prompt = prompt;
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.sendTranslationConfig();
      }
    }
  }

  setGeminiConfig(config: {
    model: string;
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    topK?: number;
    stopSequences?: string[];
  }): void {
    if (!this.voiceFlow.translation) return;
    this.voiceFlow.translation.geminiModelConfig = config;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.sendTranslationConfig();
    }
  }

  // Set language for recognition
  setLanguage(languageCode: string): void {
    // Set language for recognition
    this.lang = languageCode;
  }

  // --- internals ---
  private async handleOpen(): Promise<void> {
    try {
      // Add a small delay to ensure WebSocket is fully ready
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const mode = this.voiceFlow.captureMode ?? "auto";
      let usePCM = mode === "PCM16";
      
      if (mode === "auto") {
        // Keep existing check for desktop
        const hasWorklet = "audioWorklet" in (AudioContext.prototype as any);
        // Add mobile override: prefer OPUS on mobile
        usePCM = hasWorklet && !isMobileBrowser();
      }
      
      if (usePCM) await this.startPCM();
      else await this.startOpus();
      this.onstart?.(new Event("start"));
    } catch (error) {
      console.error("Error in handleOpen:", error);
      this.emitError("initialization", "Failed to initialize audio capture");
    }
  }

  private sendStart(payload: Record<string, any>): void {
    try {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        // Wait for connection to be ready instead of immediately failing
        if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
          // Connection is still establishing, wait for it
          const checkConnection = () => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
              this.sendStart(payload);
            } else if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
              // Still connecting, wait a bit more
              setTimeout(checkConnection, 50);
            } else {
              this.emitError("communication", "WebSocket connection failed to establish");
            }
          };
          setTimeout(checkConnection, 50);
          return;
        }
        this.emitError("communication", "WebSocket connection not ready");
        return;
      }
      
      const msg = {
        type: "start",
        mode: payload.mode,
        languageCode: this.lang,
        interimResults: this.interimResults,
        singleUtterance: this.voiceFlow.endpointing?.singleUtterance ?? false,
        maxAlternatives: this.maxAlternatives,
        // Model & quality
        model: this.voiceFlow.model,
        useEnhanced: this.voiceFlow.useEnhanced,
        // Recognition features
        wordTimeOffsets: this.voiceFlow.wordTimeOffsets,
        enableWordConfidence: this.voiceFlow.enableWordConfidence,
        profanityFilter: this.voiceFlow.profanityFilter,
        spokenPunctuation: this.voiceFlow.spokenPunctuation,
        spokenEmojis: this.voiceFlow.spokenEmojis,
        // Hints & context
        phraseHints: this.voiceFlow.phraseHints,
        // Multi-speaker/channel
        diarization: this.voiceFlow.diarization,
        audioChannelCount: this.voiceFlow.audioChannelCount,
        enableSeparateRecognitionPerChannel: this.voiceFlow.enableSeparateRecognitionPerChannel,
        // Multi-language
        alternativeLanguageCodes: this.voiceFlow.alternativeLanguageCodes,
        // Advanced features
        metadata: this.voiceFlow.metadata,
        adaptation: this.voiceFlow.adaptation,
        transcriptNormalization: this.voiceFlow.transcriptNormalization,
        // Translation configuration
        translationEnabled: this.voiceFlow.translation?.enabled,
        translationPrompt: this.voiceFlow.translation?.prompt,
        targetLanguage: this.voiceFlow.translation?.targetLanguage,
        sourceLanguage: this.voiceFlow.translation?.sourceLanguage,
        geminiModelConfig: this.voiceFlow.translation?.geminiModelConfig,
        // Extra config override
        ...this.voiceFlow.extraConfig,
        ...payload
      };
      
      
      
      this.ws.send(JSON.stringify(msg));
    } catch (error) {
      this.emitError("communication", "Failed to send start message");
    }
  }

  private sendTranslationConfig(): void {
    try {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
      const msg = {
        type: "start",
        translationEnabled: this.voiceFlow.translation?.enabled,
        translationPrompt: this.voiceFlow.translation?.prompt,
        targetLanguage: this.voiceFlow.translation?.targetLanguage,
        sourceLanguage: this.voiceFlow.translation?.sourceLanguage,
        geminiModelConfig: this.voiceFlow.translation?.geminiModelConfig,
      };
      this.ws.send(JSON.stringify(msg));
    } catch {}
  }

  private async startPCM() {
    const frameMs = this.voiceFlow.frameMs ?? 10;  // CRITICAL: Reduced from 20ms to 10ms
    const targetHz = this.voiceFlow.targetHz ?? 16000;

    // Try exact constraints first (preserves desktop behavior)
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          channelCount: 1, 
          noiseSuppression: true, 
          echoCancellation: true,
          sampleRate: targetHz
        } 
      });
    } catch (error) {
      // Fallback to ideal constraints for mobile compatibility
      console.warn('[VoiceFlow] Exact audio constraints failed, trying ideal constraints:', error);
      stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          channelCount: { ideal: 1 }, 
          noiseSuppression: true, 
          echoCancellation: true,
          sampleRate: { ideal: targetHz }
        } 
      });
    }
    
    const ctx = new AudioContext({ latencyHint: "interactive" });
    
    // Mobile-specific: ensure AudioContext is running
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    // inline worklet to avoid extra file
    const WORKLET_SOURCE = `
class PCMWorklet extends AudioWorkletProcessor {
  constructor(){ super(); this.buf=[]; this.frameSamples=0; this.target=16000;
    this.port.onmessage = e => { const {frameMs=20,targetHz=16000}=e.data||{}; this.frameSamples=Math.max(1, Math.round(frameMs*sampleRate/1000)); this.target=targetHz; };
  }
  downsample(x,inHz,outHz){ if(inHz===outHz) return x; const r=inHz/outHz, L=Math.floor(x.length/r), y=new Float32Array(L); let p=0; for(let i=0;i<L;i++){ y[i]=x[Math.floor(p)]||0; p+=r; } return y; }
  to16(f){ const b=new ArrayBuffer(f.length*2), v=new DataView(b); let o=0; for(let i=0;i<f.length;i++,o+=2){ let s=Math.max(-1,Math.min(1,f[i])); v.setInt16(o, s<0?s*0x8000:s*0x7fff, true);} return b; }
  process(inputs){ const c=inputs[0]?.[0]; if(!c) return true; this.buf.push(...c);
    while(this.buf.length>=this.frameSamples){ const frame=this.buf.splice(0,this.frameSamples);
      const ds=this.downsample(Float32Array.from(frame), sampleRate, this.target);
      const pcm=this.to16(ds); this.port.postMessage(pcm, [pcm]); }
    return true; }
}
registerProcessor("pcm-worklet", PCMWorklet);
`;
    await ctx.audioWorklet.addModule(URL.createObjectURL(new Blob([WORKLET_SOURCE], { type: "text/javascript" })));
    const src = ctx.createMediaStreamSource(stream);
    const node = new AudioWorkletNode(ctx, "pcm-worklet");
    node.port.postMessage({ frameMs, targetHz });
    src.connect(node);

    this.cleanup = () => { 
      try { 
        // Starting cleanup
        node.disconnect(); 
        src.disconnect(); 
        
        // CRITICAL: Check flag BEFORE attempting to close AudioContext
        if (!this.audioContextClosed && ctx.state !== 'closed') {
          // Closing AudioContext
          ctx.close();
          this.audioContextClosed = true;
        } else {
          // AudioContext already closed, skipping
        }
      } catch (error) {
        // Cleanup error - ensure flag is set even if close fails
        this.audioContextClosed = true;
      }; 
      stream.getTracks().forEach(t => t.stop()); 
    };
    this.sendStart({ mode: "PCM16", sampleRateHz: targetHz });

    node.port.onmessage = (e) => {
      const buf = e.data as ArrayBuffer;
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(buf);
        } catch {}
      }
    };
  }

  private async startOpus() {
    // Try exact constraints first (preserves desktop behavior)
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          channelCount: 1, 
          noiseSuppression: true, 
          echoCancellation: true,
          sampleRate: 48000
        } 
      });
    } catch (error) {
      // Fallback to ideal constraints for mobile compatibility
      console.warn('[VoiceFlow] Exact audio constraints failed, trying ideal constraints:', error);
      stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          channelCount: { ideal: 1 }, 
          noiseSuppression: true, 
          echoCancellation: true,
          sampleRate: { ideal: 48000 }
        } 
      });
    }
    
    // Detect best supported MIME type
    const mimeTypes = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4'
    ];
    const mimeType = mimeTypes.find(m => MediaRecorder.isTypeSupported(m)) || 'audio/webm;codecs=opus';
    
    // CRITICAL FIX: Use timeslice of 10ms for immediate audio chunks
    // 40ms was causing batching delays
    const rec = new MediaRecorder(stream, { 
      mimeType: mimeType, 
      audioBitsPerSecond: 32000 
    });
    
    this.cleanup = () => { try { rec.stop(); } catch {}; stream.getTracks().forEach(t => t.stop()); };
    this.sendStart({ mode: "WEBM_OPUS" });
    
    // CRITICAL: Use 10ms timeslice for real-time streaming (was 40ms)
    rec.start(10);
    
    // CRITICAL: Remove async to prevent event loop delays
    rec.ondataavailable = (e) => {
      if (e.data.size > 0 && this.ws && this.ws.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(e.data);
        } catch {}
      }
    };
  }

  private handleMessage(ev: MessageEvent) {
    const data = JSON.parse(ev.data) as ServerTranscriptMsg | ServerTranslationMsg | ServerInfoMsg;
    
    // Minimal logging only for errors is retained
    
    // Handle error messages
    if (data.type === "error") {
      this.emitError("service", (data as any).err || "unknown_error");
      return;
    }
    
    // Handle info messages (e.g., stream rotation notifications)
    if (data.type === "info" || data.type === "ready" || data.type === "stopped") {
      // Don't call finish() - VoiceFlow handles stream rotation internally
      return;
    }
    
    // Handle translation messages first
    if ((data as any).type === "translation") {
      if (this.ontranslation) {
        const t = data as ServerTranslationMsg;
        const evt: any = new Event("translation");
        evt.original = t.original;
        evt.translated = t.translated;
        evt.sourceLanguage = t.sourceLanguage;
        evt.targetLanguage = t.targetLanguage;
        evt.translationId = t.translationId;
        evt.timestamp = t.timestamp;
        this.ontranslation(evt);
      }
      return;
    }

    // Handle transcript messages
    if (data.type !== "transcript") return;

    const t = data as ServerTranscriptMsg;
    const alt = { transcript: t.transcript, confidence: t.confidence };
    const result = makeResult([alt], t.isFinal);
    const list = makeResultList([result]);

    const evt: any = new Event("result");
    evt.results = list;
    evt.resultIndex = list.length - 1;
    this.onresult?.(evt);
  }

  private emitError(name: string, message: string) {
    const e: any = new Event("error");
    e.error = name;
    e.message = message;
    this.onerror?.(e);
  }

  private finish(reason: "stop" | "abort" | "end"): void {
    // finish() called
    
    // CRITICAL FIX: Don't cleanup or close WebSocket for normal operations
    // VoiceFlow handles stream rotation internally - we should NOT interfere
    // Only cleanup for user-initiated stops or critical errors
    
    if (reason === "stop" || reason === "abort") {
      // User-initiated stop/abort - cleaning up
      // User-initiated stop - cleanup everything
      try { this.ws?.close(); } catch {}
      try { this.cleanup?.(); } catch {}
      this.onaudioend?.(new Event("audioend"));
      this.onend?.(new Event("end"));
    } else if (reason === "end" && this.userStopped) {
      // User-initiated end - cleaning up
      // User-initiated end - cleanup everything
      try { this.ws?.close(); } catch {}
      try { this.cleanup?.(); } catch {}
      this.onaudioend?.(new Event("audioend"));
      this.onend?.(new Event("end"));
    } else {
      // Normal stream rotation - NO cleanup, letting VoiceFlow handle internally
    }
    // For normal stream rotations (reason === "end" && !this.userStopped), do NOTHING
    // Let VoiceFlow handle everything internally
    
    // Reset state for next session
    this.started = false;
    this.userStopped = false;
    this.audioContextClosed = false;
  }
}

function makeResult(alts: Alt[], isFinal: boolean) {
  const a: any = alts.map(({ transcript, confidence }) => ({ transcript, confidence }));
  (a as any).isFinal = isFinal;
  (a as any).length = alts.length;
  (a as any).item = (i: number) => a[i];
  return a;
}
function makeResultList(results: any[]) {
  const l: any = results.slice();
  (l as any).length = results.length;
  (l as any).item = (i: number) => l[i];
  return l;
}
