import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { BucketListOptions } from '@liquidmetal-ai/raindrop-framework';
import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Env } from './raindrop.gen';
import { StorageService } from '../services/StorageService';
import { CacheService } from '../services/CacheService';
import { MockD1Database, MockBucket, MockKV, MockAI, RaindropAI } from '../utils/local-mocks';
import { config } from 'dotenv';

// Load environment variables from .env file
config();

// Create Hono app with middleware
export const app = new Hono<{ Bindings: Env }>();

if (process.env.START_LOCAL_SERVER === 'true') {
  const port = parseInt(process.env.PORT || '3001');
  console.log(`Server is running on port ${port}`);

  const env = {
    ...process.env,
    TRACKING_DB: new MockD1Database(),
    INPUT_BUCKET: new MockBucket(),
    OUTPUT_BUCKET: new MockBucket(),
    mem: new MockKV(),
    AI: process.env.USE_REAL_AI === 'true' ? new RaindropAI() : new MockAI(),
  };

  serve({
    fetch: (request) => app.fetch(request, env),
    port
  });
}

// Add request logging middleware
app.use('*', logger());
app.use('*', cors());

// Health check endpoint
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// === Document Management Routes (SmartBucket) ===

// List documents in the input bucket
app.get('/api/documents', async (c) => {
  try {
    const url = new URL(c.req.url);
    const prefix = url.searchParams.get('prefix') || undefined;
    const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!) : undefined;

    const storage = new StorageService(c.env.INPUT_BUCKET);

    const listOptions: BucketListOptions = {
      prefix,
      limit
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
    const { query, page = 1, pageSize = 10 } = await c.req.json();

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
      const { requestId } = await c.req.json();
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
    const { objectId, query } = await c.req.json();

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

// === KV Cache Routes ===

// Store data in cache
app.post('/api/cache', async (c) => {
  try {
    const { key, value, ttl } = await c.req.json();

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
