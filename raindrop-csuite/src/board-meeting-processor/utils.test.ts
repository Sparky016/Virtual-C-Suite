import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  extractRequestIdFromKey,
  fetchFileContent,
  runParallelAnalyses,
  updateAnalysisStatus,
  saveReportToOutputBucket,
  saveExecutiveAnalyses,
  saveFinalReport,
} from './utils';

describe('board-meeting-processor utils', () => {
  let mockEnv: any;

  beforeEach(() => {
    mockEnv = {
      INPUT_BUCKET: {
        get: vi.fn().mockResolvedValue({
          text: () => Promise.resolve('File content'),
        }),
      },
      OUTPUT_BUCKET: {
        put: vi.fn().mockResolvedValue(undefined),
      },
      ANALYSIS_DB: {
        execute: vi.fn().mockResolvedValue({ results: [] }),
      },
      ANALYSIS_COORDINATOR: {
        buildPrompt: vi.fn().mockReturnValue('Prompt'),
        synthesize: vi.fn(),
      },
      AI: {
        run: vi.fn().mockResolvedValue({
          choices: [{ message: { content: 'Analysis' } }],
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

  describe('extractRequestIdFromKey', () => {
    it('should extract request ID from bucket key', async () => {
      const key = 'uploads/req-123/file.pdf';
      const requestId = await extractRequestIdFromKey(key);

      expect(requestId).toBe('req-123');
    });

    it('should handle different key formats', async () => {
      const key = 'uploads/req-456/subfolder/document.pdf';
      const requestId = await extractRequestIdFromKey(key);

      expect(requestId).toBe('req-456');
    });

    it('should throw error for invalid key format', async () => {
      const key = 'invalid/key/format';

      await expect(extractRequestIdFromKey(key)).rejects.toThrow();
    });
  });

  describe('fetchFileContent', () => {
    it('should fetch file content from bucket', async () => {
      const key = 'uploads/req-123/file.pdf';
      const content = await fetchFileContent(key, mockEnv);

      expect(mockEnv.INPUT_BUCKET.get).toHaveBeenCalledWith(key);
      expect(content).toBe('File content');
    });

    it('should throw error if file not found', async () => {
      mockEnv.INPUT_BUCKET.get = vi.fn().mockResolvedValue(null);
      const key = 'uploads/missing/file.pdf';

      await expect(fetchFileContent(key, mockEnv)).rejects.toThrow();
    });

    it('should log fetch operation', async () => {
      const key = 'uploads/req-123/file.pdf';
      await fetchFileContent(key, mockEnv);

      expect(mockEnv.logger.debug).toHaveBeenCalled();
    });
  });

  describe('runParallelAnalyses', () => {
    it('should run analyses for all three executives in parallel', async () => {
      const content = 'Board meeting transcript';
      const analyses = await runParallelAnalyses(content, mockEnv);

      expect(analyses.length).toBe(3);
      expect(analyses).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ role: 'CFO' }),
          expect.objectContaining({ role: 'CMO' }),
          expect.objectContaining({ role: 'COO' }),
        ])
      );
    });

    it('should use analysis-coordinator to build prompts', async () => {
      const content = 'Board meeting transcript';
      await runParallelAnalyses(content, mockEnv);

      expect(mockEnv.ANALYSIS_COORDINATOR.buildPrompt).toHaveBeenCalledTimes(3);
      expect(mockEnv.ANALYSIS_COORDINATOR.buildPrompt).toHaveBeenCalledWith(content, 'CFO');
      expect(mockEnv.ANALYSIS_COORDINATOR.buildPrompt).toHaveBeenCalledWith(content, 'CMO');
      expect(mockEnv.ANALYSIS_COORDINATOR.buildPrompt).toHaveBeenCalledWith(content, 'COO');
    });

    it('should call AI service for each executive', async () => {
      const content = 'Board meeting transcript';
      await runParallelAnalyses(content, mockEnv);

      expect(mockEnv.AI.run).toHaveBeenCalledTimes(3);
    });

    it('should parse AI responses into structured analyses', async () => {
      mockEnv.AI.run = vi.fn().mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              analysis: 'Detailed analysis',
              keyInsights: ['insight1', 'insight2'],
              recommendations: ['rec1', 'rec2'],
            }),
          },
        }],
      });

      const content = 'Board meeting transcript';
      const analyses = await runParallelAnalyses(content, mockEnv);

      expect(analyses[0]).toHaveProperty('analysis');
      expect(analyses[0]).toHaveProperty('keyInsights');
      expect(analyses[0]).toHaveProperty('recommendations');
    });

    it('should handle AI service errors', async () => {
      mockEnv.AI.run = vi.fn().mockRejectedValue(new Error('AI error'));
      const content = 'Board meeting transcript';

      await expect(runParallelAnalyses(content, mockEnv)).rejects.toThrow();
    });

    it('should log parallel execution', async () => {
      const content = 'Board meeting transcript';
      await runParallelAnalyses(content, mockEnv);

      expect(mockEnv.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('parallel'),
        expect.any(Object)
      );
    });
  });

  describe('updateAnalysisStatus', () => {
    it('should update request status in database', async () => {
      await updateAnalysisStatus('req-123', 'processing', mockEnv);

      expect(mockEnv.ANALYSIS_DB.execute).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE'),
        expect.arrayContaining(['processing', 'req-123'])
      );
    });

    it('should support all status values', async () => {
      const statuses = ['pending', 'processing', 'completed', 'failed'];

      for (const status of statuses) {
        await updateAnalysisStatus('req-123', status, mockEnv);
      }

      expect(mockEnv.ANALYSIS_DB.execute).toHaveBeenCalledTimes(statuses.length);
    });

    it('should log status updates', async () => {
      await updateAnalysisStatus('req-123', 'completed', mockEnv);

      expect(mockEnv.logger.debug).toHaveBeenCalled();
    });
  });

  describe('saveReportToOutputBucket', () => {
    it('should save synthesized report to output bucket', async () => {
      const report = {
        requestId: 'req-123',
        executiveAnalyses: [],
        consolidatedInsights: ['insight'],
        actionItems: ['action'],
        timestamp: '2025-01-01T00:00:00Z',
      };

      const url = await saveReportToOutputBucket(report, mockEnv);

      expect(mockEnv.OUTPUT_BUCKET.put).toHaveBeenCalled();
      expect(url).toContain('req-123');
    });

    it('should serialize report as JSON', async () => {
      const report = {
        requestId: 'req-123',
        executiveAnalyses: [],
        consolidatedInsights: [],
        actionItems: [],
        timestamp: '2025-01-01T00:00:00Z',
      };

      await saveReportToOutputBucket(report, mockEnv);

      expect(mockEnv.OUTPUT_BUCKET.put).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('requestId')
      );
    });

    it('should use correct key format', async () => {
      const report = {
        requestId: 'req-123',
        executiveAnalyses: [],
        consolidatedInsights: [],
        actionItems: [],
        timestamp: '2025-01-01T00:00:00Z',
      };

      await saveReportToOutputBucket(report, mockEnv);

      expect(mockEnv.OUTPUT_BUCKET.put).toHaveBeenCalledWith(
        expect.stringMatching(/^reports\/req-123/),
        expect.any(String)
      );
    });

    it('should log save operation', async () => {
      const report = {
        requestId: 'req-123',
        executiveAnalyses: [],
        consolidatedInsights: [],
        actionItems: [],
        timestamp: '2025-01-01T00:00:00Z',
      };

      await saveReportToOutputBucket(report, mockEnv);

      expect(mockEnv.logger.info).toHaveBeenCalled();
    });
  });

  describe('saveExecutiveAnalyses', () => {
    it('should save all executive analyses to database', async () => {
      const analyses = [
        { role: 'CFO' as const, analysis: 'CFO analysis', keyInsights: [], recommendations: [] },
        { role: 'CMO' as const, analysis: 'CMO analysis', keyInsights: [], recommendations: [] },
        { role: 'COO' as const, analysis: 'COO analysis', keyInsights: [], recommendations: [] },
      ];

      await saveExecutiveAnalyses('req-123', analyses, mockEnv);

      expect(mockEnv.ANALYSIS_DB.execute).toHaveBeenCalledTimes(3);
    });

    it('should include all analysis fields in insert', async () => {
      const analyses = [
        {
          role: 'CFO' as const,
          analysis: 'Financial analysis',
          keyInsights: ['insight1'],
          recommendations: ['rec1'],
        },
      ];

      await saveExecutiveAnalyses('req-123', analyses, mockEnv);

      expect(mockEnv.ANALYSIS_DB.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT'),
        expect.arrayContaining(['req-123', 'CFO', expect.any(String)])
      );
    });
  });

  describe('saveFinalReport', () => {
    it('should update request with final report URL', async () => {
      await saveFinalReport('req-123', 'reports/req-123.json', mockEnv);

      expect(mockEnv.ANALYSIS_DB.execute).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE'),
        expect.arrayContaining(['reports/req-123.json', 'req-123'])
      );
    });

    it('should set status to completed', async () => {
      await saveFinalReport('req-123', 'reports/req-123.json', mockEnv);

      expect(mockEnv.ANALYSIS_DB.execute).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE'),
        expect.arrayContaining(['completed'])
      );
    });
  });
});
