import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  validateUploadRequest,
  storeFileToInputBucket,
  createAnalysisRequest,
  getRequestStatus,
  getReport,
  generateRequestId
} from './utils';

describe('upload-api utils', () => {
  let mockEnv: any;

  beforeEach(() => {
    mockEnv = {
      INPUT_BUCKET: {
        put: vi.fn().mockResolvedValue(undefined),
      },
      OUTPUT_BUCKET: {
        get: vi.fn().mockResolvedValue(null),
      },
      ANALYSIS_DB: {
        execute: vi.fn().mockResolvedValue({ results: [] }),
      },
      logger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
    };
  });

  describe('validateUploadRequest', () => {
    it('should validate PDF file upload', async () => {
      const formData = new FormData();
      const blob = new Blob(['test'], { type: 'application/pdf' });
      formData.append('file', blob, 'test.pdf');

      const req = new Request('http://localhost/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await validateUploadRequest(req, mockEnv);
      expect(result.valid).toBe(true);
    });

    it('should reject non-PDF files', async () => {
      const formData = new FormData();
      const blob = new Blob(['test'], { type: 'text/plain' });
      formData.append('file', blob, 'test.txt');

      const req = new Request('http://localhost/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await validateUploadRequest(req, mockEnv);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid file format');
    });

    it('should reject requests with no file', async () => {
      const req = new Request('http://localhost/upload', {
        method: 'POST',
        body: new FormData(),
      });

      const result = await validateUploadRequest(req, mockEnv);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('No file');
    });

    it('should reject files exceeding size limit', async () => {
      const largeContent = new Array(11 * 1024 * 1024).fill('a').join('');
      const blob = new Blob([largeContent], { type: 'application/pdf' });
      const formData = new FormData();
      formData.append('file', blob, 'large.pdf');

      const req = new Request('http://localhost/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await validateUploadRequest(req, mockEnv);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('size');
    });
  });

  describe('storeFileToInputBucket', () => {
    it('should store file with correct key', async () => {
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });
      const requestId = 'req-123';

      await storeFileToInputBucket(file, requestId, mockEnv);

      expect(mockEnv.INPUT_BUCKET.put).toHaveBeenCalledWith(
        expect.stringContaining(requestId),
        expect.any(File)
      );
    });

    it('should throw error if bucket operation fails', async () => {
      mockEnv.INPUT_BUCKET.put = vi.fn().mockRejectedValue(new Error('Bucket error'));
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });

      await expect(storeFileToInputBucket(file, 'req-123', mockEnv)).rejects.toThrow();
    });
  });

  describe('createAnalysisRequest', () => {
    it('should insert new analysis request record', async () => {
      await createAnalysisRequest('req-123', 'test.pdf', mockEnv);

      expect(mockEnv.ANALYSIS_DB.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT'),
        expect.arrayContaining(['req-123', 'test.pdf'])
      );
    });

    it('should set initial status to pending', async () => {
      await createAnalysisRequest('req-123', 'test.pdf', mockEnv);

      expect(mockEnv.ANALYSIS_DB.execute).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([expect.stringContaining('pending')])
      );
    });
  });

  describe('getRequestStatus', () => {
    it('should return status for existing request', async () => {
      mockEnv.ANALYSIS_DB.execute = vi.fn().mockResolvedValue({
        results: [{ request_id: 'req-123', status: 'processing' }],
      });

      const status = await getRequestStatus('req-123', mockEnv);

      expect(status.requestId).toBe('req-123');
      expect(status.status).toBe('processing');
    });

    it('should throw error for non-existent request', async () => {
      mockEnv.ANALYSIS_DB.execute = vi.fn().mockResolvedValue({
        results: [],
      });

      await expect(getRequestStatus('invalid', mockEnv)).rejects.toThrow();
    });
  });

  describe('getReport', () => {
    it('should return report for completed analysis', async () => {
      mockEnv.ANALYSIS_DB.execute = vi.fn().mockResolvedValue({
        results: [{
          request_id: 'req-123',
          status: 'completed',
          report_url: 'reports/req-123.json'
        }],
      });

      mockEnv.OUTPUT_BUCKET.get = vi.fn().mockResolvedValue({
        text: () => Promise.resolve('{"analysis": "data"}'),
      });

      const report = await getReport('req-123', mockEnv);

      expect(report.requestId).toBe('req-123');
      expect(report.status).toBe('completed');
      expect(report.report).toBeDefined();
    });

    it('should return pending status when not complete', async () => {
      mockEnv.ANALYSIS_DB.execute = vi.fn().mockResolvedValue({
        results: [{ request_id: 'req-123', status: 'processing' }],
      });

      const report = await getReport('req-123', mockEnv);

      expect(report.status).toBe('processing');
      expect(report.report).toBeUndefined();
    });
  });

  describe('generateRequestId', () => {
    it('should generate unique request ID', () => {
      const id1 = generateRequestId();
      const id2 = generateRequestId();

      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id1).not.toBe(id2);
    });

    it('should generate ID with expected format', () => {
      const id = generateRequestId();

      expect(id).toMatch(/^req-/);
      expect(id.length).toBeGreaterThan(10);
    });
  });
});
