// Upload Service - Business logic for file uploads
import { BucketPutOptions } from '@liquidmetal-ai/raindrop-framework';
import { FileValidationService } from '../FileValidationService';
import { LoggerService } from '../Logger/LoggerService';

export interface UploadRequest {
  file: File;
  userId: string;
  requestId: string;
}

export interface UploadResult {
  success: boolean;
  requestId?: string;
  fileKey?: string;
  error?: string;
  validationDetails?: any;
}

export class UploadService {
  private validationService: FileValidationService;
  private logger: LoggerService;

  constructor(logger: LoggerService) {
    this.validationService = new FileValidationService();
    this.logger = logger;
  }

  /**
   * Generate a unique request ID (ULID-like)
   */
  /**
   * Generate a unique request ID (ULID-like)
   */
  generateRequestId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 15);
    const id = `${timestamp}${random}`.toUpperCase();
    this.logger.info(`Generated request ID: ${id}`);
    return id;
  }

  /**
   * Validate upload request
   */
  async validateUploadRequest(file: File | null, userId: string | null): Promise<UploadResult> {
    this.logger.info('Validating upload request', { userId, fileName: file?.name, fileType: file?.type });

    // Check required fields
    if (!file) {
      this.logger.warn('Validation failed: No file provided');
      return {
        success: false,
        error: 'No file provided'
      };
    }

    if (!userId) {
      this.logger.warn('Validation failed: userId is required');
      return {
        success: false,
        error: 'userId is required'
      };
    }

    // Validate file
    const validationResult = this.validationService.validateFile(file);
    if (!validationResult.isValid) {
      this.logger.warn('Validation failed', { error: validationResult.error, details: validationResult.details });
      return {
        success: false,
        error: validationResult.error,
        validationDetails: validationResult.details
      };
    }

    this.logger.info('Upload request validated successfully');
    return { success: true };
  }

  /**
   * Prepare file metadata for bucket storage
   */
  prepareFileMetadata(request: UploadRequest, file: File): BucketPutOptions {
    this.logger.info(`Preparing file metadata for request: ${request.requestId}`);
    return {
      httpMetadata: {
        contentType: file.type || 'application/octet-stream',
      },
      customMetadata: {
        requestId: request.requestId,
        userId: request.userId,
        originalName: file.name,
        uploadedAt: new Date().toISOString()
      }
    };
  }

  /**
   * Build file storage key
   */
  buildFileKey(userId: string, requestId: string, filename: string): string {
    const key = `${userId}/${requestId}/${filename}`;
    this.logger.info(`Built file key: ${key}`);
    return key;
  }

  /**
   * Track successful upload
   */
  trackUploadSuccess(
    userId: string,
    requestId: string,
    file: File,
    fileKey: string
  ): void {
    this.logger.info(`Tracking upload success for request: ${requestId}`);
    const fileSizeMB = this.validationService.getFileSizeMB(file);

    this.logger.trackFileUploaded(
      userId,
      requestId,
      file.name,
      file.type,
      fileSizeMB.toFixed(2),
      fileKey
    );
  }

  /**
   * Track validation success
   */
  trackValidationSuccess(userId: string, file: File): void {
    this.logger.info(`Tracking validation success for file: ${file.name}`);
    const fileSizeMB = this.validationService.getFileSizeMB(file);

    this.logger.trackFileValidated(
      userId,
      file.name,
      file.type,
      fileSizeMB.toFixed(2)
    );
  }

  /**
   * Track validation failure
   */
  trackValidationFailure(
    userId: string,
    file: File,
    reason: string,
    details: any
  ): void {
    this.logger.info(`Tracking validation failure for file: ${file.name}`, { reason });
    this.logger.trackFileValidationFailed(userId, reason, {
      file_name: file.name,
      file_type: file.type,
      ...details
    });
  }
}
