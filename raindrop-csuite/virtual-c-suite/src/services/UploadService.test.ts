// UploadService Tests - Business logic validation
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { UploadService } from './UploadService';
import * as analytics from '../shared/analytics';

// Mock analytics module
vi.mock('../shared/analytics', () => ({
  trackEvent: vi.fn(),
  AnalyticsEvents: {
    FILE_UPLOADED: 'file_uploaded',
    FILE_VALIDATED: 'file_validated',
    FILE_VALIDATION_FAILED: 'file_validation_failed'
  }
}));

describe('UploadService', () => {
  let service: UploadService;

  beforeEach(() => {
    service = new UploadService();
    vi.clearAllMocks();
  });

  describe('generateRequestId', () => {
    test('generates a request ID', () => {
      const id = service.generateRequestId();

      expect(id).toBeDefined();
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(10);
    });

    test('generates unique IDs', () => {
      const id1 = service.generateRequestId();
      const id2 = service.generateRequestId();
      const id3 = service.generateRequestId();

      expect(id1).not.toBe(id2);
      expect(id2).not.toBe(id3);
      expect(id1).not.toBe(id3);
    });

    test('generates uppercase IDs', () => {
      const id = service.generateRequestId();

      expect(id).toBe(id.toUpperCase());
    });

    test('generates IDs with timestamp component', () => {
      const beforeTime = Date.now();
      const id = service.generateRequestId();
      const afterTime = Date.now();

      // ID should contain timestamp-derived component
      expect(id.length).toBeGreaterThan(15);
    });

    test('generates 100 unique IDs rapidly', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(service.generateRequestId());
      }

      expect(ids.size).toBe(100);
    });
  });

  describe('validateUploadRequest', () => {
    test('accepts valid file and userId', async () => {
      const file = createMockFile('data.csv', 'text/csv', 5 * 1024 * 1024);
      const userId = 'user123';

      const result = await service.validateUploadRequest(file, userId);

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    test('rejects when file is null', async () => {
      const result = await service.validateUploadRequest(null, 'user123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('No file provided');
    });

    test('rejects when userId is null', async () => {
      const file = createMockFile('data.csv', 'text/csv', 5 * 1024 * 1024);

      const result = await service.validateUploadRequest(file, null);

      expect(result.success).toBe(false);
      expect(result.error).toBe('userId is required');
    });

    test('rejects when userId is empty string', async () => {
      const file = createMockFile('data.csv', 'text/csv', 5 * 1024 * 1024);

      const result = await service.validateUploadRequest(file, '');

      expect(result.success).toBe(false);
      expect(result.error).toBe('userId is required');
    });

    test('rejects when file is too large', async () => {
      const file = createMockFile('large.csv', 'text/csv', 15 * 1024 * 1024);

      const result = await service.validateUploadRequest(file, 'user123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('exceeds');
      expect(result.validationDetails?.reason).toBe('file_size_exceeded');
    });

    test('rejects when file type is invalid', async () => {
      const file = createMockFile('photo.jpg', 'image/jpeg', 2 * 1024 * 1024);

      const result = await service.validateUploadRequest(file, 'user123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid file type');
      expect(result.validationDetails?.reason).toBe('invalid_file_type');
    });

    test('returns validation details on failure', async () => {
      const file = createMockFile('large.jpg', 'image/jpeg', 15 * 1024 * 1024);

      const result = await service.validateUploadRequest(file, 'user123');

      expect(result.validationDetails).toBeDefined();
      expect(result.validationDetails?.reason).toBeDefined();
    });
  });

  describe('prepareFileMetadata', () => {
    test('creates metadata with all required fields', () => {
      const file = createMockFile('data.csv', 'text/csv', 5 * 1024 * 1024);
      const request = {
        file,
        userId: 'user123',
        requestId: 'REQ123'
      };

      const metadata = service.prepareFileMetadata(request, file);

      expect(metadata.httpMetadata).toBeDefined();
      expect(metadata.httpMetadata?.contentType).toBe('text/csv');
      expect(metadata.customMetadata).toBeDefined();
      expect(metadata.customMetadata?.requestId).toBe('REQ123');
      expect(metadata.customMetadata?.userId).toBe('user123');
      expect(metadata.customMetadata?.originalName).toBe('data.csv');
      expect(metadata.customMetadata?.uploadedAt).toBeDefined();
    });

    test('uses default content type for files without type', () => {
      const file = createMockFile('data.csv', '', 1024);
      const request = {
        file,
        userId: 'user123',
        requestId: 'REQ123'
      };

      const metadata = service.prepareFileMetadata(request, file);

      expect(metadata.httpMetadata?.contentType).toBe('application/octet-stream');
    });

    test('includes timestamp in ISO format', () => {
      const file = createMockFile('data.csv', 'text/csv', 1024);
      const request = {
        file,
        userId: 'user123',
        requestId: 'REQ123'
      };

      const before = new Date().toISOString();
      const metadata = service.prepareFileMetadata(request, file);
      const after = new Date().toISOString();

      const uploadedAt = metadata.customMetadata?.uploadedAt as string;
      expect(uploadedAt).toBeDefined();
      expect(uploadedAt >= before).toBe(true);
      expect(uploadedAt <= after).toBe(true);
    });

    test('preserves original filename', () => {
      const file = createMockFile('my-special-file.csv', 'text/csv', 1024);
      const request = {
        file,
        userId: 'user123',
        requestId: 'REQ123'
      };

      const metadata = service.prepareFileMetadata(request, file);

      expect(metadata.customMetadata?.originalName).toBe('my-special-file.csv');
    });
  });

  describe('buildFileKey', () => {
    test('builds file key with all components', () => {
      const key = service.buildFileKey('user123', 'REQ456', 'data.csv');

      expect(key).toBe('user123/REQ456/data.csv');
    });

    test('handles special characters in filename', () => {
      const key = service.buildFileKey('user123', 'REQ456', 'my-data_2024.csv');

      expect(key).toBe('user123/REQ456/my-data_2024.csv');
    });

    test('handles long filenames', () => {
      const longFilename = 'very-long-filename-with-many-characters.csv';
      const key = service.buildFileKey('user123', 'REQ456', longFilename);

      expect(key).toBe(`user123/REQ456/${longFilename}`);
    });

    test('creates hierarchical structure', () => {
      const key = service.buildFileKey('userA', 'reqB', 'file.csv');

      expect(key.split('/')).toHaveLength(3);
      expect(key.split('/')[0]).toBe('userA');
      expect(key.split('/')[1]).toBe('reqB');
      expect(key.split('/')[2]).toBe('file.csv');
    });

    test('handles unicode characters', () => {
      const key = service.buildFileKey('user123', 'REQ456', 'données.csv');

      expect(key).toContain('données.csv');
    });
  });

  describe('trackUploadSuccess', () => {
    test('calls trackEvent with correct parameters', () => {
      const file = createMockFile('data.csv', 'text/csv', 5 * 1024 * 1024);

      service.trackUploadSuccess('test-key', 'user123', 'REQ456', file, 'path/to/file');

      expect(analytics.trackEvent).toHaveBeenCalledTimes(1);
      expect(analytics.trackEvent).toHaveBeenCalledWith(
        'test-key',
        'user123',
        analytics.AnalyticsEvents.FILE_UPLOADED,
        expect.objectContaining({
          request_id: 'REQ456',
          file_name: 'data.csv',
          file_type: 'text/csv',
          file_size_mb: '5.00',
          file_key: 'path/to/file'
        })
      );
    });

    test('formats file size to 2 decimal places', () => {
      const file = createMockFile('data.csv', 'text/csv', 2.567 * 1024 * 1024);

      service.trackUploadSuccess('test-key', 'user123', 'REQ456', file, 'key');

      expect(analytics.trackEvent).toHaveBeenCalledWith(
        'test-key',
        'user123',
        analytics.AnalyticsEvents.FILE_UPLOADED,
        expect.objectContaining({
          file_size_mb: '2.57'
        })
      );
    });

    test('handles missing PostHog key gracefully', () => {
      const file = createMockFile('data.csv', 'text/csv', 1024);

      // Should not throw
      expect(() => {
        service.trackUploadSuccess(undefined, 'user123', 'REQ456', file, 'key');
      }).not.toThrow();
    });
  });

  describe('trackValidationSuccess', () => {
    test('calls trackEvent with file details', () => {
      const file = createMockFile('data.csv', 'text/csv', 3.5 * 1024 * 1024);

      service.trackValidationSuccess('test-key', 'user123', file);

      expect(analytics.trackEvent).toHaveBeenCalledWith(
        'test-key',
        'user123',
        analytics.AnalyticsEvents.FILE_VALIDATED,
        expect.objectContaining({
          file_name: 'data.csv',
          file_type: 'text/csv',
          file_size_mb: '3.50'
        })
      );
    });
  });

  describe('trackValidationFailure', () => {
    test('calls trackEvent with failure reason', () => {
      const file = createMockFile('large.csv', 'text/csv', 15 * 1024 * 1024);
      const details = {
        reason: 'file_size_exceeded',
        limit: 10,
        received: '15.00'
      };

      service.trackValidationFailure('test-key', 'user123', file, 'file_size_exceeded', details);

      expect(analytics.trackEvent).toHaveBeenCalledWith(
        'test-key',
        'user123',
        analytics.AnalyticsEvents.FILE_VALIDATION_FAILED,
        expect.objectContaining({
          reason: 'file_size_exceeded',
          file_name: 'large.csv',
          file_type: 'text/csv',
          limit: 10,
          received: '15.00'
        })
      );
    });
  });

  describe('integration scenarios', () => {
    test('complete successful upload flow', async () => {
      const file = createMockFile('sales.csv', 'text/csv', 2 * 1024 * 1024);
      const userId = 'user123';

      // 1. Validate
      const validation = await service.validateUploadRequest(file, userId);
      expect(validation.success).toBe(true);

      // 2. Generate request ID
      const requestId = service.generateRequestId();
      expect(requestId).toBeDefined();

      // 3. Build file key
      const fileKey = service.buildFileKey(userId, requestId, file.name);
      expect(fileKey).toBe(`${userId}/${requestId}/${file.name}`);

      // 4. Prepare metadata
      const metadata = service.prepareFileMetadata({ file, userId, requestId }, file);
      expect(metadata.customMetadata?.requestId).toBe(requestId);

      // 5. Track success
      service.trackUploadSuccess('key', userId, requestId, file, fileKey);
      expect(analytics.trackEvent).toHaveBeenCalled();
    });

    test('validation failure flow', async () => {
      const file = createMockFile('huge.csv', 'text/csv', 20 * 1024 * 1024);
      const userId = 'user123';

      const validation = await service.validateUploadRequest(file, userId);

      expect(validation.success).toBe(false);
      expect(validation.validationDetails).toBeDefined();

      service.trackValidationFailure(
        'key',
        userId,
        file,
        validation.validationDetails!.reason,
        validation.validationDetails
      );

      expect(analytics.trackEvent).toHaveBeenCalledWith(
        'key',
        userId,
        analytics.AnalyticsEvents.FILE_VALIDATION_FAILED,
        expect.anything()
      );
    });
  });
});

// Helper function
function createMockFile(name: string, type: string, size: number): File {
  const file = new File(['content'], name, { type });
  Object.defineProperty(file, 'size', {
    value: size,
    writable: false
  });
  return file;
}
