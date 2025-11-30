export interface ElevenLabsConfig {
  apiKey: string;
}

export async function generateSpeech(
  text: string,
  voiceId: string,
  apiKey: string
): Promise<ArrayBuffer> {
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_monolingual_v1",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ElevenLabs API error: ${response.status} ${errorText}`);
  }

  return await response.arrayBuffer();
}

// Voice IDs for our executives
export const VOICE_IDS = {
  CFO: "ErXwobaYiN019PkySvjV", // Antoni - Professional, authoritative
  CMO: "EXAVITQu4vr4xnSDxMaL", // Bella - Energetic, engaging
  COO: "TxGEqnHWrfWFTfGW9XjX", // Josh - Deep, serious
  CEO: "21m00Tcm4TlvDq8ikWAM", // Rachel - Balanced, clear
};
