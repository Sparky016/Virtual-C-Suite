// Script to list all user settings from the database
import { SqlDatabase } from '@liquidmetal-ai/raindrop-framework';

interface UserSettingRow {
  user_id: string;
  inference_provider: string;
  vultr_api_key: string | null;
  sambanova_api_key: string | null;
  elevenlabs_api_key: string | null;
  vultr_rag_collection_id: string | null;
  updated_at: number;
}

async function listUserSettings(db: SqlDatabase) {
  try {
    const result = await db.prepare(
      `SELECT
        user_id,
        inference_provider,
        CASE WHEN vultr_api_key IS NOT NULL THEN '[SET]' ELSE NULL END as vultr_api_key,
        CASE WHEN sambanova_api_key IS NOT NULL THEN '[SET]' ELSE NULL END as sambanova_api_key,
        CASE WHEN elevenlabs_api_key IS NOT NULL THEN '[SET]' ELSE NULL END as elevenlabs_api_key,
        vultr_rag_collection_id,
        updated_at
       FROM user_settings
       ORDER BY updated_at DESC`
    ).all();

    console.log('\n=== User Settings ===\n');
    console.log(`Total users: ${result.results.length}\n`);

    if (result.results.length === 0) {
      console.log('No user settings found.');
      return;
    }

    result.results.forEach((row: any) => {
      const settings = row as UserSettingRow;
      console.log(`User ID: ${settings.user_id}`);
      console.log(`  Provider: ${settings.inference_provider}`);
      console.log(`  Vultr API Key: ${settings.vultr_api_key || 'not set'}`);
      console.log(`  SambaNova API Key: ${settings.sambanova_api_key || 'not set'}`);
      console.log(`  ElevenLabs API Key: ${settings.elevenlabs_api_key || 'not set'}`);
      console.log(`  Vultr RAG Collection: ${settings.vultr_rag_collection_id || 'none'}`);
      console.log(`  Updated: ${new Date(settings.updated_at).toISOString()}`);
      console.log('');
    });
  } catch (error) {
    console.error('Error querying user settings:', error);
    throw error;
  }
}

// For use in local testing or as a module
export { listUserSettings };
