import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ReportService } from './ReportService';
import { DatabaseService, AnalysisRequest, FinalReport } from './Database/DatabaseService';
import { LoggerService } from './Logger/LoggerService';

// Mock the analytics module
vi.mock('../shared/analytics', () => ({
  trackEvent: vi.fn(),
  AnalyticsEvents: {
    REPORT_RETRIEVED: 'report_retrieved'
  }
}));

describe('ReportService', () => {
  const createMockDatabaseService = () => ({
    getAnalysisRequest: vi.fn(),
    getFinalReport: vi.fn(),
    updateAnalysisRequestStatus: vi.fn(),
    getExecutiveAnalyses: vi.fn(),
    calculateProgress: vi.fn(),
    createAnalysisRequest: vi.fn()
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

  describe('getReport', () => {
    it('should return not_found status if request does not exist', async () => {
      const mockDb = createMockDatabaseService();
      mockDb.getAnalysisRequest.mockResolvedValue(null);

      const service = new ReportService(mockDb as any, createMockLoggerService() as any);
      const result = await service.getReport('non-existent');

      expect(result).toEqual({
        requestId: 'non-existent',
        status: 'not_found',
        error: 'Request not found'
      });
    });

    it('should return processing status for request in progress', async () => {
      const mockDb = createMockDatabaseService();
      const request: AnalysisRequest = {
        request_id: 'req-123',
        user_id: 'user-456',
        file_key: 'file/key',
        status: 'processing',
        created_at: Date.now()
      };

      mockDb.getAnalysisRequest.mockResolvedValue(request);

      const service = new ReportService(mockDb as any, createMockLoggerService() as any);
      const result = await service.getReport('req-123');

      expect(result).toEqual({
        requestId: 'req-123',
        status: 'processing',
        message: 'Analysis in progress'
      });
    });

    it('should return pending status for pending request', async () => {
      const mockDb = createMockDatabaseService();
      const request: AnalysisRequest = {
        request_id: 'req-123',
        user_id: 'user-456',
        file_key: 'file/key',
        status: 'pending',
        created_at: Date.now()
      };

      mockDb.getAnalysisRequest.mockResolvedValue(request);

      const service = new ReportService(mockDb as any, createMockLoggerService() as any);
      const result = await service.getReport('req-123');

      expect(result).toEqual({
        requestId: 'req-123',
        status: 'pending',
        message: 'Analysis in progress'
      });
    });

    it('should return failed status with error message', async () => {
      const mockDb = createMockDatabaseService();
      const request: AnalysisRequest = {
        request_id: 'req-123',
        user_id: 'user-456',
        file_key: 'file/key',
        status: 'failed',
        created_at: Date.now(),
        error_message: 'Timeout exceeded'
      };

      mockDb.getAnalysisRequest.mockResolvedValue(request);

      const service = new ReportService(mockDb as any, createMockLoggerService() as any);
      const result = await service.getReport('req-123');

      expect(result).toEqual({
        requestId: 'req-123',
        status: 'failed',
        error: 'Timeout exceeded'
      });
    });

    it('should return failed status with default error if no error message', async () => {
      const mockDb = createMockDatabaseService();
      const request: AnalysisRequest = {
        request_id: 'req-123',
        user_id: 'user-456',
        file_key: 'file/key',
        status: 'failed',
        created_at: Date.now()
      };

      mockDb.getAnalysisRequest.mockResolvedValue(request);

      const service = new ReportService(mockDb as any, createMockLoggerService() as any);
      const result = await service.getReport('req-123');

      expect(result).toEqual({
        requestId: 'req-123',
        status: 'failed',
        error: 'Analysis failed'
      });
    });

    it('should return not_found status if report does not exist for completed request', async () => {
      const mockDb = createMockDatabaseService();
      const request: AnalysisRequest = {
        request_id: 'req-123',
        user_id: 'user-456',
        file_key: 'file/key',
        status: 'completed',
        created_at: Date.now(),
        completed_at: Date.now()
      };

      mockDb.getAnalysisRequest.mockResolvedValue(request);
      mockDb.getFinalReport.mockResolvedValue(null);

      const service = new ReportService(mockDb as any, createMockLoggerService() as any);
      const result = await service.getReport('req-123');

      expect(result).toEqual({
        requestId: 'req-123',
        status: 'not_found',
        error: 'Report not found'
      });
    });

    it('should return completed report with content', async () => {
      const mockDb = createMockDatabaseService();
      const createdAt = Date.now();
      const request: AnalysisRequest = {
        request_id: 'req-123',
        user_id: 'user-456',
        file_key: 'file/key',
        status: 'completed',
        created_at: Date.now() - 10000,
        completed_at: createdAt
      };

      const report: FinalReport = {
        report_content: 'This is the final report content',
        report_key: 'reports/req-123/final.json',
        created_at: createdAt
      };

      mockDb.getAnalysisRequest.mockResolvedValue(request);
      mockDb.getFinalReport.mockResolvedValue(report);

      const service = new ReportService(mockDb as any, createMockLoggerService() as any);
      const result = await service.getReport('req-123');

      expect(result).toMatchObject({
        requestId: 'req-123',
        status: 'completed',
        report: 'This is the final report content'
      });

      expect(result.completedAt).toBeDefined();
      expect(mockDb.getFinalReport).toHaveBeenCalledWith('req-123');
    });

    it('should track report retrieval for completed reports', async () => {
      const mockDb = createMockDatabaseService();
      const mockLogger = createMockLoggerService();
      const createdAt = Date.now();
      const request: AnalysisRequest = {
        request_id: 'req-123',
        user_id: 'user-456',
        file_key: 'file/key',
        status: 'completed',
        created_at: Date.now() - 10000,
        completed_at: createdAt
      };

      const report: FinalReport = {
        report_content: 'This is the final report content',
        report_key: 'reports/req-123/final.json',
        created_at: createdAt
      };

      mockDb.getAnalysisRequest.mockResolvedValue(request);
      mockDb.getFinalReport.mockResolvedValue(report);

      const service = new ReportService(mockDb as any, mockLogger as any);
      await service.getReport('req-123');

      expect(mockLogger.trackReportRetrieved).toHaveBeenCalledWith(
        'req-123',
        new Date(createdAt).toISOString()
      );
    });
  });
});
