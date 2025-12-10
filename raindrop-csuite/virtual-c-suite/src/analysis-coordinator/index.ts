import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { BucketListOptions } from '@liquidmetal-ai/raindrop-framework';
import { Env } from './raindrop.gen';
import { StorageService } from '../services/StorageService';
import { CacheService } from '../services/Cache/CacheService';
import { AIOrchestrationService } from '../services/AIOrchestrationService';

// Create Hono app with middleware
export const app = new Hono<{ Bindings: Env }>();

// Add request logging middleware
app.use('*', logger());
app.use('*', cors());

// Health check endpoint
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// === Document Management Routes (SmartBucket) ===

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

// CEO Chat (Conversation with Memory)
app.post('/api/ceo-chat', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const { messages, requestId = 'chat-' + Date.now(), userId = 'anonymous' } = body;

    if (!messages || !Array.isArray(messages)) {
      return c.json({ error: 'messages array is required' }, 400);
    }

    const aiService = new AIOrchestrationService(c.env.AI, (c.env as any).POSTHOG_API_KEY);
    const response = await aiService.executeCEOChat(messages, requestId, userId);

    return c.json({
      success: response.success,
      reply: response.data?.choices?.[0]?.message?.content || 'No response',
      data: response.data,
      metrics: {
        duration: response.totalDuration,
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
