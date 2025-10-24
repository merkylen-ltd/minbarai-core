export interface VoiceFlowConfig {
  url: string;
  token: string;
}

export function getVoiceFlowConfig(): VoiceFlowConfig {
  // Determine which URL to use based on environment
  const isProduction = process.env.VERCEL_ENV === 'production';
  const prodUrl = process.env.NEXT_PUBLIC_VOICEFLOW_WS_URL_PROD;
  const devUrl = process.env.NEXT_PUBLIC_VOICEFLOW_WS_URL;
  
  const url = isProduction && prodUrl ? prodUrl : devUrl;
  const token = process.env.NEXT_PUBLIC_VOICEFLOW_WS_TOKEN;

  if (!url) {
    throw new Error(
      `VoiceFlow WebSocket URL not configured. Please set ${
        isProduction ? 'NEXT_PUBLIC_VOICEFLOW_WS_URL_PROD' : 'NEXT_PUBLIC_VOICEFLOW_WS_URL'
      } environment variable.`
    );
  }

  if (!token) {
    throw new Error(
      'VoiceFlow WebSocket token not configured. Please set NEXT_PUBLIC_VOICEFLOW_WS_TOKEN environment variable.'
    );
  }

  return { url, token };
}

export function isVoiceFlowConfigured(): boolean {
  try {
    getVoiceFlowConfig();
    return true;
  } catch {
    return false;
  }
}
