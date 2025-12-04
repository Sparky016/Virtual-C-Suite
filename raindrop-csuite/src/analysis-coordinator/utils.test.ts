import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildPrompt,
  getPromptTemplate,
  synthesize,
  buildPrompt,
  getPromptTemplate,
  synthesize,
  formatAnalysisForReport,
} from './utils';
import SambaNova from 'sambanova';

// Mock SambaNova
vi.mock('sambanova', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{
              message: {
                content: JSON.stringify({
                  consolidatedInsights: ['Insight'],
                  actionItems: ['Action']
                })
              }
            }]
          })
        }
      }
    }))
  };
});

describe('analysis-coordinator utils', () => {
  let mockEnv: any;

  beforeEach(() => {
    mockEnv = {
      SAMBANOVA_API_KEY: 'test-key',
      logger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
    };
  });

  describe('buildPrompt', () => {
    it('should build CFO prompt with financial focus', () => {
      const content = 'Board meeting about Q4 results';
      const prompt = buildPrompt(content, 'CFO');

      expect(prompt).toContain('financial');
      expect(prompt).toContain(content);
    });

    it('should build CMO prompt with marketing focus', () => {
      const content = 'Board meeting about customer acquisition';
      const prompt = buildPrompt(content, 'CMO');

      expect(prompt).toContain('marketing');
      expect(prompt).toContain(content);
    });

    it('should build COO prompt with operations focus', () => {
      const content = 'Board meeting about process improvements';
      const prompt = buildPrompt(content, 'COO');

      expect(prompt).toContain('operations');
      expect(prompt).toContain(content);
    });

    it('should request structured JSON output', () => {
      const content = 'Meeting content';
      const prompt = buildPrompt(content, 'CFO');

      expect(prompt).toContain('JSON');
      expect(prompt).toMatch(/keyInsights|key_insights/i);
      expect(prompt).toMatch(/recommendations/i);
    });

    it('should handle empty content', () => {
      const content = '';

      expect(() => buildPrompt(content, 'CFO')).toThrow();
    });

    it('should throw error for invalid role', () => {
      const content = 'Meeting content';
      const invalidRole = 'CEO' as any;

      expect(() => buildPrompt(content, invalidRole)).toThrow();
    });
  });

  describe('getPromptTemplate', () => {
    it('should return CFO template', () => {
      const template = getPromptTemplate('CFO');

      expect(template).toHaveProperty('role');
      expect(template).toHaveProperty('context');
      expect(template).toHaveProperty('instructions');
      expect(template.role).toBe('CFO');
    });

    it('should return CMO template', () => {
      const template = getPromptTemplate('CMO');

      expect(template.role).toBe('CMO');
      expect(template.context).toContain('marketing');
    });

    it('should return COO template', () => {
      const template = getPromptTemplate('COO');

      expect(template.role).toBe('COO');
      expect(template.context).toContain('operations');
    });

    it('should include analysis instructions', () => {
      const template = getPromptTemplate('CFO');

      expect(Array.isArray(template.instructions)).toBe(true);
      expect(template.instructions.length).toBeGreaterThan(0);
    });
  });

  describe('synthesize', () => {
    it('should combine insights from multiple analyses', async () => {
      const analyses = [
        {
          role: 'CFO' as const,
          analysis: 'Financial analysis',
          keyInsights: ['Revenue up 20%', 'Costs controlled'],
          recommendations: ['Continue current strategy'],
        },
        {
          role: 'CMO' as const,
          analysis: 'Marketing analysis',
          keyInsights: ['Customer acquisition improving'],
          recommendations: ['Increase ad spend'],
        },
      ];

      const result = await synthesize(analyses, mockEnv);

      expect(result).toHaveProperty('consolidatedInsights');
      expect(result).toHaveProperty('actionItems');
      expect(Array.isArray(result.consolidatedInsights)).toBe(true);
      expect(Array.isArray(result.actionItems)).toBe(true);
    });

    // Should call SambaNova
    expect(SambaNova).toHaveBeenCalled();
  });

  it('should handle empty analyses', async () => {
    const analyses: any[] = [];

    await expect(synthesize(analyses, mockEnv)).rejects.toThrow();
  });

  it('should log synthesis steps', async () => {
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
});



describe('formatAnalysisForReport', () => {
  it('should format analysis with all fields', () => {
    const analysis = {
      role: 'CFO' as const,
      analysis: 'Detailed financial analysis',
      keyInsights: ['Insight 1', 'Insight 2'],
      recommendations: ['Rec 1', 'Rec 2'],
    };

    const formatted = formatAnalysisForReport(analysis);

    expect(formatted).toContain('CFO');
    expect(formatted).toContain('Detailed financial analysis');
    expect(formatted).toContain('Insight 1');
    expect(formatted).toContain('Rec 1');
  });

  it('should handle analyses with empty arrays', () => {
    const analysis = {
      role: 'CMO' as const,
      analysis: 'Brief analysis',
      keyInsights: [],
      recommendations: [],
    };

    const formatted = formatAnalysisForReport(analysis);

    expect(formatted).toContain('CMO');
    expect(formatted).toContain('Brief analysis');
  });

  it('should return markdown formatted string', () => {
    const analysis = {
      role: 'COO' as const,
      analysis: 'Operations analysis',
      keyInsights: ['Insight'],
      recommendations: ['Recommendation'],
    };

    const formatted = formatAnalysisForReport(analysis);

    // Should contain markdown formatting
    expect(formatted).toMatch(/#{1,3}/); // Headers
  });
});
});
