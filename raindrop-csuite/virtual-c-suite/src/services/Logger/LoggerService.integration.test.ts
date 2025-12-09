import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LoggerService } from './LoggerService';
import * as analytics from '../../analytics/analytics';

/**
 * Integration tests for LoggerService
 * These tests verify the actual integration with the analytics module
 * without mocking the analytics functions
 */
describe('LoggerService - Integration Tests', () => {
  let trackEventSpy: any;
  let trackAIPerformanceSpy: any;
  let consoleLogSpy: any;
  let consoleWarnSpy: any;
  let consoleErrorSpy: any;

  beforeEach(() => {
    // Spy on the actual analytics functions
    trackEventSpy = vi.spyOn(analytics, 'trackEvent');
    trackAIPerformanceSpy = vi.spyOn(analytics, 'trackAIPerformance');

    // Spy on console methods
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => { });
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Event Tracking Integration', () => {
    it('should call trackEvent with correct parameters through the service', () => {
      const logger = new LoggerService(process.env.POSTHOG_API_KEY);
      const eventData = { foo: 'bar', count: 42 };

      logger.trackEvent('user-123', 'test_event', eventData);

      expect(trackEventSpy).toHaveBeenCalledTimes(1);
      expect(trackEventSpy).toHaveBeenCalledWith(
        process.env.POSTHOG_API_KEY,
        'user-123',
        'test_event',
        eventData
      );
    });

    it('should handle undefined PostHog key gracefully', () => {
      const logger = new LoggerService();

      logger.trackEvent('user-123', 'test_event');

      expect(trackEventSpy).toHaveBeenCalledWith(
        undefined,
        'user-123',
        'test_event',
        undefined
      );
    });

    it('should track multiple events in sequence', () => {
      const logger = new LoggerService(process.env.POSTHOG_API_KEY);

      logger.trackEvent('user-1', 'event_1', { step: 1 });
      logger.trackEvent('user-2', 'event_2', { step: 2 });
      logger.trackEvent('user-1', 'event_3', { step: 3 });

      expect(trackEventSpy).toHaveBeenCalledTimes(3);
      expect(trackEventSpy.mock.calls[0]).toEqual([process.env.POSTHOG_API_KEY, 'user-1', 'event_1', { step: 1 }]);
      expect(trackEventSpy.mock.calls[1]).toEqual([process.env.POSTHOG_API_KEY, 'user-2', 'event_2', { step: 2 }]);
      expect(trackEventSpy.mock.calls[2]).toEqual([process.env.POSTHOG_API_KEY, 'user-1', 'event_3', { step: 3 }]);
    });
  });

  describe('AI Performance Tracking Integration', () => {
    it('should call trackAIPerformance with correct parameters', () => {
      const logger = new LoggerService(process.env.POSTHOG_API_KEY);

      logger.trackAIPerformance('user-123', 'CFO', 1500, 2, true, { request_id: 'req-123' });

      expect(trackAIPerformanceSpy).toHaveBeenCalledTimes(1);
      expect(trackAIPerformanceSpy).toHaveBeenCalledWith(
        process.env.POSTHOG_API_KEY,
        'user-123',
        'CFO',
        1500,
        2,
        true,
        { request_id: 'req-123' }
      );
    });

    it('should track performance for all executive roles', () => {
      const logger = new LoggerService(process.env.POSTHOG_API_KEY);

      logger.trackAIPerformance('user-1', 'CFO', 1000, 1, true);
      logger.trackAIPerformance('user-1', 'CMO', 1200, 1, true);
      logger.trackAIPerformance('user-1', 'COO', 1100, 2, true);
      logger.trackAIPerformance('user-1', 'CEO', 1500, 1, true);

      expect(trackAIPerformanceSpy).toHaveBeenCalledTimes(4);
    });

    it('should track failed AI calls correctly', () => {
      const logger = new LoggerService(process.env.POSTHOG_API_KEY);

      logger.trackAIPerformance('user-123', 'CFO', 5000, 3, false, {
        error: 'Timeout',
        request_id: 'req-123'
      });

      expect(trackAIPerformanceSpy).toHaveBeenCalledWith(
        process.env.POSTHOG_API_KEY,
        'user-123',
        'CFO',
        5000,
        3,
        false,
        { error: 'Timeout', request_id: 'req-123' }
      );
    });
  });

  describe('Rate Limit Tracking Integration', () => {
    it('should track rate limit check correctly', () => {
      const logger = new LoggerService(process.env.POSTHOG_API_KEY);

      logger.trackRateLimitCheck('user-123', true, 5);

      expect(trackEventSpy).toHaveBeenCalledWith(
        process.env.POSTHOG_API_KEY,
        'user-123',
        analytics.AnalyticsEvents.RATE_LIMIT_CHECKED,
        {
          allowed: true,
          remaining: 5
        }
      );
    });

    it('should track rate limit exceeded with full details', () => {
      const logger = new LoggerService(process.env.POSTHOG_API_KEY);
      const resetTime = '2025-01-01T00:00:00Z';

      logger.trackRateLimitExceeded('user-123', 'Too many requests', 0, resetTime);

      expect(trackEventSpy).toHaveBeenCalledWith(
        process.env.POSTHOG_API_KEY,
        'user-123',
        analytics.AnalyticsEvents.RATE_LIMIT_EXCEEDED,
        {
          message: 'Too many requests',
          remaining: 0,
          resetAt: resetTime
        }
      );
    });
  });

  describe('File Tracking Integration', () => {
    it('should track file validation success with all metadata', () => {
      const logger = new LoggerService(process.env.POSTHOG_API_KEY);

      logger.trackFileValidated('user-123', 'report.csv', 'text/csv', '2.5');

      expect(trackEventSpy).toHaveBeenCalledWith(
        process.env.POSTHOG_API_KEY,
        'user-123',
        analytics.AnalyticsEvents.FILE_VALIDATED,
        {
          file_name: 'report.csv',
          file_type: 'text/csv',
          file_size_mb: '2.5'
        }
      );
    });

    it('should track file validation failure with reason and details', () => {
      const logger = new LoggerService(process.env.POSTHOG_API_KEY);

      logger.trackFileValidationFailed('user-123', 'file_too_large', {
        size_mb: '15.5',
        limit_mb: 10,
        file_name: 'huge_file.csv'
      });

      expect(trackEventSpy).toHaveBeenCalledWith(
        process.env.POSTHOG_API_KEY,
        'user-123',
        analytics.AnalyticsEvents.FILE_VALIDATION_FAILED,
        {
          reason: 'file_too_large',
          size_mb: '15.5',
          limit_mb: 10,
          file_name: 'huge_file.csv'
        }
      );
    });

    it('should track successful file upload with complete metadata', () => {
      const logger = new LoggerService(process.env.POSTHOG_API_KEY);

      logger.trackFileUploaded(
        'user-123',
        'req-abc123',
        'data.csv',
        'text/csv',
        '1.8',
        'user-123/req-abc123/data.csv'
      );

      expect(trackEventSpy).toHaveBeenCalledWith(
        process.env.POSTHOG_API_KEY,
        'user-123',
        analytics.AnalyticsEvents.FILE_UPLOADED,
        {
          request_id: 'req-abc123',
          file_name: 'data.csv',
          file_type: 'text/csv',
          file_size_mb: '1.8',
          file_key: 'user-123/req-abc123/data.csv'
        }
      );
    });

    it('should track file upload failure', () => {
      const logger = new LoggerService(process.env.POSTHOG_API_KEY);

      logger.trackFileUploadFailed('user-123', 'Network connection lost');

      expect(trackEventSpy).toHaveBeenCalledWith(
        process.env.POSTHOG_API_KEY,
        'user-123',
        analytics.AnalyticsEvents.FILE_UPLOAD_FAILED,
        {
          error: 'Network connection lost'
        }
      );
    });
  });

  describe('Status and Report Tracking Integration', () => {
    it('should track status check with progress information', () => {
      const logger = new LoggerService(process.env.POSTHOG_API_KEY);
      const progress = {
        cfo: 'completed',
        cmo: 'completed',
        coo: 'pending',
        synthesis: 'pending'
      };

      logger.trackStatusChecked('req-123', 'processing', progress);

      expect(trackEventSpy).toHaveBeenCalledWith(
        process.env.POSTHOG_API_KEY,
        'system',
        analytics.AnalyticsEvents.STATUS_CHECKED,
        {
          request_id: 'req-123',
          status: 'processing',
          progress
        }
      );
    });

    it('should track report retrieval with completion time', () => {
      const logger = new LoggerService(process.env.POSTHOG_API_KEY);
      const completedAt = '2025-01-01T12:00:00Z';

      logger.trackReportRetrieved('req-123', completedAt);

      expect(trackEventSpy).toHaveBeenCalledWith(
        process.env.POSTHOG_API_KEY,
        'system',
        analytics.AnalyticsEvents.REPORT_RETRIEVED,
        {
          request_id: 'req-123',
          completed_at: completedAt
        }
      );
    });
  });

  describe('Console Logging Integration', () => {
    it('should call console.log for info method', () => {
      const logger = new LoggerService(process.env.POSTHOG_API_KEY);

      logger.info('Information message', 'detail1', 'detail2');

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      expect(consoleLogSpy).toHaveBeenCalledWith('Information message', 'detail1', 'detail2');
    });

    it('should call console.warn for warn method', () => {
      const logger = new LoggerService(process.env.POSTHOG_API_KEY);

      logger.warn('Warning message', { code: 'WARN_001' });

      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      expect(consoleWarnSpy).toHaveBeenCalledWith('Warning message', { code: 'WARN_001' });
    });

    it('should call console.error for error method', () => {
      const logger = new LoggerService(process.env.POSTHOG_API_KEY);
      const error = new Error('Test error');

      logger.error('Error occurred', error);

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error occurred', error);
    });

    it('should handle multiple console calls correctly', () => {
      const logger = new LoggerService(process.env.POSTHOG_API_KEY);

      logger.info('Step 1');
      logger.warn('Step 2');
      logger.error('Step 3');
      logger.info('Step 4');

      expect(consoleLogSpy).toHaveBeenCalledTimes(2);
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('End-to-End Workflow Integration', () => {
    it('should track complete file upload workflow', () => {
      const logger = new LoggerService(process.env.POSTHOG_API_KEY);
      const userId = 'user-123';
      const requestId = 'req-abc';

      // 1. Rate limit check
      logger.trackRateLimitCheck(userId, true, 9);

      // 2. File validation
      logger.trackFileValidated(userId, 'data.csv', 'text/csv', '2.5');

      // 3. File upload success
      logger.trackFileUploaded(userId, requestId, 'data.csv', 'text/csv', '2.5', 'user-123/req-abc/data.csv');

      expect(trackEventSpy).toHaveBeenCalledTimes(3);
      expect(trackEventSpy.mock.calls[0][2]).toBe(analytics.AnalyticsEvents.RATE_LIMIT_CHECKED);
      expect(trackEventSpy.mock.calls[1][2]).toBe(analytics.AnalyticsEvents.FILE_VALIDATED);
      expect(trackEventSpy.mock.calls[2][2]).toBe(analytics.AnalyticsEvents.FILE_UPLOADED);
    });

    it('should track complete analysis workflow', () => {
      const logger = new LoggerService(process.env.POSTHOG_API_KEY);
      const userId = 'user-123';
      const requestId = 'req-abc';

      // 1. File uploaded
      logger.trackFileUploaded(userId, requestId, 'data.csv', 'text/csv', '2.5', 'user-123/req-abc/data.csv');

      // 2. AI analysis for executives
      logger.trackAIPerformance(userId, 'CFO', 1200, 1, true, { request_id: requestId });
      logger.trackAIPerformance(userId, 'CMO', 1300, 1, true, { request_id: requestId });
      logger.trackAIPerformance(userId, 'COO', 1100, 1, true, { request_id: requestId });

      // 3. CEO synthesis
      logger.trackAIPerformance(userId, 'CEO', 1500, 1, true, { request_id: requestId });

      // 4. Status checked
      logger.trackStatusChecked(requestId, 'completed', {
        cfo: 'completed',
        cmo: 'completed',
        coo: 'completed',
        synthesis: 'completed'
      });

      // 5. Report retrieved
      logger.trackReportRetrieved(requestId, new Date().toISOString());

      expect(trackEventSpy).toHaveBeenCalledTimes(3); // file upload + status + report
      expect(trackAIPerformanceSpy).toHaveBeenCalledTimes(4); // 3 executives + CEO
    });

    it('should track failed workflow with appropriate events', () => {
      const logger = new LoggerService(process.env.POSTHOG_API_KEY);
      const userId = 'user-123';

      // 1. Rate limit check succeeds
      logger.trackRateLimitCheck(userId, true, 5);

      // 2. File validation fails
      logger.trackFileValidationFailed(userId, 'invalid_file_type', {
        file_type: 'application/exe',
        file_name: 'malware.exe'
      });

      expect(trackEventSpy).toHaveBeenCalledTimes(2);
      expect(trackEventSpy.mock.calls[1][2]).toBe(analytics.AnalyticsEvents.FILE_VALIDATION_FAILED);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle null/undefined properties gracefully', () => {
      const logger = new LoggerService(process.env.POSTHOG_API_KEY);

      logger.trackEvent('user-123', 'test_event', undefined);
      logger.trackEvent('user-123', 'test_event', null as any);

      expect(trackEventSpy).toHaveBeenCalledTimes(2);
    });

    it('should handle empty strings in tracking', () => {
      const logger = new LoggerService(process.env.POSTHOG_API_KEY);

      logger.trackFileValidated('', '', '', '');

      expect(trackEventSpy).toHaveBeenCalledWith(
        process.env.POSTHOG_API_KEY,
        '',
        analytics.AnalyticsEvents.FILE_VALIDATED,
        {
          file_name: '',
          file_type: '',
          file_size_mb: ''
        }
      );
    });

    it('should handle very large property objects', () => {
      const logger = new LoggerService(process.env.POSTHOG_API_KEY);
      const largeObject: any = {};
      for (let i = 0; i < 100; i++) {
        largeObject[`key${i}`] = `value${i}`;
      }

      logger.trackEvent('user-123', 'large_event', largeObject);

      expect(trackEventSpy).toHaveBeenCalledWith(process.env.POSTHOG_API_KEY, 'user-123', 'large_event', largeObject);
    });

    it('should handle special characters in user IDs and event names', () => {
      const logger = new LoggerService(process.env.POSTHOG_API_KEY);

      logger.trackEvent('user@email.com', 'event:special/chars\\test', { data: 'value' });

      expect(trackEventSpy).toHaveBeenCalledWith(
        process.env.POSTHOG_API_KEY,
        'user@email.com',
        'event:special/chars\\test',
        { data: 'value' }
      );
    });
  });

  describe('Multiple Logger Instances', () => {
    it('should maintain separate keys for different logger instances', () => {
      const logger1 = new LoggerService('key-1');
      const logger2 = new LoggerService('key-2');

      logger1.trackEvent('user-1', 'event-1');
      logger2.trackEvent('user-2', 'event-2');

      expect(trackEventSpy.mock.calls[0][0]).toBe('key-1');
      expect(trackEventSpy.mock.calls[1][0]).toBe('key-2');
    });

    it('should allow one logger with key and one without', () => {
      const loggerWithKey = new LoggerService(process.env.POSTHOG_API_KEY);
      const loggerWithoutKey = new LoggerService();

      loggerWithKey.trackEvent('user-1', 'event-1');
      loggerWithoutKey.trackEvent('user-2', 'event-2');

      expect(trackEventSpy.mock.calls[0][0]).toBe(process.env.POSTHOG_API_KEY);
      expect(trackEventSpy.mock.calls[1][0]).toBeUndefined();
    });
  });
});
