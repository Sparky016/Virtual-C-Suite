// AI Orchestration Service - Manages parallel AI analysis
import { getCFOPrompt, getCMOPrompt, getCOOPrompt, getCEOSynthesisPrompt } from '../shared/prompts';
import { retryAICall, RetryResult } from '../shared/retry-logic';
import { trackAIPerformance, trackEvent, AnalyticsEvents } from '../shared/analytics';

export interface AIAnalysisRequest {
  fileContent: string;
  requestId: string;
  userId: string;
}

export interface ExecutiveAnalysis {
  role: 'CFO' | 'CMO' | 'COO';
  analysis: string;
  duration: number;
  attempts: number;
  success: boolean;
}

export interface CEOSynthesis {
  synthesis: string;
  duration: number;
  attempts: number;
  success: boolean;
}

export interface AIOrchestrationResult {
  success: boolean;
  cfo?: ExecutiveAnalysis;
  cmo?: ExecutiveAnalysis;
  coo?: ExecutiveAnalysis;
  ceo?: CEOSynthesis;
  error?: string;
  totalDuration: number;
}

export class AIOrchestrationService {
  private aiClient: any;
  private posthogKey?: string;
  private model: string = 'llama-3.3-70b';

  constructor(aiClient: any, posthogKey?: string) {
    this.aiClient = aiClient;
    this.posthogKey = posthogKey;
  }

  /**
   * Execute parallel executive analyses (CFO, CMO, COO)
   */
  async executeExecutiveAnalyses(
    request: AIAnalysisRequest
  ): Promise<{ cfo: ExecutiveAnalysis; cmo: ExecutiveAnalysis; coo: ExecutiveAnalysis }> {
    const startTime = Date.now();

    // SCATTER: Parallel AI calls with retry logic
    const [cfoResult, cmoResult, cooResult] = await Promise.all([
      this.executeCFOAnalysis(request.fileContent),
      this.executeCMOAnalysis(request.fileContent),
      this.executeCOOAnalysis(request.fileContent)
    ]);

    const duration = Date.now() - startTime;
    console.log(`Parallel AI analysis completed in ${duration}ms`);

    // Track AI performance for each executive
    this.trackExecutivePerformance(request, cfoResult, 'CFO');
    this.trackExecutivePerformance(request, cmoResult, 'CMO');
    this.trackExecutivePerformance(request, cooResult, 'COO');

    // Check for failures
    if (!cfoResult.success || !cmoResult.success || !cooResult.success) {
      const failedRoles = [
        !cfoResult.success ? 'CFO' : null,
        !cmoResult.success ? 'CMO' : null,
        !cooResult.success ? 'COO' : null
      ].filter(Boolean);

      throw new Error(`AI analysis failed for: ${failedRoles.join(', ')}`);
    }

    return {
      cfo: this.buildExecutiveAnalysis(cfoResult, 'CFO'),
      cmo: this.buildExecutiveAnalysis(cmoResult, 'CMO'),
      coo: this.buildExecutiveAnalysis(cooResult, 'COO')
    };
  }

  /**
   * Execute CEO synthesis
   */
  async executeCEOSynthesis(
    request: AIAnalysisRequest,
    cfoAnalysis: string,
    cmoAnalysis: string,
    cooAnalysis: string
  ): Promise<CEOSynthesis> {
    const startTime = Date.now();

    const ceoResult = await retryAICall(
      this.aiClient,
      this.model,
      {
        model: this.model,
        messages: [{ role: 'user', content: getCEOSynthesisPrompt(cfoAnalysis, cmoAnalysis, cooAnalysis) }],
        temperature: 0.8,
        max_tokens: 1000
      },
      undefined,
      'CEO Synthesis'
    );

    const duration = Date.now() - startTime;

    // Track CEO synthesis performance
    trackAIPerformance(this.posthogKey, request.userId, 'CEO', ceoResult.totalDuration, ceoResult.attempts, ceoResult.success, {
      request_id: request.requestId
    });

    trackEvent(this.posthogKey, request.userId, AnalyticsEvents.CEO_SYNTHESIS_COMPLETED, {
      request_id: request.requestId,
      duration_ms: duration
    });

    if (!ceoResult.success) {
      throw new Error(`CEO synthesis failed: ${ceoResult.error?.message}`);
    }

    return {
      synthesis: ceoResult.data?.choices[0]?.message?.content || 'Synthesis unavailable',
      duration,
      attempts: ceoResult.attempts,
      success: true
    };
  }

  /**
   * Execute complete AI orchestration (executives + CEO)
   */
  async orchestrateAnalysis(request: AIAnalysisRequest): Promise<AIOrchestrationResult> {
    const startTime = Date.now();

    try {
      // Execute parallel executive analyses
      const executives = await this.executeExecutiveAnalyses(request);

      // Execute CEO synthesis
      const ceo = await this.executeCEOSynthesis(
        request,
        executives.cfo.analysis,
        executives.cmo.analysis,
        executives.coo.analysis
      );

      const totalDuration = Date.now() - startTime;

      return {
        success: true,
        cfo: executives.cfo,
        cmo: executives.cmo,
        coo: executives.coo,
        ceo,
        totalDuration
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        totalDuration: Date.now() - startTime
      };
    }
  }

  // Private helper methods

  private async executeCFOAnalysis(fileContent: string): Promise<RetryResult<any>> {
    return retryAICall(
      this.aiClient,
      this.model,
      {
        model: this.model,
        messages: [{ role: 'user', content: getCFOPrompt(fileContent) }],
        temperature: 0.7,
        max_tokens: 800
      },
      undefined,
      'CFO Analysis'
    );
  }

  private async executeCMOAnalysis(fileContent: string): Promise<RetryResult<any>> {
    return retryAICall(
      this.aiClient,
      this.model,
      {
        model: this.model,
        messages: [{ role: 'user', content: getCMOPrompt(fileContent) }],
        temperature: 0.7,
        max_tokens: 800
      },
      undefined,
      'CMO Analysis'
    );
  }

  private async executeCOOAnalysis(fileContent: string): Promise<RetryResult<any>> {
    return retryAICall(
      this.aiClient,
      this.model,
      {
        model: this.model,
        messages: [{ role: 'user', content: getCOOPrompt(fileContent) }],
        temperature: 0.7,
        max_tokens: 800
      },
      undefined,
      'COO Analysis'
    );
  }

  private buildExecutiveAnalysis(result: RetryResult<any>, role: 'CFO' | 'CMO' | 'COO'): ExecutiveAnalysis {
    return {
      role,
      analysis: result.data?.choices[0]?.message?.content || 'Analysis unavailable',
      duration: result.totalDuration,
      attempts: result.attempts,
      success: result.success
    };
  }

  private trackExecutivePerformance(
    request: AIAnalysisRequest,
    result: RetryResult<any>,
    role: 'CFO' | 'CMO' | 'COO'
  ): void {
    trackAIPerformance(
      this.posthogKey,
      request.userId,
      role,
      result.totalDuration,
      result.attempts,
      result.success,
      { request_id: request.requestId }
    );

    const eventMap = {
      CFO: AnalyticsEvents.CFO_ANALYSIS_COMPLETED,
      CMO: AnalyticsEvents.CMO_ANALYSIS_COMPLETED,
      COO: AnalyticsEvents.COO_ANALYSIS_COMPLETED
    };

    trackEvent(this.posthogKey, request.userId, eventMap[role], {
      request_id: request.requestId,
      duration_ms: result.totalDuration
    });
  }
}
