import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { stream } from 'hono/streaming';
import { BucketListOptions } from '@liquidmetal-ai/raindrop-framework';
import { Env } from './raindrop.gen';
import { StorageService } from '../services/StorageService';
import { CacheService } from '../services/Cache/CacheService';
import { AIOrchestrationService } from '../services/AIOrchestrationService';
import { DatabaseService } from '../services/Database/DatabaseService';
import { LoggerService } from '../services/Logger/LoggerService';

// Create Hono app with middleware
export const app = new Hono<{ Bindings: Env }>();

// Add request logging middleware
app.use('*', logger());
app.use('*', cors({
  origin: (origin) => {
    // Allow local development
    if (!origin || origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
      return origin;
    }
    return origin; // Fallback to reflecting origin for now, or refine for prod
  },
  credentials: true,
}));

// Health check endpoint
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// === Document Management Routes (SmartBucket) ===

// Upload a document (and auto-ingest)
app.post('/api/documents', async (c) => {
  try {
    const formData = await c.req.formData();
    const file = formData.get('file') as File;
    const userId = formData.get('userId') as string || 'anonymous';
    const keyPrefix = formData.get('prefix') as string || '';

    if (!file) {
      return c.json({ error: 'File is required' }, 400);
    }

    const storage = new StorageService(c.env.INPUT_BUCKET);
    const key = keyPrefix ? `${keyPrefix}/${file.name}` : file.name;

    // Upload to bucket
    const arrayBuffer = await file.arrayBuffer();
    await storage.put(key, new Uint8Array(arrayBuffer), {
      httpMetadata: { contentType: file.type || 'application/octet-stream' },
      customMetadata: { userId, originalName: file.name, uploadedAt: new Date().toISOString() }
    });

    // Auto-ingest into Vector Store (Vultr RAG)
    try {
      if ((c.env as any).AI) {
        const textContent = await file.text();
        const aiService = new AIOrchestrationService(c.env.AI, (c.env as any).POSTHOG_API_KEY, undefined, c.env.TRACKING_DB);
        // Fire and forget ingestion
        aiService.ingestFileIntoVectorStore(userId, textContent, file.name);
      }
    } catch (ingestError) {
      console.warn('Failed to trigger vector store ingestion', ingestError);
    }

    return c.json({
      success: true,
      message: 'File uploaded and ingestion triggered',
      key
    }, 201);
  } catch (error) {
    console.error('Upload error:', error);
    return c.json({
      error: 'Failed to upload document',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

app.get('/api/documents', async (c) => {
  try {
    const query = c.req.query();

    const prefix = query.prefix || undefined;
    const limit = query.limit;
    const limitNum = limit ? parseInt(limit) : undefined;

    const storage = new StorageService(c.env.INPUT_BUCKET);

    const listOptions: BucketListOptions = {
      prefix,
      limit: limitNum
    };

    const result = await storage.list(listOptions);

    return c.json({
      success: true,
      objects: result.objects.map((obj: any) => ({
        key: obj.key,
        size: obj.size,
        uploaded: obj.uploaded,
        etag: obj.etag
      })),
      truncated: result.truncated,
      cursor: result.truncated ? result.cursor : undefined
    });
  } catch (error) {
    console.error('List documents error:', error);
    return c.json({
      error: 'Failed to list documents',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Delete a document
app.delete('/api/documents/:key', async (c) => {
  try {
    const key = c.req.param('key');
    if (!key) return c.json({ error: 'Key required' }, 400);

    const storage = new StorageService(c.env.INPUT_BUCKET);
    await storage.delete(key);

    return c.json({
      success: true,
      message: 'Document deleted from storage',
      key
    });
  } catch (error) {
    console.error('Delete document error:', error);
    return c.json({
      error: 'Failed to delete document',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Download/Get a specific document
app.get('/api/documents/:key', async (c) => {
  try {
    const key = c.req.param('key');
    if (!key) return c.json({ error: 'Key required' }, 400);

    const storage = new StorageService(c.env.INPUT_BUCKET);
    const file = await storage.get(key);

    if (!file) {
      return c.json({ error: 'File not found' }, 404);
    }

    return new Response(file.body, {
      headers: {
        'Content-Type': file.httpMetadata?.contentType || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${key}"`,
        'X-Object-Size': file.size.toString(),
        'X-Object-ETag': file.etag,
        'X-Object-Uploaded': file.uploaded.toISOString(),
      }
    });
  } catch (error) {
    console.error('Get document error:', error);
    return c.json({
      error: 'Failed to retrieve file',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Search documents (SmartBucket Feature)
app.post('/api/documents/search', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const { query, page = 1, pageSize = 10, requestId } = body;

    if (!query) {
      return c.json({ error: 'Query is required' }, 400);
    }

    const storage = new StorageService(c.env.INPUT_BUCKET);

    // For initial search
    if (page === 1) {
      const results = await storage.search(query);

      return c.json({
        success: true,
        message: 'Search completed',
        query,
        results: results.results,
        pagination: results.pagination
      });
    } else {
      // For paginated results
      if (!requestId) {
        return c.json({ error: 'Request ID required for pagination' }, 400);
      }

      const paginatedResults = await storage.search(query, page, pageSize, requestId);

      return c.json({
        success: true,
        message: 'Paginated results',
        query,
        results: paginatedResults.results,
        pagination: paginatedResults.pagination
      });
    }
  } catch (error) {
    console.error('Search error:', error);
    return c.json({
      error: 'Search failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Manual trigger for document ingestion (RAG)
app.post('/api/documents/:key/ingest', async (c) => {
  try {
    const key = c.req.param('key');
    const body = await c.req.json().catch(() => ({}));
    const userId = body.userId || 'anonymous'; // Passed in body since user context handles it

    if (!key) return c.json({ error: 'Key required' }, 400);

    const storage = new StorageService(c.env.INPUT_BUCKET);
    const file = await storage.get(key);

    if (!file) {
      return c.json({ error: 'File not found' }, 404);
    }

    // Read content
    const textContent = await file.text();

    if ((c.env as any).AI) {
      const aiService = new AIOrchestrationService(c.env.AI, (c.env as any).POSTHOG_API_KEY, undefined, c.env.TRACKING_DB);
      // Wait for ingestion here to report success/failure
      await aiService.ingestFileIntoVectorStore(userId, textContent, key);

      return c.json({
        success: true,
        message: 'Document ingestion triggered successfully',
        key
      });
    } else {
      return c.json({ error: 'AI binding not available' }, 503);
    }

  } catch (error) {
    console.error('Manual ingestion error:', error);
    return c.json({
      error: 'Failed to ingest document',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Document Chat (RAG) (SmartBucket Feature)
app.post('/api/documents/chat', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const { objectId, query } = body;

    if (!objectId || !query) {
      return c.json({ error: 'objectId (file key) and query are required' }, 400);
    }

    const storage = new StorageService(c.env.INPUT_BUCKET);
    const response = await storage.documentChat(objectId, query);

    return c.json({
      success: true,
      message: 'Document chat completed',
      objectId,
      query,
      answer: response.answer
    });
  } catch (error) {
    console.error('Chat error:', error);
    return c.json({
      error: 'Document chat failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// CEO Chat (Conversation with Board Consultation)
app.post('/api/ceo-chat', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const { messages, requestId = 'chat-' + Date.now(), userId = 'anonymous' } = body;

    if (!messages || !Array.isArray(messages)) {
      return c.json({ error: 'messages array is required' }, 400);
    }

    const aiService = new AIOrchestrationService(c.env.AI, (c.env as any).POSTHOG_API_KEY, undefined, c.env.TRACKING_DB);
    const response = await aiService.executeCEOChat(
      messages,
      requestId,
      userId,
      c.env.TRACKING_DB,
      c.env.INPUT_BUCKET
    );

    return c.json({
      success: response.success,
      reply: response.reply,
      consultedExecutives: response.consultedExecutives,
      metrics: {
        duration: response.totalDuration,
        consultationDuration: response.consultationDuration,
        attempts: response.attempts
      }
    });
  } catch (error) {
    console.error('CEO chat error:', error);
    return c.json({
      error: 'CEO chat failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// CEO Chat (Streaming version with Server-Sent Events)
app.post('/api/ceo-chat/stream', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const { messages, requestId = 'chat-' + Date.now(), userId = 'anonymous' } = body;

    if (!messages || !Array.isArray(messages)) {
      return c.json({ error: 'messages array is required' }, 400);
    }

    return stream(c, async (stream) => {
      try {
        const aiService = new AIOrchestrationService(c.env.AI, (c.env as any).POSTHOG_API_KEY, undefined, c.env.TRACKING_DB);

        // Stream events as they occur
        for await (const event of aiService.executeCEOChatStream(
          messages,
          requestId,
          userId,
          c.env.TRACKING_DB,
          c.env.INPUT_BUCKET
        )) {
          await stream.write(`data: ${JSON.stringify(event)}\n\n`);
        }

        // Signal completion
        await stream.write('data: [DONE]\n\n');
      } catch (error) {
        console.error('CEO chat stream error:', error);
        await stream.write(`data: ${JSON.stringify({
          type: 'error',
          error: 'CEO chat failed',
          message: error instanceof Error ? error.message : 'Unknown error'
        })}\n\n`);
      }
    });
  } catch (error) {
    console.error('CEO chat stream setup error:', error);
    return c.json({
      error: 'CEO chat stream failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// === KV Cache Routes ===

// Store data in cache
app.post('/api/cache', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const key = body.key;
    const value = body.value;
    const ttl = body.ttl;

    if (!key || value === undefined) {
      return c.json({ error: 'key and value are required' }, 400);
    }

    const cache = new CacheService(c.env.mem);
    await cache.put(key, value, ttl);

    return c.json({
      success: true,
      message: 'Data cached successfully',
      key
    });
  } catch (error) {
    console.error('Cache put error:', error);
    return c.json({
      error: 'Cache put failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Get data from cache
app.get('/api/cache/:key', async (c) => {
  try {
    const key = c.req.param('key');
    const cache = new CacheService(c.env.mem);
    const value = await cache.get(key);

    if (value === null) {
      return c.json({ error: 'Key not found in cache' }, 404);
    }

    return c.json({
      success: true,
      key,
      value
    });
  } catch (error) {
    console.error('Cache get error:', error);
    return c.json({
      error: 'Cache get failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// === User Settings Routes ===

app.get('/api/settings', async (c) => {
  try {
    const userId = c.req.query('userId') || 'anonymous';
    const dbService = new DatabaseService(c.env.TRACKING_DB, new LoggerService((c.env as any).POSTHOG_API_KEY));
    const settings = await dbService.getUserSettings(userId);
    return c.json({ success: true, settings });
  } catch (error) {
    console.error('Get settings error:', error);
    return c.json({
      error: 'Failed to get settings',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

app.post('/api/settings', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const incomingSettings = body.settings;

    if (!incomingSettings || !incomingSettings.user_id) {
      return c.json({ error: 'Valid settings object with user_id is required' }, 400);
    }

    const dbService = new DatabaseService(c.env.TRACKING_DB, new LoggerService((c.env as any).POSTHOG_API_KEY));

    // 1. Fetch existing settings to allow partial updates
    const existingSettings = await dbService.getUserSettings(incomingSettings.user_id);

    // 2. Handle typo correction (samba_nova_api_key -> sambanova_api_key)
    if (incomingSettings.samba_nova_api_key && !incomingSettings.sambanova_api_key) {
      incomingSettings.sambanova_api_key = incomingSettings.samba_nova_api_key;
    }

    // 3. Merge settings: Default < Existing < Incoming
    // Note: We cast to any to handle the merge dynamically, then cast back to UserSettings for safety where possible
    const mergedSettings: any = {
      inference_provider: 'vultr', // Default provider
      ...existingSettings,
      ...incomingSettings,
      updated_at: Date.now()
    };

    // 4. Smart provider inference: If user provides a key but no explicit provider, infer the provider
    if (!incomingSettings.inference_provider) {
      // User didn't explicitly set provider, infer from keys provided
      if (incomingSettings.sambanova_api_key || incomingSettings.samba_nova_api_key) {
        mergedSettings.inference_provider = 'sambanova';
      } else if (incomingSettings.vultr_api_key) {
        mergedSettings.inference_provider = 'vultr';
      }
      // If cloudflare is set explicitly or no keys provided, keep default (vultr) or existing
    }

    // 5. Validate that the selected provider has the required API key
    const provider = mergedSettings.inference_provider;
    if (provider === 'vultr' && !mergedSettings.vultr_api_key) {
      return c.json({
        error: 'Missing API key',
        message: 'Vultr provider requires a vultr_api_key. Please provide your Vultr API key or switch to a different provider.',
        provider: 'vultr',
        field: 'vultr_api_key'
      }, 400);
    }
    if (provider === 'sambanova' && !mergedSettings.sambanova_api_key) {
      return c.json({
        error: 'Missing API key',
        message: 'SambaNova provider requires a sambanova_api_key. Please provide your SambaNova API key or switch to a different provider.',
        provider: 'sambanova',
        field: 'sambanova_api_key'
      }, 400);
    }

    // Ensure strictly typed object for the service call
    const finalSettings = {
      user_id: mergedSettings.user_id,
      inference_provider: mergedSettings.inference_provider,
      vultr_api_key: mergedSettings.vultr_api_key,
      sambanova_api_key: mergedSettings.sambanova_api_key,
      elevenlabs_api_key: mergedSettings.elevenlabs_api_key,
      vultr_rag_collection_id: mergedSettings.vultr_rag_collection_id,
      updated_at: mergedSettings.updated_at
    };

    await dbService.saveUserSettings(finalSettings);

    return c.json({ success: true, message: 'Settings saved', settings: finalSettings });
  } catch (error) {
    console.error('Save settings error:', error);
    return c.json({
      error: 'Failed to save settings',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// === Config ===
app.get('/api/config', (c) => {
  return c.json({
    hasEnv: !!c.env,
    availableResources: {
      inputBucket: !!c.env.INPUT_BUCKET,
      outputBucket: !!c.env.OUTPUT_BUCKET,
      mem: !!c.env.mem,
      db: !!c.env.TRACKING_DB,
      ai: !!c.env.AI
    }
  });
});

export default class extends Service<Env> {
  async fetch(request: Request): Promise<Response> {
    return app.fetch(request, this.env);
  }
}
