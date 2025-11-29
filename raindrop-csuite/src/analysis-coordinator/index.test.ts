import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildPrompt, synthesize } from './index';

describe('analysis-coordinator', () => {
  let mockEnv: any;

  beforeEach(() => {
    mockEnv = {
      AI: {
        run: vi.fn().mockResolvedValue({
          choices: [{ message: { content: 'AI response' } }],
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

  describe('service exports', () => {
    it('should export buildPrompt function', () => {
      expect(buildPrompt).toBeDefined();
      expect(typeof buildPrompt).toBe('function');
    });

    it('should export synthesize function', () => {
      expect(synthesize).toBeDefined();
      expect(typeof synthesize).toBe('function');
    });

    it('should be callable from other services via env bindings', () => {
      // Service should export both functions
      expect(buildPrompt).toBeDefined();
      expect(synthesize).toBeDefined();
    });
  });

  describe('buildPrompt', () => {
    it('should build CFO-specific analysis prompt', () => {
      const content = 'Board meeting transcript';
      const prompt = buildPrompt(content, 'CFO');
      expect(prompt).toContain('CFO');
      expect(prompt).toContain('financial');
    });

    it('should build CMO-specific analysis prompt', () => {
      const content = 'Board meeting transcript';
      const prompt = buildPrompt(content, 'CMO');
      expect(prompt).toContain('CMO');
      expect(prompt).toContain('marketing');
    });

    it('should build COO-specific analysis prompt', () => {
      const content = 'Board meeting transcript';
      const prompt = buildPrompt(content, 'COO');
      expect(prompt).toContain('COO');
      expect(prompt).toContain('operations');
    });

    it('should include meeting content in prompt', () => {
      const content = 'Board meeting transcript with specific details';
      const prompt = buildPrompt(content, 'CFO');
      expect(prompt).toContain(content);
    });

    it('should include structured output instructions', () => {
      const content = 'Board meeting transcript';
      const prompt = buildPrompt(content, 'CFO');
      expect(prompt).toContain('JSON');
      expect(prompt).toContain('analysis');
      expect(prompt).toContain('keyInsights');
      expect(prompt).toContain('recommendations');
    });
  });

  describe('synthesize', () => {
    it('should consolidate insights from multiple analyses', async () => {
      const analyses = [
        {
          role: 'CFO' as const,
          analysis: 'Financial analysis',
          keyInsights: ['Financial insight 1', 'Financial insight 2'],
          recommendations: ['Financial rec'],
        },
        {
          role: 'CMO' as const,
          analysis: 'Marketing analysis',
          keyInsights: ['Marketing insight 1'],
          recommendations: ['Marketing rec'],
        },
        {
          role: 'COO' as const,
          analysis: 'Operations analysis',
          keyInsights: ['Operations insight 1'],
          recommendations: ['Operations rec'],
        },
      ];

      const result = await synthesize(analyses, mockEnv);
      expect(result.consolidatedInsights).toHaveLength(4);
      expect(result.actionItems).toHaveLength(3);
    });

    it('should deduplicate similar insights', async () => {
      const analyses = [
        {
          role: 'CFO' as const,
          analysis: 'Analysis',
          keyInsights: ['Revenue growth is critical', 'Focus on revenue'],
          recommendations: [],
        },
        {
          role: 'CMO' as const,
          analysis: 'Analysis',
          keyInsights: ['Revenue growth is critical'],
          recommendations: [],
        },
      ];

      const result = await synthesize(analyses, mockEnv);
      expect(result.consolidatedInsights).toHaveLength(2);
    });

    it('should prioritize action items across perspectives', async () => {
      const analyses = [
        {
          role: 'CFO' as const,
          analysis: 'Analysis',
          keyInsights: [],
          recommendations: ['Reduce costs', 'Increase efficiency'],
        },
        {
          role: 'CMO' as const,
          analysis: 'Analysis',
          keyInsights: [],
          recommendations: ['Launch campaign', 'Increase efficiency'],
        },
        {
          role: 'COO' as const,
          analysis: 'Analysis',
          keyInsights: [],
          recommendations: ['Streamline processes', 'Increase efficiency'],
        },
      ];

      const result = await synthesize(analyses, mockEnv);
      expect(result.actionItems[0]).toBe('Increase efficiency');
    });

    it('should return structured synthesis result', async () => {
      const analyses = [
        {
          role: 'CFO' as const,
          analysis: 'Analysis',
          keyInsights: ['insight'],
          recommendations: ['rec'],
        },
      ];

      const result = await synthesize(analyses, mockEnv);
      expect(result).toHaveProperty('consolidatedInsights');
      expect(result).toHaveProperty('actionItems');
    });

    it('should handle empty analyses array', async () => {
      const analyses: any[] = [];

      await expect(synthesize(analyses, mockEnv)).rejects.toThrow('Cannot synthesize empty analyses array');
    });

    it('should log synthesis process', async () => {
      const analyses = [
        {
          role: 'CFO' as const,
          analysis: 'Analysis',
          keyInsights: ['insight'],
          recommendations: ['rec'],
        },
      ];

      await synthesize(analyses, mockEnv);
      expect(mockEnv.logger.info).toHaveBeenCalled();
    });

    it('should use AI for intelligent synthesis', async () => {
      const analyses = [
        {
          role: 'CFO' as const,
          analysis: 'Financial analysis',
          keyInsights: ['insight1'],
          recommendations: ['rec1'],
        },
        {
          role: 'CMO' as const,
          analysis: 'Marketing analysis',
          keyInsights: ['insight2'],
          recommendations: ['rec2'],
        },
      ];

      const result = await synthesize(analyses, mockEnv);
      expect(result).toBeDefined();
      expect(result.consolidatedInsights).toContain('insight1');
      expect(result.consolidatedInsights).toContain('insight2');
    });
  });

  describe('error handling', () => {
    it('should handle invalid role in buildPrompt', () => {
      const content = 'Content';
      const invalidRole = 'CEO' as any;

      expect(() => {
        buildPrompt(content, invalidRole);
      }).toThrow('Invalid role');
    });

    it('should handle malformed analysis data', async () => {
      const analyses = [
        {
          role: 'CFO' as const,
          analysis: 'Test',
          keyInsights: [],
          recommendations: [],
        },
      ];

      const result = await synthesize(analyses, mockEnv);
      expect(result).toBeDefined();
    });
  });
});
