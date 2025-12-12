-- Add user_settings table for storing inference provider and API keys
-- This table supports BYOK (Bring Your Own Key) for Vultr, SambaNova, and ElevenLabs

CREATE TABLE IF NOT EXISTS user_settings (
  user_id TEXT PRIMARY KEY,
  inference_provider TEXT NOT NULL CHECK(inference_provider IN ('vultr', 'sambanova', 'cloudflare')),
  vultr_api_key TEXT,
  sambanova_api_key TEXT,
  elevenlabs_api_key TEXT,
  updated_at INTEGER NOT NULL
);
