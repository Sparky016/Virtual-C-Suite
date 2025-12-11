import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Env } from '../upload-api/raindrop.gen';
import { createHonoApp } from '../utils/create-app';
import { BrandService } from '../services/Brand/BrandService';
import { DatabaseService } from '../services/Database/DatabaseService';
import { StorageService } from '../services/StorageService';
import { LoggerService } from '../services/Logger/LoggerService';

const app = createHonoApp();
export { app };

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// POST /brand-document - Upload brand document
app.post('/brand-document', async (c) => {
  try {
    const formData = await c.req.formData();
    const file = formData.get('file') as File;
    const userId = formData.get('userId') as string;

    // Initialize services
    const logger = new LoggerService(c.env.POSTHOG_API_KEY, c.env.NODE_ENV);
    const brandService = new BrandService(logger);
    const databaseService = new DatabaseService(c.env.TRACKING_DB, logger);
    const storageService = new StorageService(c.env.INPUT_BUCKET);

    // Validate
    const validation = await brandService.validateBrandDocument(file, userId);
    if (!validation.success) {
      return c.json({ error: validation.error }, 400);
    }

    // Build storage key
    const documentKey = brandService.buildBrandDocumentKey(userId, file!.name);

    // Get old brand document and delete from storage (cleanup)
    const oldDoc = await databaseService.getActiveBrandDocument(userId);
    if (oldDoc) {
      try {
        await storageService.delete(oldDoc.documentKey);
        logger.info(`Deleted old brand document from storage: ${oldDoc.documentKey}`);
      } catch (error) {
        logger.warn(`Failed to delete old brand document from storage: ${oldDoc.documentKey}`, error);
        // Continue anyway - database deactivation is more important
      }
    }

    // Deactivate old brand documents
    await databaseService.deactivateAllBrandDocuments(userId);

    // Upload to storage
    const arrayBuffer = await file!.arrayBuffer();
    await storageService.put(documentKey, new Uint8Array(arrayBuffer), {
      httpMetadata: {
        contentType: file!.type || 'application/octet-stream',
      },
      customMetadata: {
        userId,
        originalName: file!.name,
        uploadedAt: new Date().toISOString(),
        type: 'brand-document'
      }
    });

    // Create new database record
    const brandDoc = brandService.prepareBrandDocument(userId, file!, documentKey);
    const documentId = await databaseService.createBrandDocument(brandDoc);

    // Track success
    brandService.trackBrandDocumentUploaded(userId, file!.name, documentKey);

    return c.json({
      success: true,
      documentId,
      documentKey,
      message: 'Brand document uploaded successfully'
    }, 201);

  } catch (error) {
    const logger = new LoggerService(c.env.POSTHOG_API_KEY, c.env.NODE_ENV);
    logger.error('Brand document upload error:', error);
    return c.json({
      error: 'Failed to upload brand document',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// GET /brand-document - Get active brand document info
app.get('/brand-document', async (c) => {
  try {
    const userId = c.req.query('userId');

    if (!userId) {
      return c.json({ error: 'userId query parameter required' }, 400);
    }

    const logger = new LoggerService(c.env.POSTHOG_API_KEY, c.env.NODE_ENV);
    const databaseService = new DatabaseService(c.env.TRACKING_DB, logger);

    const brandDoc = await databaseService.getActiveBrandDocument(userId);

    if (!brandDoc) {
      return c.json({
        document: null,
        message: 'No active brand document found'
      });
    }

    return c.json({
      document: {
        id: brandDoc.id,
        originalFilename: brandDoc.originalFilename,
        fileSize: brandDoc.fileSize,
        contentType: brandDoc.contentType,
        createdAt: new Date(brandDoc.createdAt).toISOString()
      }
    });

  } catch (error) {
    const logger = new LoggerService(c.env.POSTHOG_API_KEY, c.env.NODE_ENV);
    logger.error('Get brand document error:', error);
    return c.json({
      error: 'Failed to retrieve brand document',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// DELETE /brand-document/:documentId - Delete brand document
app.delete('/brand-document/:documentId', async (c) => {
  try {
    const documentId = parseInt(c.req.param('documentId'));
    const userId = c.req.query('userId');

    if (!userId) {
      return c.json({ error: 'userId query parameter required' }, 400);
    }

    if (isNaN(documentId)) {
      return c.json({ error: 'Invalid documentId' }, 400);
    }

    const logger = new LoggerService(c.env.POSTHOG_API_KEY, c.env.NODE_ENV);
    const databaseService = new DatabaseService(c.env.TRACKING_DB, logger);
    const storageService = new StorageService(c.env.INPUT_BUCKET);
    const brandService = new BrandService(logger);

    // Get document info
    const brandDoc = await databaseService.getActiveBrandDocument(userId);

    if (!brandDoc || brandDoc.id !== documentId) {
      return c.json({ error: 'Brand document not found' }, 404);
    }

    // Delete from storage
    try {
      await storageService.delete(brandDoc.documentKey);
      logger.info(`Deleted brand document from storage: ${brandDoc.documentKey}`);
    } catch (error) {
      logger.warn(`Failed to delete brand document from storage: ${brandDoc.documentKey}`, error);
      // Continue with database deletion even if storage deletion fails
    }

    // Delete from database
    await databaseService.deleteBrandDocument(userId, documentId);

    // Track deletion
    brandService.trackBrandDocumentDeleted(userId, documentId);

    return c.json({
      success: true,
      message: 'Brand document deleted successfully'
    });

  } catch (error) {
    const logger = new LoggerService(c.env.POSTHOG_API_KEY, c.env.NODE_ENV);
    logger.error('Delete brand document error:', error);
    return c.json({
      error: 'Failed to delete brand document',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

export default class extends Service<Env> {
  async fetch(request: Request): Promise<Response> {
    return app.fetch(request, this.env);
  }
}
