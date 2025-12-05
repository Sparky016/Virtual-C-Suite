import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LoggerService } from './LoggerService';
import * as analytics from '../shared/analytics';

// Mock the analytics module
vi.mock('../shared/analytics', () => ({
  trackEvent: vi.fn(),
  trackAIPerformance: vi.fn(),
  AnalyticsEvents: {
    RATE_LIMIT_CHECKED: 'rate_limit_checked',
    RATE_LIMIT_EXCEEDED: 'rate_limit_exceeded',
    FILE_VALIDATED: 'file_validated',
    FILE_VALIDATION_FAILED: 'file_validation_failed',
    FILE_UPLOADED: 'file_uploaded',
    FILE_UPLOAD_FAILED: 'file_upload_failed',
    STATUS_CHECKED: 'status_checked',
    REPORT_RETRIEVED: 'report_retrieved'
  }
}));

describe('LoggerService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('trackEvent', () => {
    it('should call trackEvent with correct parameters', () => {
      const logger = new LoggerService('test-key');
      logger.trackEvent('user-123', 'test_event', { foo: 'bar' });

      expect(analytics.trackEvent).toHaveBeenCalledWith(
        'test-key',
        'user-123',
        'test_event',
        { foo: 'bar' }
      );
    });

    it('should work without PostHog key', () => {
      const logger = new LoggerService();
      logger.trackEvent('user-123', 'test_event');

      expect(analytics.trackEvent).toHaveBeenCalledWith(
        undefined,
        'user-123',
        'test_event',
        undefined
      );
    });
  });

  describe('trackAIPerformance', () => {
    it('should call trackAIPerformance with correct parameters', () => {
      const logger = new LoggerService('test-key');
      logger.trackAIPerformance('user-123', 'CFO', 1500, 2, true, { request_id: 'req-123' });

      expect(analytics.trackAIPerformance).toHaveBeenCalledWith(
        'test-key',
        'user-123',
        'CFO',
        1500,
        2,
        true,
        { request_id: 'req-123' }
      );
    });
  });

  describe('trackRateLimitCheck', () => {
    it('should track rate limit check with allowed status', () => {
      const logger = new LoggerService('test-key');
      logger.trackRateLimitCheck('user-123', true, 5);

      expect(analytics.trackEvent).toHaveBeenCalledWith(
        'test-key',
        'user-123',
        'rate_limit_checked',
        {
          allowed: true,
          remaining: 5
        }
      );
    });

    it('should track rate limit check with exceeded status', () => {
      const logger = new LoggerService('test-key');
      logger.trackRateLimitCheck('user-123', false, 0);

      expect(analytics.trackEvent).toHaveBeenCalledWith(
        'test-key',
        'user-123',
        'rate_limit_checked',
        {
          allowed: false,
          remaining: 0
        }
      );
    });
  });

  describe('trackRateLimitExceeded', () => {
    it('should track rate limit exceeded event', () => {
      const logger = new LoggerService('test-key');
      logger.trackRateLimitExceeded('user-123', 'Limit exceeded', 0, '2025-01-01T00:00:00Z');

      expect(analytics.trackEvent).toHaveBeenCalledWith(
        'test-key',
        'user-123',
        'rate_limit_exceeded',
        {
          message: 'Limit exceeded',
          remaining: 0,
          resetAt: '2025-01-01T00:00:00Z'
        }
      );
    });
  });

  describe('trackFileValidated', () => {
    it('should track successful file validation', () => {
      const logger = new LoggerService('test-key');
      logger.trackFileValidated('user-123', 'test.csv', 'text/csv', '1.5');

      expect(analytics.trackEvent).toHaveBeenCalledWith(
        'test-key',
        'user-123',
        'file_validated',
        {
          file_name: 'test.csv',
          file_type: 'text/csv',
          file_size_mb: '1.5'
        }
      );
    });
  });

  describe('trackFileValidationFailed', () => {
    it('should track file validation failure', () => {
      const logger = new LoggerService('test-key');
      logger.trackFileValidationFailed('user-123', 'file_size_exceeded', {
        size_mb: '15.5',
        limit_mb: 10
      });

      expect(analytics.trackEvent).toHaveBeenCalledWith(
        'test-key',
        'user-123',
        'file_validation_failed',
        {
          reason: 'file_size_exceeded',
          size_mb: '15.5',
          limit_mb: 10
        }
      );
    });
  });

  describe('trackFileUploaded', () => {
    it('should track successful file upload', () => {
      const logger = new LoggerService('test-key');
      logger.trackFileUploaded('user-123', 'req-123', 'test.csv', 'text/csv', '1.5', 'user-123/req-123/test.csv');

      expect(analytics.trackEvent).toHaveBeenCalledWith(
        'test-key',
        'user-123',
        'file_uploaded',
        {
          request_id: 'req-123',
          file_name: 'test.csv',
          file_type: 'text/csv',
          file_size_mb: '1.5',
          file_key: 'user-123/req-123/test.csv'
        }
      );
    });
  });

  describe('trackFileUploadFailed', () => {
    it('should track file upload failure', () => {
      const logger = new LoggerService('test-key');
      logger.trackFileUploadFailed('user-123', 'Network error');

      expect(analytics.trackEvent).toHaveBeenCalledWith(
        'test-key',
        'user-123',
        'file_upload_failed',
        {
          error: 'Network error'
        }
      );
    });
  });

  describe('trackStatusChecked', () => {
    it('should track status check', () => {
      const logger = new LoggerService('test-key');
      const progress = {
        cfo: 'completed',
        cmo: 'completed',
        coo: 'pending',
        synthesis: 'pending'
      };

      logger.trackStatusChecked('req-123', 'processing', progress);

      expect(analytics.trackEvent).toHaveBeenCalledWith(
        'test-key',
        'system',
        'status_checked',
        {
          request_id: 'req-123',
          status: 'processing',
          progress
        }
      );
    });
  });

  describe('trackReportRetrieved', () => {
    it('should track report retrieval', () => {
      const logger = new LoggerService('test-key');
      logger.trackReportRetrieved('req-123', '2025-01-01T00:00:00Z');

      expect(analytics.trackEvent).toHaveBeenCalledWith(
        'test-key',
        'system',
        'report_retrieved',
        {
          request_id: 'req-123',
          completed_at: '2025-01-01T00:00:00Z'
        }
      );
    });
  });

  describe('console methods', () => {
    it('should call console.log for info', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const logger = new LoggerService();

      logger.info('Test message', 'arg1', 'arg2');

      expect(consoleSpy).toHaveBeenCalledWith('Test message', 'arg1', 'arg2');
      consoleSpy.mockRestore();
    });

    it('should call console.warn for warn', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const logger = new LoggerService();

      logger.warn('Warning message', 'arg1');

      expect(consoleSpy).toHaveBeenCalledWith('Warning message', 'arg1');
      consoleSpy.mockRestore();
    });

    it('should call console.error for error', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const logger = new LoggerService();

      logger.error('Error message', new Error('test'));

      expect(consoleSpy).toHaveBeenCalledWith('Error message', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });
});
