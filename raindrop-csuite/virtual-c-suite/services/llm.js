const https = require('https');

// Cerebras API Configuration
const CEREBRAS_API_URL = 'https://api.cerebras.ai/v1/chat/completions';

async function runLLM(prompt, apiKey) {
  if (!apiKey) {
    throw new Error('Cerebras API Key is missing');
  }

  const data = JSON.stringify({
    model: 'llama3.1-70b', // Using a supported model
    messages: [
      { role: 'user', content: prompt }
    ],
    temperature: 0.7,
    max_tokens: 1000,
    stream: false
  });

  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'Content-Length': data.length
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(CEREBRAS_API_URL, options, (res) => {
      let responseBody = '';

      res.on('data', (chunk) => {
        responseBody += chunk;
      });

      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const json = JSON.parse(responseBody);
            const content = json.choices[0]?.message?.content;
            resolve(content || 'No content generated');
          } catch (e) {
            reject(new Error('Failed to parse Cerebras response: ' + e.message));
          }
        } else {
          reject(new Error(`Cerebras API Error: ${res.statusCode} - ${responseBody}`));
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

module.exports = { runLLM };
