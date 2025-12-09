import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { DatabaseService, AnalysisRequest, ExecutiveAnalysis } from './DatabaseService';
import { LoggerService } from '../Logger/LoggerService';

// Mock D1Database
const createMockDb = () => {
  const mockRun = vi.fn().mockResolvedValue({ success: true });
  const mockFirst = vi.fn();
  const mockAll = vi.fn();
  const mockBind = vi.fn();

  const mockPrepare = vi.fn().mockReturnValue({
    bind: (...args: any[]) => {
      mockBind(...args);
      return {
        run: mockRun,
        first: mockFirst,
        all: mockAll
      };
    }
  });

  return {
    prepare: mockPrepare,
    mockRun,
    mockFirst,
    mockAll,
    mockBind
  };
};

describe('DatabaseService', () => {
  let mockLogger: LoggerService;

  beforeEach(() => {
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      trackEvent: vi.fn(),
      trackAIPerformance: vi.fn(),
      trackRateLimitCheck: vi.fn(),
      trackRateLimitExceeded: vi.fn(),
      trackFileValidated: vi.fn(),
      trackFileValidationFailed: vi.fn(),
      trackFileUploaded: vi.fn(),
      trackFileUploadFailed: vi.fn(),
      trackStatusChecked: vi.fn(),
      trackReportRetrieved: vi.fn()
    } as unknown as LoggerService;
  });

  describe('createAnalysisRequest', () => {
    it('should insert a new analysis request with correct parameters', async () => {
      const mockDb = createMockDb();
      const service = new DatabaseService(mockDb as any, mockLogger);

      await service.createAnalysisRequest('req-123', 'user-456', 'file/path/key.csv', 'processing');

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO analysis_requests')
      );
      expect(mockDb.mockBind).toHaveBeenCalledWith(
        'req-123',
        'user-456',
        'file/path/key.csv',
        'processing',
        expect.any(Number)
      );
      expect(mockDb.mockRun).toHaveBeenCalled();
    });

    it('should default status to processing if not provided', async () => {
      const mockDb = createMockDb();
      const service = new DatabaseService(mockDb as any, mockLogger);

      await service.createAnalysisRequest('req-123', 'user-456', 'file/path/key.csv');

      expect(mockDb.mockBind).toHaveBeenCalledWith(
        'req-123',
        'user-456',
        'file/path/key.csv',
        'processing',
        expect.any(Number)
      );
    });
  });

  describe('getAnalysisRequest', () => {
    it('should retrieve an analysis request by ID', async () => {
      const mockDb = createMockDb();
      const mockRequest: AnalysisRequest = {
        request_id: 'req-123',
        user_id: 'user-456',
        file_key: 'file/path/key.csv',
        status: 'processing',
        created_at: Date.now()
      };

      mockDb.mockFirst.mockResolvedValue(mockRequest);

      const service = new DatabaseService(mockDb as any, mockLogger);
      const result = await service.getAnalysisRequest('req-123');

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('SELECT')
      );
      expect(mockDb.mockBind).toHaveBeenCalledWith('req-123');
      expect(result).toEqual(mockRequest);
    });

    it('should return null if request not found', async () => {
      const mockDb = createMockDb();
      mockDb.mockFirst.mockResolvedValue(null);

      const service = new DatabaseService(mockDb as any, mockLogger);
      const result = await service.getAnalysisRequest('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('updateAnalysisRequestStatus', () => {
    it('should update status without error message', async () => {
      const mockDb = createMockDb();
      const service = new DatabaseService(mockDb as any, mockLogger);

      await service.updateAnalysisRequestStatus('req-123', 'completed');

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE analysis_requests')
      );
      expect(mockDb.mockBind).toHaveBeenCalledWith(
        'completed',
        expect.any(Number),
        'req-123'
      );
    });

    it('should update status with error message', async () => {
      const mockDb = createMockDb();
      const service = new DatabaseService(mockDb as any, mockLogger);

      await service.updateAnalysisRequestStatus('req-123', 'failed', 'Timeout exceeded', Date.now());

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE analysis_requests')
      );
      expect(mockDb.mockBind).toHaveBeenCalledWith(
        'failed',
        'Timeout exceeded',
        expect.any(Number),
        'req-123'
      );
    });
  });

  describe('getExecutiveAnalyses', () => {
    it('should retrieve executive analyses for a request', async () => {
      const mockDb = createMockDb();
      const mockAnalyses: ExecutiveAnalysis[] = [
        { executive_role: 'CFO', analysis_text: 'CFO analysis' },
        { executive_role: 'CMO', analysis_text: 'CMO analysis' },
        { executive_role: 'COO', analysis_text: 'COO analysis' }
      ];

      mockDb.mockAll.mockResolvedValue({ results: mockAnalyses });

      const service = new DatabaseService(mockDb as any, mockLogger);
      const result = await service.getExecutiveAnalyses('req-123');

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('SELECT executive_role, analysis_text')
      );
      expect(mockDb.mockBind).toHaveBeenCalledWith('req-123');
      expect(result).toEqual(mockAnalyses);
    });

    it('should return empty array if no analyses found', async () => {
      const mockDb = createMockDb();
      mockDb.mockAll.mockResolvedValue({ results: [] });

      const service = new DatabaseService(mockDb as any, mockLogger);
      const result = await service.getExecutiveAnalyses('req-123');

      expect(result).toEqual([]);
    });
  });

  describe('getFinalReport', () => {
    it('should retrieve final report for a request', async () => {
      const mockDb = createMockDb();
      const mockReport = {
        report_content: 'Final report content',
        report_key: 'report/path/key',
        created_at: Date.now()
      };

      mockDb.mockFirst.mockResolvedValue(mockReport);

      const service = new DatabaseService(mockDb as any, mockLogger);
      const result = await service.getFinalReport('req-123');

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('SELECT report_content, report_key, created_at')
      );
      expect(mockDb.mockBind).toHaveBeenCalledWith('req-123');
      expect(result).toEqual(mockReport);
    });

    it('should return null if report not found', async () => {
      const mockDb = createMockDb();
      mockDb.mockFirst.mockResolvedValue(null);

      const service = new DatabaseService(mockDb as any, mockLogger);
      const result = await service.getFinalReport('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('calculateProgress', () => {
    it('should calculate progress correctly with all analyses completed', () => {
      const mockDb = createMockDb();
      const service = new DatabaseService(mockDb as any, mockLogger);

      const analyses: ExecutiveAnalysis[] = [
        { executive_role: 'CFO', analysis_text: 'CFO analysis' },
        { executive_role: 'CMO', analysis_text: 'CMO analysis' },
        { executive_role: 'COO', analysis_text: 'COO analysis' }
      ];

      const progress = service.calculateProgress(analyses, 'completed');

      expect(progress).toEqual({
        cfo: 'completed',
        cmo: 'completed',
        coo: 'completed',
        synthesis: 'completed'
      });
    });

    it('should calculate progress correctly with partial analyses', () => {
      const mockDb = createMockDb();
      const service = new DatabaseService(mockDb as any, mockLogger);

      const analyses: ExecutiveAnalysis[] = [
        { executive_role: 'CFO', analysis_text: 'CFO analysis' }
      ];

      const progress = service.calculateProgress(analyses, 'processing');

      expect(progress).toEqual({
        cfo: 'completed',
        cmo: 'pending',
        coo: 'pending',
        synthesis: 'pending'
      });
    });

    it('should calculate progress correctly with no analyses', () => {
      const mockDb = createMockDb();
      const service = new DatabaseService(mockDb as any, mockLogger);

      const progress = service.calculateProgress([], 'processing');

      expect(progress).toEqual({
        cfo: 'pending',
        cmo: 'pending',
        coo: 'pending',
        synthesis: 'pending'
      });
    });
  });
  describe('createExecutiveAnalysis', () => {
    it('should create an executive analysis record', async () => {
      const mockDb = createMockDb();
      const service = new DatabaseService(mockDb as any, mockLogger);

      await service.createExecutiveAnalysis('req-123', 'CFO', 'analysis content', 1234567890);

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO executive_analyses')
      );
      expect(mockDb.mockBind).toHaveBeenCalledWith(
        'req-123',
        'CFO',
        'analysis content',
        1234567890
      );
      expect(mockDb.mockRun).toHaveBeenCalled();
    });
  });

  describe('createFinalReport', () => {
    it('should create a final report record', async () => {
      const mockDb = createMockDb();
      const service = new DatabaseService(mockDb as any, mockLogger);

      await service.createFinalReport('req-123', 'report content', 'key', 1234567890);

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO final_reports')
      );
      expect(mockDb.mockBind).toHaveBeenCalledWith(
        'req-123',
        'report content',
        'key',
        1234567890
      );
      expect(mockDb.mockRun).toHaveBeenCalled();
    });
  });
});
