import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { BucketPutOptions } from '@liquidmetal-ai/raindrop-framework';
import { Env } from './raindrop.gen';
import { MAX_FILE_SIZE_MB, ALLOWED_FILE_TYPES, ALLOWED_EXTENSIONS } from '../shared/types';

// Create Hono app with middleware
const app = new Hono<{ Bindings: Env }>();

// Add request logging middleware
app.use('*', logger());

// Health check endpoint
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Generate ULID-like request ID
function generateRequestId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 15);
  return `${timestamp}${random}`.toUpperCase();
}

// Validate file type
function validateFileType(filename: string, contentType: string): boolean {
  const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
  return ALLOWED_EXTENSIONS.includes(ext) || ALLOWED_FILE_TYPES.includes(contentType);
}

// POST /upload - Upload file for analysis
app.post('/upload', async (c) => {
  try {
    const formData = await c.req.formData();
    const file = formData.get('file') as File;
    const userId = formData.get('userId') as string;

    // Validate inputs
    if (!file) {
      return c.json({ error: 'No file provided' }, 400);
    }

    if (!userId) {
      return c.json({ error: 'userId is required' }, 400);
    }

    // Validate file size
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > MAX_FILE_SIZE_MB) {
      return c.json({
        error: `File size exceeds ${MAX_FILE_SIZE_MB}MB limit`,
        size: `${fileSizeMB.toFixed(2)}MB`
      }, 400);
    }

    // Validate file type
    if (!validateFileType(file.name, file.type)) {
      return c.json({
        error: 'Invalid file type. Only CSV, PDF, and TXT files are supported.',
        received: file.type
      }, 400);
    }

    // Generate request ID
    const requestId = generateRequestId();
    const fileKey = `${userId}/${requestId}/${file.name}`;

    // Upload to input bucket
    const arrayBuffer = await file.arrayBuffer();
    const putOptions: BucketPutOptions = {
      httpMetadata: {
        contentType: file.type || 'application/octet-stream',
      },
      customMetadata: {
        requestId,
        userId,
        originalName: file.name,
        uploadedAt: new Date().toISOString()
      }
    };

    await c.env.INPUT_BUCKET.put(fileKey, new Uint8Array(arrayBuffer), putOptions);

    // Store request in database
    const createdAt = Date.now();
    await c.env.TRACKING_DB.prepare(
      `INSERT INTO analysis_requests (request_id, user_id, file_key, status, created_at)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(requestId, userId, fileKey, 'processing', createdAt).run();

    return c.json({
      requestId,
      status: 'processing',
      message: 'File uploaded successfully. Analysis in progress.'
    }, 201);

  } catch (error) {
    console.error('Upload error:', error);
    return c.json({
      error: 'Failed to upload file',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// GET /status/:requestId - Get analysis status
app.get('/status/:requestId', async (c) => {
  try {
    const requestId = c.req.param('requestId');

    // Query database for request
    const result = await c.env.TRACKING_DB.prepare(
      `SELECT status, created_at, completed_at, error_message
       FROM analysis_requests
       WHERE request_id = ?`
    ).bind(requestId).first();

    if (!result) {
      return c.json({
        error: 'Request not found',
        requestId
      }, 404);
    }

    // Check for timeout on processing requests
    const TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
    const now = Date.now();
    const elapsed = now - (result.created_at as number);

    if (result.status === 'processing' && elapsed > TIMEOUT_MS) {
      console.warn(`Request ${requestId} timed out after ${elapsed}ms`);

      // Mark as failed due to timeout
      await c.env.TRACKING_DB.prepare(
        `UPDATE analysis_requests
         SET status = ?, error_message = ?, completed_at = ?
         WHERE request_id = ?`
      ).bind('failed', 'Processing timeout exceeded (5 minutes)', now, requestId).run();

      return c.json({
        requestId,
        status: 'failed',
        error: 'Processing timeout exceeded',
        message: 'Analysis took longer than expected. Please try again.',
        createdAt: new Date(result.created_at as number).toISOString(),
        completedAt: new Date(now).toISOString()
      });
    }

    // Get progress from executive analyses
    const analyses = await c.env.TRACKING_DB.prepare(
      `SELECT executive_role, analysis_text
       FROM executive_analyses
       WHERE request_id = ?`
    ).bind(requestId).all();

    const progress = {
      cfo: analyses.results.some((a: any) => a.executive_role === 'CFO') ? 'completed' : 'pending',
      cmo: analyses.results.some((a: any) => a.executive_role === 'CMO') ? 'completed' : 'pending',
      coo: analyses.results.some((a: any) => a.executive_role === 'COO') ? 'completed' : 'pending',
      synthesis: result.status === 'completed' ? 'completed' : 'pending'
    };

    return c.json({
      requestId,
      status: result.status,
      progress,
      createdAt: new Date(result.created_at as number).toISOString(),
      completedAt: result.completed_at ? new Date(result.completed_at as number).toISOString() : undefined
    });

  } catch (error) {
    console.error('Status check error:', error);
    return c.json({
      error: 'Failed to check status',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// GET /reports/:requestId - Get completed report
app.get('/reports/:requestId', async (c) => {
  try {
    const requestId = c.req.param('requestId');

    // Query database for request
    const request = await c.env.TRACKING_DB.prepare(
      `SELECT status, completed_at, error_message
       FROM analysis_requests
       WHERE request_id = ?`
    ).bind(requestId).first();

    if (!request) {
      return c.json({
        error: 'Request not found',
        requestId
      }, 404);
    }

    // Check status
    if (request.status === 'processing' || request.status === 'pending') {
      return c.json({
        requestId,
        status: request.status,
        message: 'Analysis in progress'
      });
    }

    if (request.status === 'failed') {
      return c.json({
        requestId,
        status: 'failed',
        error: request.error_message || 'Analysis failed'
      });
    }

    // Get final report
    const report = await c.env.TRACKING_DB.prepare(
      `SELECT report_content, report_key, created_at
       FROM final_reports
       WHERE request_id = ?`
    ).bind(requestId).first();

    if (!report) {
      return c.json({
        error: 'Report not found',
        requestId
      }, 404);
    }

    return c.json({
      requestId,
      status: 'completed',
      report: report.report_content,
      completedAt: new Date(report.created_at as number).toISOString()
    });

  } catch (error) {
    console.error('Report retrieval error:', error);
    return c.json({
      error: 'Failed to retrieve report',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

export default class extends Service<Env> {
  async fetch(request: Request): Promise<Response> {
    return app.fetch(request, this.env);
  }
}
