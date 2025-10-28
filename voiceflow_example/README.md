## VoiceFlow Realtime Captioning & Translation (Client Integration)

This folder contains a minimal browser client for realtime speech-to-text (Google Cloud Speech) with optional live translation (Vertex AI Gemini).

### Prerequisites
- Node.js >= 20
- Google Cloud credentials for Speech-to-Text (set `GOOGLE_APPLICATION_CREDENTIALS` on the server)
- Optional: Vertex AI enabled for translation
- WebSocket bearer token (64 hex chars) set on the server as `WS_BEARER`

### Quick start (server)
Run the server from project root:

```bash
npm install
export GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/your-service-account.json
export WS_BEARER=0123abcd...64-hex-token...
npm run dev
```

The server serves this `public/` folder at `http://localhost:8080/` and exposes a WS endpoint on the same origin.

### Minimal client usage
Use `public/voiceflow.js` in a page and connect to your WS endpoint. Pass the WS bearer token; the client sends it via WS subprotocol automatically.

```html
<script type="module">
  import { VoiceFlowRecognition } from './voiceflow.js';

  // Choose your service URL:
  //  - Local (HTTP): 'ws://localhost:8080'
  //  - HTTPS site:   'wss://your-deployed-ws-endpoint'
  const serviceUrl = location.protocol === 'https:'
    ? 'wss://your-deployed-ws-endpoint'
    : 'ws://localhost:8080';

  const rec = new VoiceFlowRecognition(serviceUrl, {
    // Required if server auth is enabled
    token: '0123abcd...64-hex-token...',

    // Optional recognition config
    model: 'latest_short',
    wordTimeOffsets: true,
    spokenPunctuation: true,

    // Optional capture tuning (low latency defaults are already applied)
    // captureMode: 'auto', frameMs: 10, targetHz: 16000,
  });

  rec.lang = 'en-US';
  rec.interimResults = true;
  rec.maxAlternatives = 1;

  // Live captions
  rec.onresult = (e) => {
    const result = e.results[e.resultIndex];
    const text = result[0].transcript;
    if (!text.trim()) return;
    if (result.isFinal) {
      console.log('[final]', text);
    } else {
      console.log('[interim]', text);
    }
  };

  // Optional: enable live translation (requires Vertex AI on server)
  rec.enableTranslation({
    prompt: 'Translate from {sourceLanguage} to {targetLanguage}.\nText: {transcript}',
    sourceLanguage: 'auto',
    targetLanguage: 'Arabic',
    geminiConfig: {
      model: 'gemini-2.5-flash-lite',
      temperature: 0.4,
      maxTokens: 1000,
      topP: 0.8,
    },
  });

  // Translation results (emitted for final transcripts)
  rec.ontranslation = (e) => {
    console.log(`[translation -> ${e.targetLanguage}]`, e.translated);
  };

  // Diagnostics
  rec.onstart = () => console.log('listening...');
  rec.onerror = (e) => console.error('error:', e.error, e.message || '');
  rec.onend = () => console.log('ended');

  // Start streaming microphone to server
  rec.start();

  // Stop when needed
  // rec.stop();
</script>
```

### Define source/target languages
You can explicitly set both when enabling translation, or update them later:

```javascript
// Enable with explicit languages (use 'auto' to auto-detect source)
rec.enableTranslation({
  prompt: 'Translate from {sourceLanguage} to {targetLanguage}.\nText: {transcript}',
  sourceLanguage: 'auto',     // e.g. 'en-US', 'ar-SA', 'de-AT', or 'auto'
  targetLanguage: 'French',   // e.g. 'English', 'Arabic', 'German', 'French', 'Spanish'
  geminiConfig: { model: 'gemini-2.5-flash-lite', temperature: 0.4, maxTokens: 1000, topP: 1.0 }
});

// Update languages mid-session (re-sends config to server)
rec.enableTranslation({
  prompt: rec.voiceFlow.translation?.prompt || 'Translate...',
  sourceLanguage: 'en-US',
  targetLanguage: 'Arabic',
  geminiConfig: rec.voiceFlow.translation?.geminiConfig || { model: 'gemini-2.5-flash-lite' }
});
```

### Auth model (WS bearer)
- Server requires `WS_BEARER` (64 hex). The browser must pass the same token via `VoiceFlowRecognition` extras: `{ token: '...' }`.
- The client sends the token using WS subprotocols: `['bearer', <token>]`.
- Do not hardcode tokens in production apps. Prompt users and store in `sessionStorage` or fetch from a backend.

### Events you can handle
- `onresult(e)`: realtime captions; `result.isFinal` distinguishes interim vs final.
- `ontranslation(e)`: live translations for final captions.
- `oninfo(e)`: info like seamless stream rotation (Google infinite streaming).
- `onerror(e)`: errors (`e.error`, `e.message`).
- `onstart`, `onspeechstart`, `onspeechend`, `onaudioend`, `onend`.

### Latency notes
- Client auto-selects the lowest-latency path: PCM16 via AudioWorklet (10 ms frames) when available, else WebM/Opus via MediaRecorder (10 ms chunks).
- Server implements Google’s infinite streaming with bridging for uninterrupted long sessions.

### Enabling translation on the server
Ensure Vertex AI is initialized with the correct project and location (see `src/server.ts`, env: `GOOGLE_CLOUD_PROJECT`, `VERTEX_AI_LOCATION`). Translation is only active when the client enables it and provides a `geminiConfig`.

### See also
- `public/index.html`: a full-featured demo UI (login + controls)
- `public/voiceflow.ts`: client implementation used by the demo
- `src/server.ts`: HTTP + WS relay, Google Speech, Vertex AI translation


