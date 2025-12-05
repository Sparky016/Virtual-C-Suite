// File Validation Service - Extracted for testability
import { MAX_FILE_SIZE_MB, ALLOWED_FILE_TYPES, ALLOWED_EXTENSIONS } from '../shared/types';

export interface FileValidationResult {
  isValid: boolean;
  error?: string;
  details?: {
    reason: string;
    received?: string;
    limit?: number;
  };
}

export class FileValidationService {
  /**
   * Validate file size
   */
  validateFileSize(file: File): FileValidationResult {
    const fileSizeMB = file.size / (1024 * 1024);

    if (fileSizeMB > MAX_FILE_SIZE_MB) {
      return {
        isValid: false,
        error: `File size exceeds ${MAX_FILE_SIZE_MB}MB limit`,
        details: {
          reason: 'file_size_exceeded',
          received: fileSizeMB.toFixed(2),
          limit: MAX_FILE_SIZE_MB
        }
      };
    }

    return { isValid: true };
  }

  /**
   * Validate file type
   */
  validateFileType(filename: string, contentType: string): FileValidationResult {
    const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    const isValid = ALLOWED_EXTENSIONS.includes(ext) || ALLOWED_FILE_TYPES.includes(contentType);

    if (!isValid) {
      return {
        isValid: false,
        error: 'Invalid file type. Only CSV, PDF, and TXT files are supported.',
        details: {
          reason: 'invalid_file_type',
          received: contentType
        }
      };
    }

    return { isValid: true };
  }

  /**
   * Validate all file requirements
   */
  validateFile(file: File): FileValidationResult {
    // Check file size first
    const sizeResult = this.validateFileSize(file);
    if (!sizeResult.isValid) {
      return sizeResult;
    }

    // Then check file type
    const typeResult = this.validateFileType(file.name, file.type);
    if (!typeResult.isValid) {
      return typeResult;
    }

    return { isValid: true };
  }

  /**
   * Get file size in MB
   */
  getFileSizeMB(file: File): number {
    return file.size / (1024 * 1024);
  }
}
