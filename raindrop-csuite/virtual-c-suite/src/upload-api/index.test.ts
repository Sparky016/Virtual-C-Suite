import { describe, test, expect, vi, beforeEach } from 'vitest';
import Worker from './index';

const {
  mockUploadService,
  mockDatabaseService,
  mockRateLimiter,
  mockStatusService,
  mockReportService,
  mockLoggerService,
  mockStorageService
} = vi.hoisted(() => {
  return {
    mockUploadService: {
      validateUploadRequest: vi.fn(),
      trackValidationFailure: vi.fn(),
      trackValidationSuccess: vi.fn(),
      generateRequestId: vi.fn(),
      buildFileKey: vi.fn(),
      prepareFileMetadata: vi.fn(),
      trackUploadSuccess: vi.fn()
    },
    mockDatabaseService: {
      createAnalysisRequest: vi.fn()
    },
    mockRateLimiter: {
      checkLimit: vi.fn()
    },
    mockStatusService: {
      checkStatus: vi.fn()
    },
    mockReportService: {
      getReport: vi.fn()
    },
    mockLoggerService: {
      trackRateLimitCheck: vi.fn(),
      trackRateLimitExceeded: vi.fn(),
      trackFileUploadFailed: vi.fn(),
      error: vi.fn(),
      warn: vi.fn()
    },
    mockStorageService: {
      put: vi.fn(),
      get: vi.fn(),
      list: vi.fn(),
      search: vi.fn(),
      documentChat: vi.fn()
    }
  };
});

// Mock module imports
vi.mock('../services/UploadService', () => ({
  UploadService: vi.fn(() => mockUploadService)
}));

vi.mock('../services/DatabaseService', () => ({
  DatabaseService: vi.fn(() => mockDatabaseService)
}));

vi.mock('../services/StatusService', () => ({
  StatusService: vi.fn(() => mockStatusService)
}));

vi.mock('../services/ReportService', () => ({
  ReportService: vi.fn(() => mockReportService)
}));

vi.mock('../services/Logger/LoggerService', () => ({
  LoggerService: vi.fn(() => mockLoggerService)
}));

vi.mock('../services/StorageService', () => ({
  StorageService: vi.fn(() => mockStorageService)
}));

vi.mock('../shared/rate-limiter', () => ({
  RateLimiter: vi.fn(() => mockRateLimiter),
  getRateLimitHeaders: vi.fn(() => ({}))
}));

describe('Upload API', () => {
  let env: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock environment
    env = {
      POSTHOG_API_KEY: 'test-key',
      TRACKING_DB: {},
      INPUT_BUCKET: {
        put: vi.fn().mockResolvedValue({})
      },
      RATE_LIMIT_PER_USER: '10'
    };
  });

  describe('GET /health', () => {
    test('returns 200 OK', async () => {
      const worker = new Worker({} as any, env);
      const req = new Request('http://localhost/health');
      const res = await worker.fetch(req);

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.status).toBe('ok');
      expect(body.timestamp).toBeDefined();
    });
  });

  describe('POST /upload', () => {
    test('successfully uploads a file', async () => {
      // Setup successful mocks
      mockUploadService.validateUploadRequest.mockResolvedValue({ success: true });
      mockRateLimiter.checkLimit.mockResolvedValue({ allowed: true, remaining: 9, resetAt: Date.now() + 1000 });
      mockUploadService.generateRequestId.mockReturnValue('REQ123');
      mockUploadService.buildFileKey.mockReturnValue('user123/REQ123/test.csv');
      mockUploadService.prepareFileMetadata.mockReturnValue({});

      const formData = new FormData();
      formData.append('file', new File(['content'], 'test.csv', { type: 'text/csv' }));
      formData.append('userId', 'user123');

      const worker = new Worker({} as any, env);
      const req = new Request('http://localhost/upload', {
        method: 'POST',
        body: formData
      });
      const res = await worker.fetch(req);

      expect(res.status).toBe(201);
      const body = await res.json() as any;
      expect(body.requestId).toBe('REQ123');
      expect(body.status).toBe('processing');

      expect(mockUploadService.validateUploadRequest).toHaveBeenCalled();
      expect(mockStorageService.put).toHaveBeenCalled();
      expect(mockDatabaseService.createAnalysisRequest).toHaveBeenCalledWith('REQ123', 'user123', 'user123/REQ123/test.csv', 'processing');
      expect(mockUploadService.trackUploadSuccess).toHaveBeenCalled();
    });

    test('returns 400 on validation failure', async () => {
      mockUploadService.validateUploadRequest.mockResolvedValue({
        success: false,
        error: 'Invalid file',
        validationDetails: { reason: 'invalid_type' }
      });

      const formData = new FormData();
      formData.append('file', new File([''], 'test.exe'));
      formData.append('userId', 'user123');

      const worker = new Worker({} as any, env);
      const req = new Request('http://localhost/upload', { method: 'POST', body: formData });
      const res = await worker.fetch(req);

      expect(res.status).toBe(400);
      expect(mockUploadService.trackValidationFailure).toHaveBeenCalled();
    });

    test('returns 429 when rate limit exceeded', async () => {
      mockUploadService.validateUploadRequest.mockResolvedValue({ success: true });
      mockRateLimiter.checkLimit.mockResolvedValue({
        allowed: false,
        remaining: 0,
        resetAt: Date.now() + 1000,
        message: 'Limit exceeded'
      });

      const formData = new FormData();
      formData.append('file', new File([''], 'test.csv'));
      formData.append('userId', 'user123');

      const worker = new Worker({} as any, env);
      const req = new Request('http://localhost/upload', { method: 'POST', body: formData });
      const res = await worker.fetch(req);

      expect(res.status).toBe(429);
      expect(mockLoggerService.trackRateLimitExceeded).toHaveBeenCalled();
    });

    test('handles upload errors gracefully', async () => {
      mockUploadService.validateUploadRequest.mockResolvedValue({ success: true });
      mockRateLimiter.checkLimit.mockResolvedValue({ allowed: true });
      env.INPUT_BUCKET.put.mockRejectedValue(new Error('S3 Error'));

      const formData = new FormData();
      formData.append('file', new File([''], 'test.csv'));
      formData.append('userId', 'user123');

      const worker = new Worker({} as any, env);
      const req = new Request('http://localhost/upload', { method: 'POST', body: formData });
      const res = await worker.fetch(req);

      expect(res.status).toBe(500);
      expect(mockLoggerService.trackFileUploadFailed).toHaveBeenCalled();
    });
  });

  describe('GET /status/:requestId', () => {
    test('returns status when found', async () => {
      const mockStatus = {
        requestId: 'REQ123',
        status: 'processing',
        progress: 50,
        createdAt: Date.now()
      };
      mockStatusService.checkStatus.mockResolvedValue(mockStatus);

      const worker = new Worker({} as any, env);
      const req = new Request('http://localhost/status/REQ123');
      const res = await worker.fetch(req);

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.status).toBe('processing');
      expect(body.progress).toBe(50);
    });

    test('returns 404 when not found', async () => {
      mockStatusService.checkStatus.mockResolvedValue(null);

      const worker = new Worker({} as any, env);
      const req = new Request('http://localhost/status/REQ999');
      const res = await worker.fetch(req);

      expect(res.status).toBe(404);
    });

    test('returns status with error when timed out', async () => {
      const mockStatus = {
        requestId: 'REQ123',
        status: 'failed',
        timedOut: true,
        error: 'Timeout',
        message: 'Analysis timed out'
      };
      mockStatusService.checkStatus.mockResolvedValue(mockStatus);

      const worker = new Worker({} as any, env);
      const req = new Request('http://localhost/status/REQ123');
      const res = await worker.fetch(req);

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.status).toBe('failed');
      expect(body.error).toBe('Timeout');
    });

    test('handles internal errors', async () => {
      mockStatusService.checkStatus.mockRejectedValue(new Error('DB Error'));

      const worker = new Worker({} as any, env);
      const req = new Request('http://localhost/status/REQ123');
      const res = await worker.fetch(req);

      expect(res.status).toBe(500);
    });
  });

  describe('GET /reports/:requestId', () => {
    test('returns report when completed', async () => {
      mockReportService.getReport.mockResolvedValue({
        status: 'completed',
        requestId: 'REQ123',
        report: { some: 'data' },
        completedAt: Date.now()
      });

      const worker = new Worker({} as any, env);
      const req = new Request('http://localhost/reports/REQ123');
      const res = await worker.fetch(req);

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.report).toBeDefined();
    });

    test('returns 404 when not found', async () => {
      mockReportService.getReport.mockResolvedValue({
        status: 'not_found',
        requestId: 'REQ999',
        error: 'Report not found'
      });

      const worker = new Worker({} as any, env);
      const req = new Request('http://localhost/reports/REQ999');
      const res = await worker.fetch(req);

      expect(res.status).toBe(404);
    });

    test('returns status info when still processing', async () => {
      mockReportService.getReport.mockResolvedValue({
        status: 'processing',
        requestId: 'REQ123',
        message: 'Analysis in progress'
      });

      const worker = new Worker({} as any, env);
      const req = new Request('http://localhost/reports/REQ123');
      const res = await worker.fetch(req);

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.status).toBe('processing');
      expect(body.report).toBeUndefined();
    });

    test('returns error info when failed', async () => {
      mockReportService.getReport.mockResolvedValue({
        status: 'failed',
        requestId: 'REQ123',
        error: 'Analysis failed'
      });

      const worker = new Worker({} as any, env);
      const req = new Request('http://localhost/reports/REQ123');
      const res = await worker.fetch(req);

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.status).toBe('failed');
      expect(body.error).toBe('Analysis failed');
    });

    test('handles internal errors', async () => {
      mockReportService.getReport.mockRejectedValue(new Error('Service Error'));

      const worker = new Worker({} as any, env);
      const req = new Request('http://localhost/reports/REQ123');
      const res = await worker.fetch(req);

      expect(res.status).toBe(500);
    });
  });
});
