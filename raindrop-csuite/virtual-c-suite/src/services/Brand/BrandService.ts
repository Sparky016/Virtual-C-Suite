// Brand Service - Business logic for brand document management
import { FileValidationService } from '../FileValidationService';
import { LoggerService } from '../Logger/LoggerService';
import { BrandDocument } from '../../shared/types';

export interface BrandValidationResult {
  success: boolean;
  error?: string;
}

export class BrandService {
  private validationService: FileValidationService;
  private logger: LoggerService;

  constructor(logger: LoggerService) {
    this.validationService = new FileValidationService();
    this.logger = logger;
  }

  /**
   * Build brand document storage key
   * Pattern: brand-documents/{userId}/active-brand-document.{ext}
   */
  buildBrandDocumentKey(userId: string, filename: string): string {
    const ext = filename.substring(filename.lastIndexOf('.'));
    const key = `brand-documents/${userId}/active-brand-document${ext}`;
    this.logger.info(`Built brand document key: ${key}`);
    return key;
  }

  /**
   * Validate brand document upload
   */
  async validateBrandDocument(file: File | null, userId: string | null): Promise<BrandValidationResult> {
    this.logger.info('Validating brand document', { userId, fileName: file?.name });

    if (!file) {
      this.logger.warn('Validation failed: No file provided');
      return { success: false, error: 'No file provided' };
    }

    if (!userId) {
      this.logger.warn('Validation failed: userId is required');
      return { success: false, error: 'userId is required' };
    }

    // Use existing file validation
    const validationResult = this.validationService.validateFile(file);
    if (!validationResult.isValid) {
      this.logger.warn('Validation failed', { error: validationResult.error });
      return { success: false, error: validationResult.error };
    }

    this.logger.info('Brand document validated successfully');
    return { success: true };
  }

  /**
   * Prepare brand document metadata
   */
  prepareBrandDocument(userId: string, file: File, documentKey: string): BrandDocument {
    const now = Date.now();
    this.logger.info(`Preparing brand document for user: ${userId}`);

    return {
      userId,
      documentKey,
      originalFilename: file.name,
      fileSize: file.size,
      contentType: file.type || 'application/octet-stream',
      status: 'active',
      createdAt: now,
      updatedAt: now
    };
  }

  /**
   * Track brand document upload
   */
  trackBrandDocumentUploaded(userId: string, filename: string, documentKey: string): void {
    this.logger.info('Brand document uploaded', {
      userId,
      filename,
      documentKey
    });
    // Can add PostHog event tracking similar to trackFileUploaded if needed
  }

  /**
   * Track brand document deletion
   */
  trackBrandDocumentDeleted(userId: string, documentId: number): void {
    this.logger.info('Brand document deleted', {
      userId,
      documentId
    });
  }
}
