const https = require('https');

// Voice IDs
const VOICE_IDS = {
  CFO: "ErXwobaYiN019PkySvjV", // Antoni
  CMO: "EXAVITQu4vr4xnSDxMaL", // Bella
  COO: "TxGEqnHWrfWFTfGW9XjX", // Josh
  CEO: "21m00Tcm4TlvDq8ikWAM", // Rachel
};

async function generateSpeech(text, voiceId, apiKey) {
  if (!apiKey) {
    throw new Error('ElevenLabs API Key is missing');
  }

  const data = JSON.stringify({
    text: text,
    model_id: "eleven_monolingual_v1",
    voice_settings: {
      stability: 0.5,
      similarity_boost: 0.75,
    },
  });

  const options = {
    hostname: 'api.elevenlabs.io',
    path: `/v1/text-to-speech/${voiceId}`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': apiKey,
      'Content-Length': data.length
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      const chunks = [];

      res.on('data', (chunk) => {
        chunks.push(chunk);
      });

      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const buffer = Buffer.concat(chunks);
          resolve(buffer);
        } else {
          reject(new Error(`ElevenLabs API Error: ${res.statusCode}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(data);
    req.end();
  });
}

module.exports = { generateSpeech, VOICE_IDS };
