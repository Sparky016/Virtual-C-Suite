import { describe, it, expect, vi, beforeEach } from 'vitest';
import app from './index';

describe('upload-api', () => {
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

  describe('POST /upload', () => {
    it('should accept valid PDF file upload and return requestId', async () => {
      const formData = new FormData();
      const blob = new Blob(['test content'], { type: 'application/pdf' });
      formData.append('file', blob, 'test.pdf');

      const req = new Request('http://localhost/upload', {
        method: 'POST',
        body: formData,
      });

      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty('requestId');
      expect(data).toHaveProperty('message');
      expect(mockEnv.logger.info).toHaveBeenCalled();
    });

    it('should reject file upload with invalid content type', async () => {
      const formData = new FormData();
      const blob = new Blob(['test content'], { type: 'text/plain' });
      formData.append('file', blob, 'test.txt');

      const req = new Request('http://localhost/upload', {
        method: 'POST',
        body: formData,
      });

      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(400);
      expect(mockEnv.logger.warn).toHaveBeenCalled();
    });

    it('should reject request with no file', async () => {
      const req = new Request('http://localhost/upload', {
        method: 'POST',
        body: new FormData(),
      });

      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(400);
    });

    it('should handle file storage errors gracefully', async () => {
      mockEnv.INPUT_BUCKET.put = vi.fn().mockRejectedValue(new Error('Storage error'));

      const formData = new FormData();
      const blob = new Blob(['test content'], { type: 'application/pdf' });
      formData.append('file', blob, 'test.pdf');

      const req = new Request('http://localhost/upload', {
        method: 'POST',
        body: formData,
      });

      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(500);
      expect(mockEnv.logger.error).toHaveBeenCalled();
    });
  });

  describe('GET /status/:requestId', () => {
    it('should return status for valid requestId', async () => {
      mockEnv.ANALYSIS_DB.execute = vi.fn().mockResolvedValue({
        results: [{ status: 'processing' }],
      });

      const req = new Request('http://localhost/status/test-123', {
        method: 'GET',
      });

      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty('requestId', 'test-123');
      expect(data).toHaveProperty('status');
    });

    it('should return 404 for non-existent requestId', async () => {
      mockEnv.ANALYSIS_DB.execute = vi.fn().mockResolvedValue({
        results: [],
      });

      const req = new Request('http://localhost/status/invalid-id', {
        method: 'GET',
      });

      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(404);
    });
  });

  describe('GET /reports/:requestId', () => {
    it('should return report for completed analysis', async () => {
      mockEnv.ANALYSIS_DB.execute = vi.fn().mockResolvedValue({
        results: [{ status: 'completed', report_url: 'reports/test-123.json' }],
      });

      mockEnv.OUTPUT_BUCKET.get = vi.fn().mockResolvedValue({
        text: () => Promise.resolve('{"analysis": "report data"}'),
      });

      const req = new Request('http://localhost/reports/test-123', {
        method: 'GET',
      });

      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(200);
      const data: any = await res.json();
      expect(data).toHaveProperty('requestId', 'test-123');
      expect(data).toHaveProperty('report');
      expect(data.status).toBe('completed');
    });

    it('should return 404 for non-existent report', async () => {
      mockEnv.ANALYSIS_DB.execute = vi.fn().mockResolvedValue({
        results: [],
      });

      const req = new Request('http://localhost/reports/invalid-id', {
        method: 'GET',
      });

      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(404);
    });

    it('should return pending status when analysis not complete', async () => {
      mockEnv.ANALYSIS_DB.execute = vi.fn().mockResolvedValue({
        results: [{ status: 'processing' }],
      });

      const req = new Request('http://localhost/reports/test-123', {
        method: 'GET',
      });

      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(200);
      const data: any = await res.json();
      expect(data.status).toBe('processing');
      expect(data.report).toBeUndefined();
    });
  });

  describe('CORS headers', () => {
    it('should include CORS headers in all responses', async () => {
      const req = new Request('http://localhost/status/test-123', {
        method: 'OPTIONS',
      });

      const res = await app.fetch(req, mockEnv);

      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(res.headers.get('Access-Control-Allow-Methods')).toContain('GET');
      expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST');
      expect(res.headers.get('Access-Control-Allow-Headers')).toContain('Content-Type');
    });
  });
});
