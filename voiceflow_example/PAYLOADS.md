## Exact WebSocket Payloads Sent from Browser to Relay

These are the exact JSON payloads constructed by the client (`public/voiceflow.ts`) and sent over WebSocket.

Note: Authentication token is NOT in the JSON body. It is sent via WebSocket subprotocols as `['bearer', <64-hex-token>]`.

### Start (PCM16 capture)
Sent when the client uses the AudioWorklet PCM16 path (10 ms frames, 16 kHz):

```json
{
  "type": "start",
  "mode": "PCM16",
  "languageCode": "en-US",
  "interimResults": true,
  "singleUtterance": false,
  "maxAlternatives": 1,
  "model": "latest_short",
  "useEnhanced": false,
  "wordTimeOffsets": true,
  "enableWordConfidence": false,
  "profanityFilter": false,
  "spokenPunctuation": true,
  "spokenEmojis": false,
  "phraseHints": ["MinbarAI"],
  "diarization": null,
  "audioChannelCount": 1,
  "enableSeparateRecognitionPerChannel": false,
  "alternativeLanguageCodes": null,
  "metadata": null,
  "adaptation": null,
  "transcriptNormalization": null,
  "translationEnabled": false,
  "translationPrompt": null,
  "targetLanguage": null,
  "sourceLanguage": null,
  "geminiModelConfig": null,
  "sampleRateHz": 16000
}
```

### Start (WEBM_OPUS capture)
Sent when the browser falls back to MediaRecorder Opus (10 ms chunks, 48 kHz):

```json
{
  "type": "start",
  "mode": "WEBM_OPUS",
  "languageCode": "en-US",
  "interimResults": true,
  "singleUtterance": false,
  "maxAlternatives": 1,
  "model": "latest_short",
  "useEnhanced": false,
  "wordTimeOffsets": true,
  "enableWordConfidence": false,
  "profanityFilter": false,
  "spokenPunctuation": true,
  "spokenEmojis": false,
  "phraseHints": ["MinbarAI"],
  "diarization": null,
  "audioChannelCount": 1,
  "enableSeparateRecognitionPerChannel": false,
  "alternativeLanguageCodes": null,
  "metadata": null,
  "adaptation": null,
  "transcriptNormalization": null,
  "translationEnabled": false,
  "translationPrompt": null,
  "targetLanguage": null,
  "sourceLanguage": null,
  "geminiModelConfig": null
}
```

### Start with Translation Enabled
If translation is enabled from the UI or via `enableTranslation`, the same `start` includes translation fields:

```json
{
  "type": "start",
  "mode": "PCM16",
  "languageCode": "en-US",
  "interimResults": true,
  "singleUtterance": false,
  "maxAlternatives": 1,
  "model": "latest_short",
  "wordTimeOffsets": true,
  "spokenPunctuation": true,
  "phraseHints": ["MinbarAI"],
  "translationEnabled": true,
  "translationPrompt": "You are an expert translator specializing in Islamic content.\nTranslate the following text from {sourceLanguage} to {targetLanguage}.\nPreserve religious terminology accuracy and cultural context.\n\nText: {transcript}",
  "targetLanguage": "Arabic",
  "sourceLanguage": "auto",
  "geminiModelConfig": {
    "model": "gemini-2.5-flash-lite",
    "temperature": 0.7,
    "maxTokens": 1000,
    "topP": 0.8
  },
  "sampleRateHz": 16000
}
```

### Runtime Translation Update
When translation is toggled/updated mid-session, a minimal `start` is sent with just translation fields:

```json
{
  "type": "start",
  "translationEnabled": true,
  "translationPrompt": "Translate from {sourceLanguage} to {targetLanguage}.\nText: {transcript}",
  "targetLanguage": "French",
  "sourceLanguage": "en-US",
  "geminiModelConfig": {
    "model": "gemini-2.5-flash",
    "temperature": 0.7,
    "maxTokens": 1000,
    "topP": 0.8
  }
}
```

To disable translation at runtime:

```json
{
  "type": "start",
  "translationEnabled": false,
  "translationPrompt": null,
  "targetLanguage": null,
  "sourceLanguage": null,
  "geminiModelConfig": null
}
```

### Stop
Sent when stopping recognition from the client:

```json
{ "type": "stop" }
```

### Ping
Optional application ping (the server also uses ws-level heartbeat):

```json
{ "type": "ping" }
```


