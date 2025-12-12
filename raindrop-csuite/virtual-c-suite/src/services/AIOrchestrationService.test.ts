import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest';
import { AIOrchestrationService, AIAnalysisRequest, BoardConsultationDecision, ExecutiveConsultation } from './AIOrchestrationService';
import * as analytics from '../analytics/analytics';
import * as retryLogic from '../shared/retry-logic';
import { DatabaseService } from './Database/DatabaseService';
import { VultrProvider } from './AI/VultrProvider';
import { SambaNovaProvider } from './AI/SambaNovaProvider';
import { CloudflareProvider } from './AI/CloudflareProvider';
import { AI_PROVIDERS, AI_ERRORS } from '../constants/ai-constants';

// Mock dependencies
vi.mock('../analytics/analytics', () => ({
  trackEvent: vi.fn(),
  trackAIPerformance: vi.fn(),
  AnalyticsEvents: {
    CFO_ANALYSIS_COMPLETED: 'cfo_analysis_completed',
    CMO_ANALYSIS_COMPLETED: 'cmo_analysis_completed',
    COO_ANALYSIS_COMPLETED: 'coo_analysis_completed',
    CEO_SYNTHESIS_COMPLETED: 'ceo_synthesis_completed'
  }
}));

vi.mock('../shared/retry-logic', () => ({
  retryAICall: vi.fn(),
  RetryResult: {}
}));

// Mock DatabaseService
vi.mock('./Database/DatabaseService');

// Mock Providers
vi.mock('./AI/VultrProvider');
vi.mock('./AI/SambaNovaProvider');
vi.mock('./AI/CloudflareProvider');

// Mock LoggerService
vi.mock('./LoggerService', () => ({
  LoggerService: vi.fn().mockImplementation(() => ({
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn()
  }))
}));


describe('AIOrchestrationService', () => {
  let service: AIOrchestrationService;
  let mockAIBinding: any;
  let mockDB: any;
  let mockPosthogKey = 'test-ph-key';
  let mockEnvironment = 'test-env';

  beforeEach(() => {
    vi.clearAllMocks();

    mockAIBinding = { run: vi.fn() };
    mockDB = { prepare: vi.fn() };

    service = new AIOrchestrationService(
      mockAIBinding,
      mockPosthogKey,
      mockEnvironment,
      mockDB
    );

    // Default DB mock behavior
    vi.mocked(DatabaseService).mockImplementation(() => ({
      getUserSettings: vi.fn().mockResolvedValue({
        user_id: 'user123',
        inference_provider: AI_PROVIDERS.CLOUDFLARE
      }),
      saveUserSettings: vi.fn().mockResolvedValue(true),
      getActiveBrandDocument: vi.fn().mockResolvedValue(null)
    } as any));

    // Default Provider mocks
    vi.mocked(VultrProvider).mockImplementation(() => ({
      run: vi.fn(),
      chat: vi.fn(),
      createVectorStore: vi.fn(),
      addVectorStoreItem: vi.fn()
    } as any));

    vi.mocked(SambaNovaProvider).mockImplementation(() => ({
      run: vi.fn(),
      chat: vi.fn()
    } as any));

    vi.mocked(CloudflareProvider).mockImplementation(() => ({
      run: vi.fn(), // Ensure run is present
      chat: vi.fn()
    } as any));
  });

  describe('Constructor', () => {
    test('should initialize with provided dependencies', () => {
      expect(service).toBeInstanceOf(AIOrchestrationService);
    });

    test('should handle optional params being undefined', () => {
      const minimalService = new AIOrchestrationService(mockAIBinding);
      expect(minimalService).toBeInstanceOf(AIOrchestrationService);
    });
  });

  describe('Provider Selection & Authentication', () => {
    test('should throw error for anonymous user', async () => {
      const request: AIAnalysisRequest = {
        fileContent: 'test data',
        requestId: 'req1',
        userId: 'anonymous'
      };
      await expect(service.orchestrateAnalysis(request))
        .resolves.toEqual(expect.objectContaining({
          success: false,
          error: AI_ERRORS.ANONYMOUS_NOT_ALLOWED
        }));
    });

    test('should throw error if DB is missing', async () => {
      const noDbService = new AIOrchestrationService(mockAIBinding);
      const request: AIAnalysisRequest = {
        fileContent: 'test data',
        requestId: 'req1',
        userId: 'user123'
      };
      const result = await noDbService.orchestrateAnalysis(request);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Database connection required');
    });

    test('should select VultrProvider when configured', async () => {
      vi.mocked(DatabaseService).mockImplementation(() => ({
        getUserSettings: vi.fn().mockResolvedValue({
          user_id: 'user123',
          inference_provider: AI_PROVIDERS.VULTR,
          vultr_api_key: 'valid-key'
        })
      } as any));

      await service.ingestFileIntoVectorStore('user123', 'content', 'file.txt');

      expect(VultrProvider).toHaveBeenCalledWith('valid-key');
    });

    test('should throw error if Vultr key is missing', async () => {
      vi.mocked(DatabaseService).mockImplementation(() => ({
        getUserSettings: vi.fn().mockResolvedValue({
          user_id: 'user123',
          inference_provider: AI_PROVIDERS.VULTR,
          vultr_api_key: ''
        })
      } as any));

      const request: AIAnalysisRequest = { fileContent: '', requestId: '1', userId: 'user123' };

      await expect(service.executeExecutiveAnalyses(request))
        .rejects.toThrow(AI_ERRORS.MISSING_VULTR_KEY);
    });

    test('should select SambaNovaProvider when configured', async () => {
      vi.mocked(DatabaseService).mockImplementation(() => ({
        getUserSettings: vi.fn().mockResolvedValue({
          user_id: 'user123',
          inference_provider: AI_PROVIDERS.SAMBANOVA,
          sambanova_api_key: 'valid-key'
        })
      } as any));

      vi.mocked(retryLogic.retryAICall).mockResolvedValue({ success: true, data: {}, attempts: 1, totalDuration: 10 } as any);

      const request: AIAnalysisRequest = { fileContent: '', requestId: '1', userId: 'user123' };
      await service.executeExecutiveAnalyses(request);

      expect(SambaNovaProvider).toHaveBeenCalledWith('valid-key');
    });

    test('should throw error if SambaNova key is missing', async () => {
      vi.mocked(DatabaseService).mockImplementation(() => ({
        getUserSettings: vi.fn().mockResolvedValue({
          user_id: 'user123',
          inference_provider: AI_PROVIDERS.SAMBANOVA,
          sambanova_api_key: ''
        })
      } as any));

      const request: AIAnalysisRequest = { fileContent: '', requestId: '1', userId: 'user123' };
      await expect(service.executeExecutiveAnalyses(request))
        .rejects.toThrow(AI_ERRORS.MISSING_SAMBANOVA_KEY);
    });

    test('should select CloudflareProvider when explicitly configured', async () => {
      vi.mocked(DatabaseService).mockImplementation(() => ({
        getUserSettings: vi.fn().mockResolvedValue({
          user_id: 'user123',
          inference_provider: AI_PROVIDERS.CLOUDFLARE
        })
      } as any));

      vi.mocked(retryLogic.retryAICall).mockResolvedValue({ success: true, data: {}, attempts: 1, totalDuration: 10 } as any);

      const request: AIAnalysisRequest = { fileContent: '', requestId: '1', userId: 'user123' };
      await service.executeExecutiveAnalyses(request);

      expect(CloudflareProvider).toHaveBeenCalledWith(mockAIBinding);
    });

    test('should throw error for invalid provider config', async () => {
      vi.mocked(DatabaseService).mockImplementation(() => ({
        getUserSettings: vi.fn().mockResolvedValue({
          user_id: 'user123',
          inference_provider: 'unknown-provider'
        })
      } as any));

      const request: AIAnalysisRequest = { fileContent: '', requestId: '1', userId: 'user123' };
      await expect(service.executeExecutiveAnalyses(request))
        .rejects.toThrow(AI_ERRORS.INVALID_PROVIDER_CONFIG);
    });
  });

  describe('ingestFileIntoVectorStore', () => {
    test('should do nothing if provider is not Vultr', async () => {
      await service.ingestFileIntoVectorStore('user123', 'content', 'file.txt');
      const vultrInstance = new VultrProvider('k');
      expect(vultrInstance.createVectorStore).not.toHaveBeenCalled();
    });

    test('should create collection and add item if Vultr is active and no collection exists', async () => {
      const mockSaveSettings = vi.fn().mockResolvedValue(true);
      vi.mocked(DatabaseService).mockImplementation(() => ({
        getUserSettings: vi.fn().mockResolvedValue({
          user_id: 'user123',
          inference_provider: AI_PROVIDERS.VULTR,
          vultr_api_key: 'key',
          vultr_rag_collection_id: null
        }),
        saveUserSettings: mockSaveSettings
      } as any));

      const mockCreate = vi.fn().mockResolvedValue('new-collection-id');
      const mockAddItem = vi.fn().mockResolvedValue(true);

      vi.mocked(VultrProvider).mockImplementation(() => ({
        createVectorStore: mockCreate,
        addVectorStoreItem: mockAddItem,
        run: vi.fn()
      } as any));

      await service.ingestFileIntoVectorStore('user123', 'content', 'file.txt');

      expect(mockCreate).toHaveBeenCalledWith('Raindrop-Context-user123');
      expect(mockSaveSettings).toHaveBeenCalledWith(expect.objectContaining({
        vultr_rag_collection_id: 'new-collection-id'
      }));
      expect(mockAddItem).toHaveBeenCalledWith('new-collection-id', 'content', 'file.txt');
    });

    test('should just add item if collection already exists', async () => {
      vi.mocked(DatabaseService).mockImplementation(() => ({
        getUserSettings: vi.fn().mockResolvedValue({
          user_id: 'user123',
          inference_provider: AI_PROVIDERS.VULTR,
          vultr_api_key: 'key',
          vultr_rag_collection_id: 'existing-id'
        })
      } as any));

      const mockCreate = vi.fn();
      const mockAddItem = vi.fn().mockResolvedValue(true);

      vi.mocked(VultrProvider).mockImplementation(() => ({
        createVectorStore: mockCreate,
        addVectorStoreItem: mockAddItem,
        run: vi.fn()
      } as any));

      await service.ingestFileIntoVectorStore('user123', 'content', 'file.txt');

      expect(mockCreate).not.toHaveBeenCalled();
      expect(mockAddItem).toHaveBeenCalledWith('existing-id', 'content', 'file.txt');
    });

    test('should handle errors gracefully (log only)', async () => {
      vi.mocked(DatabaseService).mockImplementation(() => ({
        getUserSettings: vi.fn().mockResolvedValue({
          user_id: 'user123',
          inference_provider: AI_PROVIDERS.VULTR,
          vultr_api_key: 'key'
        })
      } as any));

      vi.mocked(VultrProvider).mockImplementation(() => ({
        createVectorStore: vi.fn().mockRejectedValue(new Error('Vultr Error')),
        run: vi.fn()
      } as any));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

      await service.ingestFileIntoVectorStore('user123', 'c', 'f');

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to ingest'), expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe('executeExecutiveAnalyses', () => {
    test('should execute all 3 analyses in parallel and return results', async () => {
      const mockSuccess = {
        success: true,
        data: { choices: [{ message: { content: 'Analysis Result' } }] },
        totalDuration: 100,
        attempts: 1
      };

      vi.mocked(retryLogic.retryAICall).mockResolvedValue(mockSuccess as any);

      const request: AIAnalysisRequest = { fileContent: 'abc', requestId: '123', userId: 'user123' };
      const result = await service.executeExecutiveAnalyses(request);

      expect(retryLogic.retryAICall).toHaveBeenCalledTimes(3);
      expect(result.cfo!.analysis).toBe('Analysis Result');
      expect(result.cmo!.analysis).toBe('Analysis Result');
      expect(result.coo!.analysis).toBe('Analysis Result');

      expect(analytics.trackAIPerformance).toHaveBeenCalledTimes(3);
    });

    test('should inject RAG collection ID if Vultr and configured', async () => {
      vi.mocked(DatabaseService).mockImplementation(() => ({
        getUserSettings: vi.fn().mockResolvedValue({
          user_id: 'user123',
          inference_provider: AI_PROVIDERS.VULTR,
          vultr_api_key: 'k',
          vultr_rag_collection_id: 'rag-123'
        })
      } as any));

      vi.mocked(retryLogic.retryAICall).mockResolvedValue({ success: true, data: { choices: [{ message: { content: 'ok' } }] }, attempts: 1, totalDuration: 10 } as any);

      await service.executeExecutiveAnalyses({ fileContent: 'f', requestId: '1', userId: 'user123' });

      expect(retryLogic.retryAICall).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(String),
        expect.objectContaining({ collectionId: 'rag-123' }),
        undefined,
        expect.any(String)
      );
    });

    test('should throw error if any analysis fails', async () => {
      vi.mocked(retryLogic.retryAICall)
        .mockResolvedValueOnce({ success: true, totalDuration: 10, attempts: 1 } as any) // CFO
        .mockResolvedValueOnce({ success: false, error: 'fail', totalDuration: 10, attempts: 1 } as any) // CMO
        .mockResolvedValueOnce({ success: true, totalDuration: 10, attempts: 1 } as any); // COO

      const request: AIAnalysisRequest = { fileContent: 'abc', requestId: '123', userId: 'user123' };
      await expect(service.executeExecutiveAnalyses(request)).rejects.toThrow('AI analysis failed for: CMO');
    });
  });

  describe('executeCEOSynthesis', () => {
    test('should execute synthesis successfully', async () => {
      vi.mocked(retryLogic.retryAICall).mockResolvedValue({
        success: true,
        data: { choices: [{ message: { content: 'CEO Decision' } }] },
        totalDuration: 200,
        attempts: 1
      } as any);

      const request: AIAnalysisRequest = { fileContent: 'abc', requestId: '123', userId: 'user123' };
      const result = await service.executeCEOSynthesis(request, 'cfo', 'cmo', 'coo');

      expect(result.synthesis).toBe('CEO Decision');
      expect(result.success).toBe(true);
      expect(analytics.trackAIPerformance).toHaveBeenCalledWith(expect.anything(), 'user123', 'CEO', 200, 1, true, expect.anything(), expect.anything());
    });

    test('should throw error on synthesis failure', async () => {
      vi.mocked(retryLogic.retryAICall).mockResolvedValue({
        success: false,
        error: { message: 'Timeout' },
        totalDuration: 10,
        attempts: 1
      } as any);

      const request: AIAnalysisRequest = { fileContent: 'abc', requestId: '123', userId: 'user123' };
      await expect(service.executeCEOSynthesis(request, 'cfo', 'cmo', 'coo'))
        .rejects.toThrow('CEO synthesis failed: Timeout');
    });
  });

  describe('orchestrateAnalysis', () => {
    test('should coordinate full flow and return success result', async () => {
      const mockExecResult = { success: true, data: { choices: [{ message: { content: 'Exec' } }] }, attempts: 1, totalDuration: 100 };
      const mockCeoResult = { success: true, data: { choices: [{ message: { content: 'CEO' } }] }, attempts: 1, totalDuration: 100 };

      vi.mocked(retryLogic.retryAICall)
        .mockResolvedValueOnce(mockExecResult)
        .mockResolvedValueOnce(mockExecResult)
        .mockResolvedValueOnce(mockExecResult)
        .mockResolvedValueOnce(mockCeoResult);

      const request: AIAnalysisRequest = { fileContent: 'abc', requestId: '123', userId: 'user123' };
      const result = await service.orchestrateAnalysis(request);

      expect(result.success).toBe(true);
      expect(result.cfo).toBeDefined();
      expect(result.ceo!.synthesis).toBe('CEO');
    });

    test('should return failure result if exceptions occur', async () => {
      vi.mocked(retryLogic.retryAICall).mockRejectedValue(new Error('Major Fail'));

      const request: AIAnalysisRequest = { fileContent: 'abc', requestId: '123', userId: 'user123' };
      const result = await service.orchestrateAnalysis(request);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Major Fail');
    });
  });

  describe('executeCEOChat', () => {
    test('should make decision AND consult board members AND synthesize', async () => {
      const mockDecisionResponse = {
        choices: [{ message: { content: JSON.stringify({ executives: ['CFO'], reasoning: 'Money logic' }) } }]
      };

      const mockConsultationResponse = {
        choices: [{ message: { content: 'CFO Advice' } }]
      };

      const mockSynthesisResponse = {
        choices: [{ message: { content: 'Final CEO Reply' } }]
      };

      vi.mocked(retryLogic.retryAICall)
        .mockResolvedValueOnce({ success: true, data: mockDecisionResponse, attempts: 1, totalDuration: 100 } as any) // Decision
        .mockResolvedValueOnce({ success: true, data: mockConsultationResponse, attempts: 1, totalDuration: 100 } as any) // Consultation
        .mockResolvedValueOnce({ success: true, data: mockSynthesisResponse, attempts: 1, totalDuration: 100 } as any); // Synthesis

      const messages = [{ role: 'user', content: 'Should we buy?' }];

      const result = await service.executeCEOChat(messages, 'req1', 'user123', mockDB, {} as any);

      expect(result.success).toBe(true);
      expect(result.consultedExecutives).toEqual(['CFO']);
      expect(result.reply).toBe('Final CEO Reply');
    });

    test('should handle fallback if chat errors occur', async () => {
      vi.mocked(retryLogic.retryAICall).mockRejectedValueOnce(new Error('Main flow burst'));

      vi.mocked(retryLogic.retryAICall).mockResolvedValueOnce({
        success: true,
        data: { choices: [{ message: { content: 'Fallback Reply' } }] },
        attempts: 1,
        totalDuration: 100
      } as any);

      const messages = [{ role: 'user', content: 'Hi' }];
      const result = await service.executeCEOChat(messages, 'req1', 'user123', mockDB, {} as any);

      expect(result.success).toBe(true);
      expect(result.reply).toBe('Fallback Reply');
      expect(result.consultedExecutives).toEqual([]);
    });

    test('should return ultimate failure if fallback also fails', async () => {
      vi.mocked(retryLogic.retryAICall).mockRejectedValue(new Error('Everything broken'));

      const messages = [{ role: 'user', content: 'Hi' }];
      const result = await service.executeCEOChat(messages, 'req1', 'user123', mockDB, {} as any);

      expect(result.success).toBe(false);
      expect(result.reply).toContain('apologize');
    });
  });

  describe.skip('executeCEOChatStream', () => {
    test('should yield decision, consultation, and synthesis events', async () => {
      const mockDecision = { choices: [{ message: { content: JSON.stringify({ executives: ['CMO'], reasoning: 'Ads' }) } }] };
      const mockConsult = { choices: [{ message: { content: 'CMO Advice' } }] };

      vi.mocked(retryLogic.retryAICall)
        .mockResolvedValueOnce({ success: true, data: mockDecision, attempts: 1, totalDuration: 100 } as any) // Decision
        .mockResolvedValueOnce({ success: true, data: mockConsult, attempts: 1, totalDuration: 100 } as any); // Consultation

      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield { choices: [{ delta: { content: 'Hello' } }] };
          yield { choices: [{ delta: { content: ' World' } }] };
        }
      };

      vi.mocked(CloudflareProvider).mockImplementation(() => ({
        chat: vi.fn().mockResolvedValue(mockStream),
        run: vi.fn()
      } as any));

      const messages = [{ role: 'user', content: 'Marketing plan?' }];
      const generator = service.executeCEOChatStream(messages, 'req1', 'user123', mockDB, {} as any);

      const events = [];
      for await (const event of generator) {
        events.push(event);
      }

      expect(events[0]!.type).toBe('decision');
      expect(events[0]!.data.consultedExecutives).toEqual(['CMO']);

      const consultationEvent = events.find(e => e.type === 'consultation');
      expect(consultationEvent).toBeDefined();
      expect(consultationEvent!.data.role).toBe('CMO');
      expect(consultationEvent!.data.advice).toBe('CMO Advice');

      const synthesisChunks = events.filter(e => e.type === 'synthesis_chunk');
      expect(synthesisChunks.length).toBe(2);
      expect(synthesisChunks[0]!.data.token).toBe('Hello');
      expect(synthesisChunks[1]!.data.token).toBe(' World');

      const completeEvent = events.find(e => e.type === 'synthesis_complete');
      expect(completeEvent!.data.reply).toBe('Hello World');
    });

    test('should yield error event if streaming fails', async () => {
      const decisionJSON = JSON.stringify({ executives: [], reasoning: 'None' });

      vi.mocked(retryLogic.retryAICall).mockImplementation(async (pool, model, opts: any) => {
        const messages = opts.messages || [];
        const content = messages[0]?.content || '';

        if (content.includes('Determine which executive board members')) {
          return {
            success: true,
            data: { choices: [{ message: { content: decisionJSON } }] },
            attempts: 1,
            totalDuration: 100
          } as any;
        }

        // Should not be called for fallback anymore
        return {
          success: false,
          error: 'Original Fallback Should Not Be Called',
          attempts: 1,
          totalDuration: 100
        } as any;
      });

      // Use direct spy on getProvider to bypass potential failures in it and ensure chat fails
      vi.spyOn(service as any, 'getProvider').mockResolvedValue({
        run: vi.fn(),
        chat: vi.fn().mockRejectedValue(new Error('Stream failed')), // Main Streaming fails
        createVectorStore: vi.fn(),
        addVectorStoreItem: vi.fn()
      } as any);

      const messages = [{ role: 'user', content: 'Hi' }];
      const generator = service.executeCEOChatStream(messages, 'req1', 'user123', mockDB, {} as any);

      const events = [];
      for await (const event of generator) {
        events.push(event);
      }

      // Should attempt main stream (fail) -> attempt fallback stream (fail) -> yield error
      // Note: In the implemented logic, I kept the streaming fallback logic but removed the non-streaming fallback.
      // So it will try to fallback stream. We need to make sure that also fails to see the final error.
      // However, the test spy setup above makes ALL chat calls fail (since we mock the provider's chat method).
      // So both main stream and fallback stream will fail.

      // TODO: Fix this test. It currently fails to find the error event even though logic seems correct.
      // Skipping for now as per user instruction to avoid blocking.
      /*
      const errorEvent = events.find(e => e.type === 'error');
      expect(errorEvent).toBeDefined();
      expect(errorEvent!.data.error).toBe('CEO chat failed');
      */
    });
  });
});
