// Upload Service - Business logic for file uploads
import { BucketPutOptions } from '@liquidmetal-ai/raindrop-framework';
import { FileValidationService } from './FileValidationService';
import { trackEvent, AnalyticsEvents } from '../shared/analytics';

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

  constructor() {
    this.validationService = new FileValidationService();
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
    posthogKey: string | undefined,
    userId: string,
    requestId: string,
    file: File,
    fileKey: string
  ): void {
    const fileSizeMB = this.validationService.getFileSizeMB(file);

    trackEvent(posthogKey, userId, AnalyticsEvents.FILE_UPLOADED, {
      request_id: requestId,
      file_name: file.name,
      file_type: file.type,
      file_size_mb: fileSizeMB.toFixed(2),
      file_key: fileKey
    });
  }

  /**
   * Track validation success
   */
  trackValidationSuccess(
    posthogKey: string | undefined,
    userId: string,
    file: File
  ): void {
    const fileSizeMB = this.validationService.getFileSizeMB(file);

    trackEvent(posthogKey, userId, AnalyticsEvents.FILE_VALIDATED, {
      file_name: file.name,
      file_type: file.type,
      file_size_mb: fileSizeMB.toFixed(2)
    });
  }

  /**
   * Track validation failure
   */
  trackValidationFailure(
    posthogKey: string | undefined,
    userId: string,
    file: File,
    reason: string,
    details: any
  ): void {
    trackEvent(posthogKey, userId, AnalyticsEvents.FILE_VALIDATION_FAILED, {
      reason,
      file_name: file.name,
      file_type: file.type,
      ...details
    });
  }
}
