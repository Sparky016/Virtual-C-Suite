import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleBucketEvent } from './index';

describe('board-meeting-processor', () => {
  let mockEnv: any;

  beforeEach(() => {
    mockEnv = {
      INPUT_BUCKET: {
        get: vi.fn().mockResolvedValue({
          text: () => Promise.resolve('Board meeting transcript content'),
        }),
      },
      OUTPUT_BUCKET: {
        put: vi.fn().mockResolvedValue(undefined),
      },
      ANALYSIS_DB: {
        execute: vi.fn().mockResolvedValue({ results: [] }),
      },
      ANALYSIS_COORDINATOR: {
        buildPrompt: vi.fn().mockReturnValue('Built prompt'),
        synthesize: vi.fn().mockResolvedValue({
          consolidatedInsights: ['insight1'],
          actionItems: ['action1'],
        }),
      },
      AI: {
        run: vi.fn().mockResolvedValue({
          choices: [{ message: { content: JSON.stringify({ analysis: 'test', keyInsights: [], recommendations: [] }) } }],
        }),
      },
      logger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
    };
  });

  describe('bucket event handler', () => {
    it('should process new file upload event', async () => {
      const event = {
        key: 'uploads/req-123/file.pdf',
        size: 1024,
        contentType: 'application/pdf',
      };

      await handleBucketEvent(event, mockEnv);
      expect(mockEnv.logger.info).toHaveBeenCalled();
    });

    it('should fetch file content from input bucket', async () => {
      const event = {
        key: 'uploads/req-123/file.pdf',
        size: 1024,
        contentType: 'application/pdf',
      };

      await handleBucketEvent(event, mockEnv);
      expect(mockEnv.INPUT_BUCKET.get).toHaveBeenCalledWith('uploads/req-123/file.pdf');
    });

    it('should trigger parallel AI analyses for CFO, CMO, COO', async () => {
      const event = {
        key: 'uploads/req-123/file.pdf',
        size: 1024,
        contentType: 'application/pdf',
      };

      await handleBucketEvent(event, mockEnv);
      expect(mockEnv.AI.run).toHaveBeenCalledTimes(3);
    });

    it('should use analysis-coordinator to build prompts', async () => {
      const event = {
        key: 'uploads/req-123/file.pdf',
        size: 1024,
        contentType: 'application/pdf',
      };

      await handleBucketEvent(event, mockEnv);
      expect(mockEnv.ANALYSIS_COORDINATOR.buildPrompt).toHaveBeenCalled();
    });

    it('should synthesize analyses into final report', async () => {
      const event = {
        key: 'uploads/req-123/file.pdf',
        size: 1024,
        contentType: 'application/pdf',
      };

      await handleBucketEvent(event, mockEnv);
      expect(mockEnv.ANALYSIS_COORDINATOR.synthesize).toHaveBeenCalled();
    });

    it('should save final report to output bucket', async () => {
      const event = {
        key: 'uploads/req-123/file.pdf',
        size: 1024,
        contentType: 'application/pdf',
      };

      await handleBucketEvent(event, mockEnv);
      expect(mockEnv.OUTPUT_BUCKET.put).toHaveBeenCalled();
    });

    it('should update database with processing status', async () => {
      const event = {
        key: 'uploads/req-123/file.pdf',
        size: 1024,
        contentType: 'application/pdf',
      };

      await handleBucketEvent(event, mockEnv);
      expect(mockEnv.ANALYSIS_DB.execute).toHaveBeenCalled();
    });

    it('should update database with completed status', async () => {
      const event = {
        key: 'uploads/req-123/file.pdf',
        size: 1024,
        contentType: 'application/pdf',
      };

      await handleBucketEvent(event, mockEnv);
      const calls = mockEnv.ANALYSIS_DB.execute.mock.calls;
      const hasFinalUpdate = calls.some((call: any[]) =>
        call[0]?.includes('UPDATE') && call[1]?.includes('req-123')
      );
      expect(hasFinalUpdate).toBe(true);
    });

    it('should save individual executive analyses to database', async () => {
      const event = {
        key: 'uploads/req-123/file.pdf',
        size: 1024,
        contentType: 'application/pdf',
      };

      await handleBucketEvent(event, mockEnv);
      const insertCalls = mockEnv.ANALYSIS_DB.execute.mock.calls.filter(
        (call: any[]) => call[0]?.includes('INSERT INTO executive_analyses')
      );
      expect(insertCalls.length).toBe(3);
    });

    it('should log all processing steps', async () => {
      const event = {
        key: 'uploads/req-123/file.pdf',
        size: 1024,
        contentType: 'application/pdf',
      };

      await handleBucketEvent(event, mockEnv);
      expect(mockEnv.logger.info).toHaveBeenCalled();
    });

    it('should handle AI service errors gracefully', async () => {
      mockEnv.AI.run = vi.fn().mockRejectedValue(new Error('AI service unavailable'));

      const event = {
        key: 'uploads/req-123/file.pdf',
        size: 1024,
        contentType: 'application/pdf',
      };

      await expect(handleBucketEvent(event, mockEnv)).rejects.toThrow();
      expect(mockEnv.logger.error).toHaveBeenCalled();
    });

    it('should handle bucket read errors gracefully', async () => {
      mockEnv.INPUT_BUCKET.get = vi.fn().mockRejectedValue(new Error('Bucket error'));

      const event = {
        key: 'uploads/req-123/file.pdf',
        size: 1024,
        contentType: 'application/pdf',
      };

      await expect(handleBucketEvent(event, mockEnv)).rejects.toThrow();
      expect(mockEnv.logger.error).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle parallel analysis failures', async () => {
      mockEnv.AI.run = vi
        .fn()
        .mockResolvedValueOnce({ choices: [{ message: { content: JSON.stringify({ analysis: 'test', keyInsights: [], recommendations: [] }) } }] })
        .mockRejectedValueOnce(new Error('CMO analysis failed'))
        .mockResolvedValueOnce({ choices: [{ message: { content: JSON.stringify({ analysis: 'test', keyInsights: [], recommendations: [] }) } }] });

      const event = {
        key: 'uploads/req-123/file.pdf',
        size: 1024,
        contentType: 'application/pdf',
      };

      await expect(handleBucketEvent(event, mockEnv)).rejects.toThrow();
      expect(mockEnv.logger.error).toHaveBeenCalled();
    });

    it('should handle synthesis errors', async () => {
      mockEnv.ANALYSIS_COORDINATOR.synthesize = vi.fn().mockRejectedValue(
        new Error('Synthesis failed')
      );

      const event = {
        key: 'uploads/req-123/file.pdf',
        size: 1024,
        contentType: 'application/pdf',
      };

      await expect(handleBucketEvent(event, mockEnv)).rejects.toThrow();
      expect(mockEnv.logger.error).toHaveBeenCalled();
    });
  });
});
