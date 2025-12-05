// Upload Service - Business logic for file uploads
import { BucketPutOptions } from '@liquidmetal-ai/raindrop-framework';
import { FileValidationService } from './FileValidationService';
import { LoggerService } from './LoggerService';

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
  generateRequestId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 15);
    return `${timestamp}${random}`.toUpperCase();
  }

  /**
   * Validate upload request
   */
  async validateUploadRequest(file: File | null, userId: string | null): Promise<UploadResult> {
    // Check required fields
    if (!file) {
      return {
        success: false,
        error: 'No file provided'
      };
    }

    if (!userId) {
      return {
        success: false,
        error: 'userId is required'
      };
    }

    // Validate file
    const validationResult = this.validationService.validateFile(file);
    if (!validationResult.isValid) {
      return {
        success: false,
        error: validationResult.error,
        validationDetails: validationResult.details
      };
    }

    return { success: true };
  }

  /**
   * Prepare file metadata for bucket storage
   */
  prepareFileMetadata(request: UploadRequest, file: File): BucketPutOptions {
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
    return `${userId}/${requestId}/${filename}`;
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
    this.logger.trackFileValidationFailed(userId, reason, {
      file_name: file.name,
      file_type: file.type,
      ...details
    });
  }
}
