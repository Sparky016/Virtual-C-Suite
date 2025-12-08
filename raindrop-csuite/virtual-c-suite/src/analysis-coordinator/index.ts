import { Service } from '@liquidmetal-ai/raindrop-framework';
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { apiReference } from '@scalar/hono-api-reference';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { BucketListOptions } from '@liquidmetal-ai/raindrop-framework';
import { Env } from './raindrop.gen';
import { StorageService } from '../services/StorageService';
import { CacheService } from '../services/CacheService';

// Create Hono app with middleware
export const app = new OpenAPIHono<{ Bindings: Env }>();

// Add request logging middleware
app.use('*', logger());
app.use('*', cors());

// Health check endpoint
app.openapi(
  createRoute({
    method: 'get',
    path: '/health',
    description: 'Health check endpoint',
    responses: {
      200: {
        description: 'Service is healthy',
        content: {
          'application/json': {
            schema: z.object({
              status: z.string().openapi({ example: 'ok' }),
              timestamp: z.string().openapi({ example: '2023-10-27T10:00:00Z' }),
            }),
          },
        },
      },
    },
  }),
  (c) => {
    return c.json({ status: 'ok', timestamp: new Date().toISOString() });
  }
);

// OpenAPI Documentation
app.doc('/doc', {
  openapi: '3.0.0',
  info: {
    version: '1.0.0',
    title: 'Analysis Coordinator API',
    description: 'API for document management, search, and caching.',
  },
});

// Swagger UI / API Reference
app.get(
  '/reference',
  apiReference({
    spec: {
      url: '/doc',
    },
  } as any)
);

// === Document Management Routes (SmartBucket) ===

// List documents in the input bucket
app.openapi(
  createRoute({
    method: 'get',
    path: '/api/documents',
    description: 'List documents in the input bucket',
    request: {
      query: z.object({
        prefix: z.string().optional().openapi({ description: 'Filter by object prefix' }),
        limit: z.string().optional().openapi({ description: 'Max number of objects to return' }),
      }),
    },
    responses: {
      200: {
        description: 'List of documents',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              objects: z.array(
                z.object({
                  key: z.string(),
                  size: z.number(),
                  uploaded: z.string(), // Date object becomes string in JSON
                  etag: z.string(),
                })
              ),
              truncated: z.boolean(),
              cursor: z.string().optional(),
            }),
          },
        },
      },
      500: { description: 'Server error' },
    },
  }),
  async (c) => {
    try {
      const { prefix, limit } = c.req.valid('query');
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
  }
);

// Download/Get a specific document
app.openapi(
  createRoute({
    method: 'get',
    path: '/api/documents/{key}',
    description: 'Download a specific document',
    request: {
      params: z.object({
        key: z.string().openapi({ param: { name: 'key', in: 'path' }, example: 'file.txt' }),
      }),
    },
    responses: {
      200: {
        description: 'File content',
        content: {
          'application/octet-stream': { schema: z.string().openapi({ format: 'binary' }) },
          'application/json': { schema: z.any() }, // In case of JSON files?
        },
      },
      404: { description: 'File not found' },
      500: { description: 'Server error' },
    },
  }),
  async (c) => {
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
  }
);

// Search documents (SmartBucket Feature)
app.openapi(
  createRoute({
    method: 'post',
    path: '/api/documents/search',
    description: 'Search documents content',
    request: {
      body: {
        content: {
          'application/json': {
            schema: z.object({
              query: z.string().openapi({ example: 'revenue 2023' }),
              page: z.number().optional().default(1),
              pageSize: z.number().optional().default(10),
              requestId: z.string().optional().openapi({ description: 'Required for pagination (page > 1)' }),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Search results',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean(),
              message: z.string(),
              query: z.string(),
              results: z.array(z.any()), // Keeping generic for now as result structure depends on search engine
              pagination: z.any().optional(),
            }),
          },
        },
      },
      400: { description: 'Invalid request' },
      500: { description: 'Server error' },
    },
  }),
  async (c) => {
    try {
      const { query, page, pageSize, requestId } = c.req.valid('json');

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
  }
);

// Document Chat (RAG) (SmartBucket Feature)
app.openapi(
  createRoute({
    method: 'post',
    path: '/api/documents/chat',
    description: 'Chat with a document',
    request: {
      body: {
        content: {
          'application/json': {
            schema: z.object({
              objectId: z.string().openapi({ description: 'Key of the file to chat with' }),
              query: z.string().openapi({ example: 'Summarize the risks' }),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Chat response',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean(),
              message: z.string(),
              objectId: z.string(),
              query: z.string(),
              answer: z.string(),
            }),
          },
        },
      },
      400: { description: 'Invalid request' },
      500: { description: 'Server error' },
    },
  }),
  async (c) => {
    try {
      const { objectId, query } = c.req.valid('json');

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
  }
);

// === KV Cache Routes ===

// Store data in cache
app.openapi(
  createRoute({
    method: 'post',
    path: '/api/cache',
    description: 'Store value in cache',
    request: {
      body: {
        content: {
          'application/json': {
            schema: z.object({
              key: z.string(),
              value: z.any(),
              ttl: z.number().optional().openapi({ description: 'Time to live in seconds' }),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Cache set successful',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean(),
              message: z.string(),
              key: z.string(),
            }),
          },
        },
      },
      400: { description: 'Invalid request' },
      500: { description: 'Server error' },
    },
  }),
  async (c) => {
    try {
      const { key, value, ttl } = c.req.valid('json');

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
  }
);

// Get data from cache
app.openapi(
  createRoute({
    method: 'get',
    path: '/api/cache/{key}',
    description: 'Retrieve value from cache',
    request: {
      params: z.object({
        key: z.string().openapi({ param: { name: 'key', in: 'path' } }),
      }),
    },
    responses: {
      200: {
        description: 'Cache hit',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean(),
              key: z.string(),
              value: z.any(),
            }),
          },
        },
      },
      404: { description: 'Cache miss' },
      500: { description: 'Server error' },
    },
  }),
  async (c) => {
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
  }
);

// === Config ===
app.openapi(
  createRoute({
    method: 'get',
    path: '/api/config',
    description: 'Get service configuration status',
    responses: {
      200: {
        description: 'Configuration status',
        content: {
          'application/json': {
            schema: z.object({
              hasEnv: z.boolean(),
              availableResources: z.object({
                inputBucket: z.boolean(),
                outputBucket: z.boolean(),
                mem: z.boolean(),
                db: z.boolean(),
                ai: z.boolean(),
              }),
            }),
          },
        },
      },
    },
  }),
  (c) => {
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
  }
);

export default class extends Service<Env> {
  async fetch(request: Request): Promise<Response> {
    return app.fetch(request, this.env);
  }
}
