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
  
  // Translation features
  translation?: {
    enabled: boolean;
    prompt: string;
    targetLanguage: string;
    sourceLanguage: string;
    geminiConfig: {
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
  onspeechstart: ((e: Event) => void) | null = null;
  onspeechend: ((e: Event) => void) | null = null;
  onresult: ((e: any) => void) | null = null;
  onerror: ((e: any) => void) | null = null;
  onend: ((e: Event) => void) | null = null;
  oninfo: ((e: any) => void) | null = null;
  ontranslation: ((e: any) => void) | null = null;

  voiceFlow: VoiceFlowExtras = {};

  private ws?: WebSocket;
  private cleanup?: () => void;
  private started = false;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private speechActive = false;

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
        this.reconnectAttempts = 0;
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
        
        if (ev.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          console.log(`WebSocket closed with code ${ev.code}, attempting reconnect ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
          setTimeout(() => {
            if (this.started) this.start();
          }, 1000 * this.reconnectAttempts);
          return;
        }
        
        this.finish("end");
      };
    } catch (error) {
      console.error("Failed to create WebSocket:", error);
      this.started = false;
      this.emitError("network", "Failed to create WebSocket connection");
    }
  }

  stop(): void {
    try { 
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: "stop" })); 
      }
    } catch {}
    this.finish("stop");
  }

  abort(): void {
    this.finish("abort");
  }

  // Translation methods
  enableTranslation(config: {
    prompt: string;
    targetLanguage: string;
    sourceLanguage: string;
    geminiConfig: {
      model: string;
      temperature?: number;
      maxTokens?: number;
      topP?: number;
      topK?: number;
      stopSequences?: string[];
    };
  }): void {
    this.voiceFlow.translation = {
      enabled: true,
      ...config
    };
    
    // Send updated configuration to server if connected
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.sendTranslationConfig();
    }
  }

  disableTranslation(): void {
    if (this.voiceFlow.translation) {
      this.voiceFlow.translation.enabled = false;
      
      // Send updated configuration to server if connected
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.sendTranslationConfig();
      }
    }
  }

  setTranslationPrompt(prompt: string): void {
    if (this.voiceFlow.translation) {
      this.voiceFlow.translation.prompt = prompt;
      
      // Send updated configuration to server if connected
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
    if (this.voiceFlow.translation) {
      this.voiceFlow.translation.geminiConfig = config;
      
      // Send updated configuration to server if connected
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.sendTranslationConfig();
      }
    }
  }

  private sendTranslationConfig(): void {
    if (!this.voiceFlow.translation) return;
    
    try {
      const msg = {
        type: "start",
        translationEnabled: this.voiceFlow.translation.enabled,
        translationPrompt: this.voiceFlow.translation.prompt,
        targetLanguage: this.voiceFlow.translation.targetLanguage,
        sourceLanguage: this.voiceFlow.translation.sourceLanguage,
        geminiModelConfig: this.voiceFlow.translation.geminiConfig
      };
      this.ws!.send(JSON.stringify(msg));
    } catch (error) {
      console.error("Failed to send translation config:", error);
    }
  }

  // --- internals ---
  private async handleOpen(): Promise<void> {
    try {
      // Add a small delay to ensure WebSocket is fully ready
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const mode = this.voiceFlow.captureMode ?? "auto";
      const usePCM = mode === "PCM16" || (mode === "auto" && "audioWorklet" in (AudioContext.prototype as any));
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
        // Translation features
        translationEnabled: this.voiceFlow.translation?.enabled,
        translationPrompt: this.voiceFlow.translation?.prompt,
        targetLanguage: this.voiceFlow.translation?.targetLanguage,
        sourceLanguage: this.voiceFlow.translation?.sourceLanguage,
        geminiModelConfig: this.voiceFlow.translation?.geminiConfig,
        // Extra config override
        ...this.voiceFlow.extraConfig,
        ...payload
      };
      this.ws.send(JSON.stringify(msg));
    } catch (error) {
      this.emitError("communication", "Failed to send start message");
    }
  }

  private async startPCM() {
    const frameMs = this.voiceFlow.frameMs ?? 10;  // CRITICAL: Reduced from 20ms to 10ms
    const targetHz = this.voiceFlow.targetHz ?? 16000;

    const stream = await navigator.mediaDevices.getUserMedia({ 
      audio: { 
        channelCount: 1, 
        noiseSuppression: true, 
        echoCancellation: true,
        sampleRate: targetHz
      } 
    });
    const ctx = new AudioContext({ latencyHint: "interactive" });

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

    this.cleanup = () => { try { node.disconnect(); src.disconnect(); ctx.close(); } catch {}; stream.getTracks().forEach(t => t.stop()); };
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
    const stream = await navigator.mediaDevices.getUserMedia({ 
      audio: { 
        channelCount: 1, 
        noiseSuppression: true, 
        echoCancellation: true,
        sampleRate: 48000
      } 
    });
    
    // CRITICAL FIX: Use timeslice of 10ms for immediate audio chunks
    // 40ms was causing batching delays
    const rec = new MediaRecorder(stream, { 
      mimeType: "audio/webm;codecs=opus", 
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
    
    // Handle error messages
    if (data.type === "error") {
      this.emitError("service", (data as any).err || "unknown_error");
      return;
    }
    
    // Handle info messages (e.g., stream rotation notifications)
    if (data.type === "info" || data.type === "ready" || data.type === "stopped") {
      if (this.oninfo) {
        const evt: any = new Event("info");
        evt.data = data;
        evt.messageType = data.type;
        evt.info = data;
        this.oninfo(evt);
      }
      return;
    }
    
        // Handle translation messages
        if (data.type === "translation") {
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
    evt.stability = t.stability;
    evt.segment = (t as any).segment;
    evt.streamId = (t as any).streamId;
    evt.adjustedTime = (t as any).adjustedTime;
    evt.bridgingOffset = (t as any).bridgingOffset;
    this.onresult?.(evt);

    // Fire speech detection events only on state transitions
    if (!this.speechActive && t.transcript && t.transcript.trim()) {
      // Speech just started
      this.speechActive = true;
      if (this.onspeechstart) this.onspeechstart(new Event("speechstart"));
    }
    
    if (this.speechActive && t.isFinal) {
      // Speech just ended (got final result)
      this.speechActive = false;
      if (this.onspeechend) this.onspeechend(new Event("speechend"));
    }
  }

  private emitError(name: string, message: string) {
    const e: any = new Event("error");
    e.error = name;
    e.message = message;
    this.onerror?.(e);
  }

  private finish(_reason: "stop" | "abort" | "end"): void {
    try { this.ws?.close(); } catch {}
    try { this.cleanup?.(); } catch {}
    this.started = false;
    this.speechActive = false;
    this.onaudioend?.(new Event("audioend"));
    this.onend?.(new Event("end"));
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
