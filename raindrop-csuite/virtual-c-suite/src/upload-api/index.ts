import { AppBindings } from '../config/env';
import { Env } from './raindrop.gen';
import { RateLimiter, getRateLimitHeaders } from '../shared/rate-limiter';
import { UploadService } from '../services/Upload/UploadService';
import { DatabaseService } from '../services/Database/DatabaseService';
import { StatusService } from '../services/StatusService';
import { ReportService } from '../services/ReportService';
import { LoggerService } from '../services/Logger/LoggerService';
import { StorageService } from '../services/StorageService';
import { Service } from '@liquidmetal-ai/raindrop-framework';
import { createHonoApp } from '../utils/create-app';

const app = createHonoApp();
export { app };

// Middleware is handled by createHonoApp

// Initialize rate limiter (10 requests per 15 minutes per user)
const rateLimiter = new RateLimiter();

// Health check endpoint (OpenAPI converted to standard)
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// POST /upload - Upload file for analysis
app.post('/upload', async (c) => {
  try {
    const formData = await c.req.formData();
    const file = formData.get('file') as File;
    const userId = formData.get('userId') as string;

    // Initialize services for this request
    const loggerService = new LoggerService(c.env.POSTHOG_API_KEY, c.env.NODE_ENV);
    const logger = new LoggerService(c.env.POSTHOG_API_KEY, c.env.NODE_ENV);
    const databaseService = new DatabaseService(c.env.TRACKING_DB, logger);
    const uploadService = new UploadService(loggerService);
    const storageService = new StorageService(c.env.INPUT_BUCKET);

    // Validate upload request using service (Logic reused)
    const validationResult = await uploadService.validateUploadRequest(file, userId);
    if (!validationResult.success) {
      if (file && userId && validationResult.validationDetails) {
        uploadService.trackValidationFailure(
          userId,
          file,
          validationResult.validationDetails.reason,
          validationResult.validationDetails
        );
      }
      return c.json({ error: validationResult.error }, 400);
    }

    // Check rate limit
    const maxRequests = c.env.RATE_LIMIT_PER_USER ? parseInt(c.env.RATE_LIMIT_PER_USER) : undefined;
    const rateLimitResult = await rateLimiter.checkLimit(c.env.TRACKING_DB, userId, maxRequests);
    const rateLimitHeaders = getRateLimitHeaders(rateLimitResult);

    // Track rate limit check
    loggerService.trackRateLimitCheck(userId, rateLimitResult.allowed, rateLimitResult.remaining);

    if (!rateLimitResult.allowed) {
      loggerService.warn(`Rate limit exceeded for user: ${userId}`);
      loggerService.trackRateLimitExceeded(
        userId,
        rateLimitResult.message!,
        rateLimitResult.remaining,
        new Date(rateLimitResult.resetAt).toISOString()
      );
      return c.json({
        error: 'Rate limit exceeded',
        message: rateLimitResult.message,
        remaining: rateLimitResult.remaining,
        resetAt: new Date(rateLimitResult.resetAt).toISOString()
      }, 429, rateLimitHeaders);
    }

    // Track successful validation
    uploadService.trackValidationSuccess(userId, file!);

    // Generate request ID and keys
    const requestId = uploadService.generateRequestId();
    const fileKey = uploadService.buildFileKey(userId, requestId, file!.name);

    // Prepare metadata
    const putOptions = uploadService.prepareFileMetadata(
      { file: file!, userId, requestId },
      file!
    );

    // Upload to input bucket
    const arrayBuffer = await file!.arrayBuffer();
    await storageService.put(fileKey, new Uint8Array(arrayBuffer), putOptions);

    // Store request in DB
    await databaseService.createAnalysisRequest(requestId, userId, fileKey, 'processing');

    // Track success
    uploadService.trackUploadSuccess(userId, requestId, file!, fileKey);

    // Return success
    return c.json({
      requestId,
      status: 'processing',
      message: 'File uploaded successfully. Analysis in progress.',
      rateLimit: {
        remaining: rateLimitResult.remaining - 1,
        resetAt: new Date(rateLimitResult.resetAt).toISOString()
      }
    }, 201, rateLimitHeaders);

  } catch (error) {
    const loggerService = new LoggerService(c.env.POSTHOG_API_KEY, c.env.NODE_ENV);
    loggerService.error('Upload error:', error);
    try {
      const formData = await c.req.formData();
      const userIdFromForm = formData.get('userId') as string;
      if (userIdFromForm) {
        loggerService.trackFileUploadFailed(
          userIdFromForm,
          error instanceof Error ? error.message : 'Unknown error'
        );
      }
    } catch { }

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

    // Initialize services
    const loggerService = new LoggerService(c.env.POSTHOG_API_KEY, c.env.NODE_ENV);
    const logger = new LoggerService(c.env.POSTHOG_API_KEY, c.env.NODE_ENV);
    const databaseService = new DatabaseService(c.env.TRACKING_DB, logger);
    const statusService = new StatusService(databaseService, loggerService);

    // Check status using service
    const statusResult = await statusService.checkStatus(requestId);

    if (!statusResult) {
      return c.json({
        error: 'Request not found',
        requestId
      }, 404);
    }

    // Handle timeout case
    if (statusResult.timedOut) {
      return c.json({
        requestId: statusResult.requestId,
        status: statusResult.status,
        error: statusResult.error,
        message: statusResult.message,
        createdAt: statusResult.createdAt,
        completedAt: statusResult.completedAt
      });
    }

    // Return normal status
    return c.json({
      requestId: statusResult.requestId,
      status: statusResult.status,
      progress: statusResult.progress,
      createdAt: statusResult.createdAt,
      completedAt: statusResult.completedAt,
      error: statusResult.error
    });

  } catch (error) {
    const loggerService = new LoggerService(c.env.POSTHOG_API_KEY, c.env.NODE_ENV);
    loggerService.error('Status check error:', error);
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

    // Initialize services
    const loggerService = new LoggerService(c.env.POSTHOG_API_KEY, c.env.NODE_ENV);
    const logger = new LoggerService(c.env.POSTHOG_API_KEY, c.env.NODE_ENV);
    const databaseService = new DatabaseService(c.env.TRACKING_DB, logger);
    const reportService = new ReportService(databaseService, loggerService);

    // Get report using service
    const reportResult = await reportService.getReport(requestId);

    // Handle not found
    if (reportResult.status === 'not_found') {
      return c.json({
        error: reportResult.error,
        requestId: reportResult.requestId
      }, 404);
    }

    // Handle in progress
    if (reportResult.status === 'processing' || reportResult.status === 'pending') {
      return c.json({
        requestId: reportResult.requestId,
        status: reportResult.status,
        message: reportResult.message
      });
    }

    // Handle failed
    if (reportResult.status === 'failed') {
      return c.json({
        requestId: reportResult.requestId,
        status: 'failed',
        error: reportResult.error
      });
    }

    // Return completed report
    return c.json({
      requestId: reportResult.requestId,
      status: reportResult.status,
      report: reportResult.report,
      completedAt: reportResult.completedAt
    });

  } catch (error) {
    const loggerService = new LoggerService(c.env.POSTHOG_API_KEY, c.env.NODE_ENV);
    loggerService.error('Report retrieval error:', error);
    return c.json({
      error: 'Failed to retrieve report',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// === User Settings Routes ===

app.get('/api/settings', async (c) => {
  try {
    const userId = c.req.query('userId') || 'anonymous';
    const logger = new LoggerService(c.env.POSTHOG_API_KEY, c.env.NODE_ENV);
    const dbService = new DatabaseService(c.env.TRACKING_DB, logger);
    const settings = await dbService.getUserSettings(userId);
    return c.json({ success: true, settings });
  } catch (error) {
    const loggerService = new LoggerService(c.env.POSTHOG_API_KEY, c.env.NODE_ENV);
    loggerService.error('Get settings error:', error);
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

    const logger = new LoggerService(c.env.POSTHOG_API_KEY, c.env.NODE_ENV);
    const dbService = new DatabaseService(c.env.TRACKING_DB, logger);

    // 1. Fetch existing settings to allow partial updates
    const existingSettings = await dbService.getUserSettings(incomingSettings.user_id);

    // 2. Handle typo correction (samba_nova_api_key -> sambanova_api_key)
    if (incomingSettings.samba_nova_api_key && !incomingSettings.sambanova_api_key) {
      incomingSettings.sambanova_api_key = incomingSettings.samba_nova_api_key;
    }

    // 3. Merge settings: Default < Existing < Incoming
    const mergedSettings: any = {
      inference_provider: 'vultr', // Default provider
      ...existingSettings,
      ...incomingSettings,
      updated_at: Date.now()
    };

    // 4. Smart provider inference: If user provides a key but no explicit provider, infer the provider
    // Priority: Vultr (primary) -> SambaNova (fallback) -> Cloudflare (default)
    if (!incomingSettings.inference_provider) {
      // User didn't explicitly set provider, infer from keys provided
      if (incomingSettings.vultr_api_key) {
        mergedSettings.inference_provider = 'vultr';
      } else if (incomingSettings.sambanova_api_key || incomingSettings.samba_nova_api_key) {
        mergedSettings.inference_provider = 'sambanova';
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
    const loggerService = new LoggerService(c.env.POSTHOG_API_KEY, c.env.NODE_ENV);
    loggerService.error('Save settings error:', error);
    return c.json({
      error: 'Failed to save settings',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

export default class extends Service<Env> {
  async fetch(request: Request): Promise<Response> {
    return app.fetch(request, this.env);
  }
}
