import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StatusService } from './StatusService';
import { DatabaseService, AnalysisRequest } from './Database/DatabaseService';
import { LoggerService } from './Logger/LoggerService';

// Mock the analytics module
vi.mock('../shared/analytics', () => ({
  trackEvent: vi.fn(),
  AnalyticsEvents: {
    STATUS_CHECKED: 'status_checked'
  }
}));

describe('StatusService', () => {
  const createMockDatabaseService = () => ({
    getAnalysisRequest: vi.fn(),
    updateAnalysisRequestStatus: vi.fn(),
    getExecutiveAnalyses: vi.fn(),
    calculateProgress: vi.fn(),
    createAnalysisRequest: vi.fn(),
    getFinalReport: vi.fn()
  });

  const createMockLoggerService = () => ({
    trackEvent: vi.fn(),
    trackAIPerformance: vi.fn(),
    trackRateLimitCheck: vi.fn(),
    trackRateLimitExceeded: vi.fn(),
    trackFileValidated: vi.fn(),
    trackFileValidationFailed: vi.fn(),
    trackFileUploaded: vi.fn(),
    trackFileUploadFailed: vi.fn(),
    trackStatusChecked: vi.fn(),
    trackReportRetrieved: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  });

  describe('hasTimedOut', () => {
    it('should return true if request is processing and has exceeded timeout', () => {
      const mockDb = createMockDatabaseService();
      const mockLogger = createMockLoggerService();
      const service = new StatusService(mockDb as any, mockLogger as any, 5 * 60 * 1000); // 5 minutes

      const request: AnalysisRequest = {
        request_id: 'req-123',
        user_id: 'user-456',
        file_key: 'file/key',
        status: 'processing',
        created_at: Date.now() - (6 * 60 * 1000) // 6 minutes ago
      };

      const result = service.hasTimedOut(request);
      expect(result).toBe(true);
    });

    it('should return false if request is processing but has not exceeded timeout', () => {
      const mockDb = createMockDatabaseService();
      const mockLogger = createMockLoggerService();
      const service = new StatusService(mockDb as any, mockLogger as any, 5 * 60 * 1000);

      const request: AnalysisRequest = {
        request_id: 'req-123',
        user_id: 'user-456',
        file_key: 'file/key',
        status: 'processing',
        created_at: Date.now() - (2 * 60 * 1000) // 2 minutes ago
      };

      const result = service.hasTimedOut(request);
      expect(result).toBe(false);
    });

    it('should return false if request is not processing', () => {
      const mockDb = createMockDatabaseService();
      const mockLogger = createMockLoggerService();
      const service = new StatusService(mockDb as any, mockLogger as any, 5 * 60 * 1000);

      const request: AnalysisRequest = {
        request_id: 'req-123',
        user_id: 'user-456',
        file_key: 'file/key',
        status: 'completed',
        created_at: Date.now() - (6 * 60 * 1000) // 6 minutes ago
      };

      const result = service.hasTimedOut(request);
      expect(result).toBe(false);
    });
  });

  describe('handleTimeout', () => {
    it('should update request status to failed and return timeout result', async () => {
      const mockDb = createMockDatabaseService();
      const mockLogger = createMockLoggerService();
      const service = new StatusService(mockDb as any, mockLogger as any, 5 * 60 * 1000);

      const request: AnalysisRequest = {
        request_id: 'req-123',
        user_id: 'user-456',
        file_key: 'file/key',
        status: 'processing',
        created_at: Date.now() - (6 * 60 * 1000)
      };

      const result = await service.handleTimeout('req-123', request);

      expect(mockDb.updateAnalysisRequestStatus).toHaveBeenCalledWith(
        'req-123',
        'failed',
        'Processing timeout exceeded (5 minutes)',
        expect.any(Number)
      );

      expect(result).toMatchObject({
        requestId: 'req-123',
        status: 'failed',
        error: 'Processing timeout exceeded',
        message: 'Analysis took longer than expected. Please try again.',
        timedOut: true
      });

      expect(result.createdAt).toBeDefined();
      expect(result.completedAt).toBeDefined();
    });
  });

  describe('checkStatus', () => {
    it('should return null if request not found', async () => {
      const mockDb = createMockDatabaseService();
      const mockLogger = createMockLoggerService();
      mockDb.getAnalysisRequest.mockResolvedValue(null);

      const service = new StatusService(mockDb as any, mockLogger as any);
      const result = await service.checkStatus('non-existent');

      expect(result).toBeNull();
    });

    it('should handle timeout if request has timed out', async () => {
      const mockDb = createMockDatabaseService();
      const mockLogger = createMockLoggerService();
      const oldRequest: AnalysisRequest = {
        request_id: 'req-123',
        user_id: 'user-456',
        file_key: 'file/key',
        status: 'processing',
        created_at: Date.now() - (6 * 60 * 1000)
      };

      mockDb.getAnalysisRequest.mockResolvedValue(oldRequest);

      const service = new StatusService(mockDb as any, mockLogger as any, 5 * 60 * 1000);
      const result = await service.checkStatus('req-123');

      expect(result?.timedOut).toBe(true);
      expect(result?.status).toBe('failed');
      expect(mockDb.updateAnalysisRequestStatus).toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should return status with progress for active request', async () => {
      const mockDb = createMockDatabaseService();
      const mockLogger = createMockLoggerService();
      const request: AnalysisRequest = {
        request_id: 'req-123',
        user_id: 'user-456',
        file_key: 'file/key',
        status: 'processing',
        created_at: Date.now() - (2 * 60 * 1000)
      };

      const analyses = [
        { executive_role: 'CFO', analysis_text: 'CFO analysis' },
        { executive_role: 'CMO', analysis_text: 'CMO analysis' }
      ];

      const progress = {
        cfo: 'completed' as const,
        cmo: 'completed' as const,
        coo: 'pending' as const,
        synthesis: 'pending' as const
      };

      mockDb.getAnalysisRequest.mockResolvedValue(request);
      mockDb.getExecutiveAnalyses.mockResolvedValue(analyses);
      mockDb.calculateProgress.mockReturnValue(progress);

      const service = new StatusService(mockDb as any, mockLogger as any);
      const result = await service.checkStatus('req-123');

      expect(result).toMatchObject({
        requestId: 'req-123',
        status: 'processing',
        progress,
        timedOut: false
      });

      expect(mockDb.getExecutiveAnalyses).toHaveBeenCalledWith('req-123');
      expect(mockDb.calculateProgress).toHaveBeenCalledWith(analyses, 'processing');
      expect(mockLogger.trackStatusChecked).toHaveBeenCalledWith('req-123', 'processing', progress);
    });

    it('should return status with completedAt for completed request', async () => {
      const mockDb = createMockDatabaseService();
      const mockLogger = createMockLoggerService();
      const completedAt = Date.now();
      const request: AnalysisRequest = {
        request_id: 'req-123',
        user_id: 'user-456',
        file_key: 'file/key',
        status: 'completed',
        created_at: Date.now() - (10 * 60 * 1000),
        completed_at: completedAt
      };

      const analyses = [
        { executive_role: 'CFO', analysis_text: 'CFO analysis' },
        { executive_role: 'CMO', analysis_text: 'CMO analysis' },
        { executive_role: 'COO', analysis_text: 'COO analysis' }
      ];

      const progress = {
        cfo: 'completed' as const,
        cmo: 'completed' as const,
        coo: 'completed' as const,
        synthesis: 'completed' as const
      };

      mockDb.getAnalysisRequest.mockResolvedValue(request);
      mockDb.getExecutiveAnalyses.mockResolvedValue(analyses);
      mockDb.calculateProgress.mockReturnValue(progress);

      const service = new StatusService(mockDb as any, mockLogger as any);
      const result = await service.checkStatus('req-123');

      expect(result).toMatchObject({
        requestId: 'req-123',
        status: 'completed',
        progress,
        timedOut: false
      });

      expect(result?.completedAt).toBeDefined();
    });
  });
});
