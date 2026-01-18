// AI Orchestration Service - Manages parallel AI analysis
import {
  getCFOPrompt,
  getCMOPrompt,
  getCOOPrompt,
  getCEOSynthesisPrompt,
  getBoardConsultationDecisionPrompt,
  getCFOChatPrompt,
  getCMOChatPrompt,
  getCOOChatPrompt,
  getCEOChatSynthesisPrompt
} from '../shared/prompts';
import { retryAICall, RetryResult } from '../shared/retry-logic';
import { trackAIPerformance, trackEvent, AnalyticsEvents } from '../analytics/analytics';
import { SqlDatabase, Bucket } from '@liquidmetal-ai/raindrop-framework';
import { DatabaseService } from './Database/DatabaseService';
import { StorageService } from './StorageService';
import { LoggerService } from './Logger/LoggerService';
import { AIProvider } from './AI/AIProvider';
import { VultrProvider } from './AI/VultrProvider';
import { SambaNovaProvider } from './AI/SambaNovaProvider';
import { CloudflareProvider } from './AI/CloudflareProvider';
import { AI_PROVIDERS, AI_ERRORS } from '../constants/ai-constants';

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

export interface BoardConsultationDecision {
  executives: ('CFO' | 'CMO' | 'COO')[];
  reasoning: string;
}

export interface ExecutiveConsultation {
  role: 'CFO' | 'CMO' | 'COO';
  advice: string;
  duration: number;
  attempts: number;
  success: boolean;
}

export interface CEOChatResult {
  reply: string;
  consultedExecutives: ('CFO' | 'CMO' | 'COO')[];
  consultationDuration?: number;
  totalDuration: number;
  attempts: number;
  success: boolean;
}

export interface CEOChatStreamEvent {
  type: 'decision' | 'consultation' | 'synthesis_start' | 'synthesis_chunk' | 'synthesis_complete' | 'complete' | 'error';
  data?: any;
}

// Helper to filter <think>...</think> tags from a stream of tokens
class StreamThinkingFilter {
  private inThinkingBlock = false;
  private buffer = '';

  process(text: string): string {
    let output = '';
    let current = this.buffer + text;
    this.buffer = '';

    while (current.length > 0) {
      if (this.inThinkingBlock) {
        const endTagIndex = current.indexOf('</think>');
        if (endTagIndex !== -1) {
          this.inThinkingBlock = false;
          current = current.slice(endTagIndex + 8);
        } else {
          const partialMatch = this.findPartialMatch(current, '</think>');
          if (partialMatch) {
            this.buffer = partialMatch;
            current = '';
          } else {
            current = '';
          }
        }
      } else {
        const startTagIndex = current.indexOf('<think>');
        if (startTagIndex !== -1) {
          output += current.slice(0, startTagIndex);
          this.inThinkingBlock = true;
          current = current.slice(startTagIndex + 7);
        } else {
          const partialMatch = this.findPartialMatch(current, '<think>');
          if (partialMatch) {
            output += current.slice(0, current.length - partialMatch.length);
            this.buffer = partialMatch;
            current = '';
          } else {
            output += current;
            current = '';
          }
        }
      }
    }
    return output;
  }

  private findPartialMatch(text: string, tag: string): string | null {
    for (let i = tag.length - 1; i > 0; i--) {
      if (text.endsWith(tag.slice(0, i))) {
        return tag.slice(0, i);
      }
    }
    return null;
  }
}

export class AIOrchestrationService {
  private aiBinding: any; // Keep original binding for fallback/default
  private posthogKey?: string;
  private environment?: string;
  private db?: SqlDatabase; // Add DB access for settings lookup

  constructor(aiBinding: any, posthogKey?: string, environment?: string, db?: SqlDatabase) {
    this.aiBinding = aiBinding;
    this.posthogKey = posthogKey;
    this.environment = environment;
    this.db = db;
  }

  private userSettings?: any; // To cache settings

  /**
   * Get the appropriate model based on the provider
   */
  private getModelForProvider(provider: AIProvider): string {
    if (provider instanceof VultrProvider) {
      return 'deepseek-r1-distill-llama-70b';
    } else if (provider instanceof SambaNovaProvider) {
      return 'Meta-Llama-3.3-70B-Instruct';
    } else {
      // Cloudflare or default
      return '@cf/meta/llama-3-8b-instruct';
    }
  }

  private async getProvider(userId: string): Promise<AIProvider> {
    // 1. Enforce Authentication
    if (!userId || userId === 'anonymous') {
      throw new Error(AI_ERRORS.ANONYMOUS_NOT_ALLOWED);
    }

    if (!this.db) {
      throw new Error('Database connection required for AI provider settings.');
    }

    try {
      const dbService = new DatabaseService(this.db, new LoggerService(this.posthogKey, this.environment));
      const settings = await dbService.getUserSettings(userId);
      this.userSettings = settings;

      if (settings) {
        if (settings.inference_provider === AI_PROVIDERS.VULTR) {
          if (!settings.vultr_api_key) {
            throw new Error(AI_ERRORS.MISSING_VULTR_KEY);
          }
          return new VultrProvider(settings.vultr_api_key);
        }

        if (settings.inference_provider === AI_PROVIDERS.SAMBANOVA) {
          if (!settings.sambanova_api_key) {
            throw new Error(AI_ERRORS.MISSING_SAMBANOVA_KEY);
          }
          return new SambaNovaProvider(settings.sambanova_api_key);
        }

        if (settings.inference_provider === AI_PROVIDERS.CLOUDFLARE) {
          return new CloudflareProvider(this.aiBinding);
        }
      }

      // If we reach here, no valid provider configuration was found
      throw new Error(AI_ERRORS.INVALID_PROVIDER_CONFIG);

    } catch (e: any) {
      console.error('Error fetching/configuring AI provider:', e);
      // Propagate specific authentication/configuration errors
      if (Object.values(AI_ERRORS).includes(e.message)) {
        throw e;
      }
      throw new Error(AI_ERRORS.INVALID_PROVIDER_CONFIG);
    }
  }

  /**
   * Ingest file content into Vultr Vector Store if Vultr is the active provider
   * This allows the CEO chat to reference uploaded documents for context
   */
  async ingestFileIntoVectorStore(userId: string, content: string, filename: string): Promise<void> {
    const provider = await this.getProvider(userId);

    // Only proceed if provider is Vultr
    if (!(provider instanceof VultrProvider)) {
      console.log(`Skipping RAG ingestion - provider is not Vultr (user: ${userId})`);
      return;
    }

    if (!this.userSettings) {
      console.warn(`Skipping RAG ingestion - no user settings found (user: ${userId})`);
      return;
    }

    try {
      let collectionId = this.userSettings.vultr_rag_collection_id;

      // 1. Create collection if it doesn't exist
      if (!collectionId) {
        console.log(`[RAG] Creating new Vultr Vector Store for user: ${userId}`);
        collectionId = await provider.createVectorStore(`Raindrop-Context-${userId}`);
        console.log(`[RAG] Created collection: ${collectionId}`);

        // Save new collection ID to settings
        if (this.db) {
          const dbService = new DatabaseService(this.db, new LoggerService(this.posthogKey, this.environment));
          // Update settings object
          this.userSettings.vultr_rag_collection_id = collectionId;
          // Persist to DB
          await dbService.saveUserSettings(this.userSettings);
          console.log(`[RAG] Saved collection ID to user settings`);
        }
      }

      // 2. Add item to collection with metadata
      console.log(`[RAG] Ingesting document into collection ${collectionId}: ${filename} (${content.length} chars)`);
      await provider.addVectorStoreItem(collectionId, content, filename);
      console.log(`[RAG] Successfully ingested ${filename} - now available for CEO chat context`);

    } catch (error) {
      console.error('[RAG] Failed to ingest file into Vultr Vector Store:', error);
      throw error; // Re-throw to let caller handle
    }
  }

  /**
   * Helper to run AI call with correct provider
   */
  private async runAI(
    userId: string,
    options: any,
    context?: string
  ): Promise<RetryResult<any>> {
    const provider = await this.getProvider(userId);
    const model = this.getModelForProvider(provider);

    // Inject RAG collection ID if available and provider is Vultr
    if (this.userSettings?.vultr_rag_collection_id && provider instanceof VultrProvider) {
      options.collectionId = this.userSettings.vultr_rag_collection_id;
    }

    // Set the model in options
    options.model = model;

    return retryAICall(
      provider,
      model,
      options,
      undefined,
      context
    );
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
      this.executeCFOAnalysis(request.fileContent, request.userId),
      this.executeCMOAnalysis(request.fileContent, request.userId),
      this.executeCOOAnalysis(request.fileContent, request.userId)
    ]);

    const duration = Date.now() - startTime;
    console.log(`Parallel AI analysis completed in ${duration}ms`);

    // Track AI performance for each executive
    this.trackExecutivePerformance(request, cfoResult, 'CFO');
    this.trackExecutivePerformance(request, cmoResult, 'CMO');
    this.trackExecutivePerformance(request, cooResult, 'COO');

    // Check for failures
    if (!cfoResult.success || !cmoResult.success || !cooResult.success) {
      const failedDetails = [
        !cfoResult.success ? `CFO: ${cfoResult.error?.message || 'Unknown error'}` : null,
        !cmoResult.success ? `CMO: ${cmoResult.error?.message || 'Unknown error'}` : null,
        !cooResult.success ? `COO: ${cooResult.error?.message || 'Unknown error'}` : null
      ].filter(Boolean);

      throw new Error(`AI analysis failed - ${failedDetails.join('; ')}`);
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

    const ceoResult = await this.runAI(
      request.userId,
      {
        messages: [{ role: 'user', content: getCEOSynthesisPrompt(cfoAnalysis, cmoAnalysis, cooAnalysis) }],
        temperature: 0.8,
        max_tokens: 1000
      },
      'CEO Synthesis'
    );

    const duration = Date.now() - startTime;

    // Track CEO synthesis performance
    trackAIPerformance(this.posthogKey, request.userId, 'CEO', ceoResult.totalDuration, ceoResult.attempts, ceoResult.success, {
      request_id: request.requestId
    }, this.environment);

    trackEvent(this.posthogKey, request.userId, AnalyticsEvents.CEO_SYNTHESIS_COMPLETED, {
      request_id: request.requestId,
      duration_ms: duration
    }, this.environment);

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

  /**
   * Execute CEO chat with board consultation
   */
  async executeCEOChat(
    messages: { role: string; content: string }[],
    requestId: string,
    userId: string,
    db?: SqlDatabase,
    bucket?: Bucket
  ): Promise<CEOChatResult> {
    const startTime = Date.now();
    let consultedExecutives: ('CFO' | 'CMO' | 'COO')[] = [];
    let consultationDuration = 0;

    try {
      // Get the latest user message
      const userMessages = messages.filter(m => m.role === 'user');
      const latestUserMessage = userMessages[userMessages.length - 1]?.content || '';

      if (!latestUserMessage) {
        throw new Error('No user message found');
      }

      // Fetch brand context if available
      let brandContext: string | null = null;
      if (db && bucket) {
        brandContext = await this.fetchBrandContext(userId, db, bucket);
      }

      // STEP 1: Decision - Determine which board members to consult
      const decisionStartTime = Date.now();
      const decision = await this.decideBoardConsultation(latestUserMessage, userId, requestId);
      const decisionDuration = Date.now() - decisionStartTime;

      console.log(`Board consultation decision took ${decisionDuration}ms`);

      consultedExecutives = decision.executives;

      // STEP 2: Parallel Execution - Consult selected executives (if any)
      let boardAdvice: { role: string; advice: string }[] = [];

      if (consultedExecutives.length > 0) {
        const consultationStartTime = Date.now();

        // Format conversation history (exclude the latest message as it's passed separately)
        const conversationHistory = this.formatConversationHistory(messages.slice(0, -1));

        // Execute parallel consultations
        const consultations = await this.executeExecutiveConsultations(
          consultedExecutives,
          conversationHistory,
          latestUserMessage,
          userId
        );

        consultationDuration = Date.now() - consultationStartTime;

        console.log(`Executive consultations completed in ${consultationDuration}ms`);

        // Track each consultation
        consultations.forEach(consultation => {
          if (this.posthogKey) {
            trackAIPerformance(
              this.posthogKey,
              userId,
              `${consultation.role}_CHAT`,
              consultation.duration,
              consultation.attempts,
              consultation.success,
              { request_id: requestId },
              this.environment
            );
          }
        });

        // Build board advice array
        boardAdvice = consultations.map(c => ({
          role: c.role,
          advice: c.advice
        }));
      }

      // STEP 3: Synthesis - CEO generates final response
      const synthesisStartTime = Date.now();

      const conversationHistory = this.formatConversationHistory(messages.slice(0, -1));

      const synthesisResult = await this.runAI(
        userId,
        {
          messages: [{
            role: 'user',
            content: getCEOChatSynthesisPrompt(conversationHistory, latestUserMessage, boardAdvice, brandContext)
          }],
          temperature: 0.7,
          max_tokens: 1000
        },
        'CEO Chat Synthesis'
      );

      const synthesisDuration = Date.now() - synthesisStartTime;

      if (!synthesisResult.success) {
        throw new Error('CEO synthesis failed');
      }

      const reply = synthesisResult.data?.choices[0]?.message?.content || 'I apologize, but I was unable to generate a response.';

      const totalDuration = Date.now() - startTime;

      // Track overall CEO chat performance
      if (this.posthogKey) {
        trackAIPerformance(
          this.posthogKey,
          userId,
          'CEO_CHAT',
          totalDuration,
          synthesisResult.attempts,
          true,
          {
            request_id: requestId,
            message_count: messages.length,
            consulted_executives: consultedExecutives.join(','),
            consultation_duration_ms: consultationDuration
          },
          this.environment
        );

        trackEvent(
          this.posthogKey,
          userId,
          AnalyticsEvents.CEO_SYNTHESIS_COMPLETED,
          {
            request_id: requestId,
            duration_ms: totalDuration,
            consulted_executives: consultedExecutives.join(','),
            had_consultation: consultedExecutives.length > 0
          },
          this.environment
        );
      }

      return {
        reply,
        consultedExecutives,
        consultationDuration: consultedExecutives.length > 0 ? consultationDuration : undefined,
        totalDuration,
        attempts: synthesisResult.attempts,
        success: true
      };

    } catch (error) {
      const totalDuration = Date.now() - startTime;

      console.error('CEO chat error:', error);

      // Fallback: Direct CEO response without consultation
      try {
        console.log('Attempting fallback CEO response without consultation');

        const fallbackModel = '@cf/meta/llama-3-8b-instruct'; // Use Cloudflare default for fallback
        const fallbackResult = await retryAICall(
          this.aiBinding,
          fallbackModel,
          {
            model: fallbackModel,
            messages: [
              { role: 'system', content: "You are the CEO of my company with my company's best interest at heart." },
              ...messages
            ],
            temperature: 0.7,
            max_tokens: 1000
          },
          undefined,
          'CEO Chat Fallback'
        );

        if (fallbackResult.success) {
          const reply = fallbackResult.data?.choices[0]?.message?.content || 'I apologize, but I was unable to generate a response.';

          // Track fallback performance
          if (this.posthogKey) {
            trackAIPerformance(
              this.posthogKey,
              userId,
              'CEO_CHAT_FALLBACK',
              totalDuration,
              fallbackResult.attempts,
              true,
              { request_id: requestId },
              this.environment
            );
          }

          return {
            reply,
            consultedExecutives: [],
            totalDuration,
            attempts: fallbackResult.attempts,
            success: true
          };
        }
      } catch (fallbackError) {
        console.error('Fallback CEO response also failed:', fallbackError);
      }

      // Ultimate fallback
      return {
        reply: 'I apologize, but I encountered an error processing your request. Please try again.',
        consultedExecutives: [],
        totalDuration,
        attempts: 0,
        success: false
      };
    }
  }

  /**
   * Execute CEO chat with board consultation (Streaming version)
   * Yields events as processing progresses
   */
  async *executeCEOChatStream(
    messages: { role: string; content: string }[],
    requestId: string,
    userId: string,
    db?: SqlDatabase,
    bucket?: Bucket
  ): AsyncGenerator<CEOChatStreamEvent> {
    const startTime = Date.now();
    let consultedExecutives: ('CFO' | 'CMO' | 'COO')[] = [];
    let consultationDuration = 0;
    let provider: AIProvider = new CloudflareProvider(this.aiBinding);

    try {
      provider = await this.getProvider(userId);
      // Get the latest user message
      const userMessages = messages.filter(m => m.role === 'user');
      const latestUserMessage = userMessages[userMessages.length - 1]?.content || '';

      if (!latestUserMessage) {
        throw new Error('No user message found');
      }

      // Fetch brand context if available
      let brandContext: string | null = null;
      if (db && bucket) {
        brandContext = await this.fetchBrandContext(userId, db, bucket);
      }

      // STEP 1: Decision - Determine which board members to consult
      const decisionStartTime = Date.now();
      const decision = await this.decideBoardConsultation(latestUserMessage, userId, requestId);
      const decisionDuration = Date.now() - decisionStartTime;

      consultedExecutives = decision.executives;

      // Yield decision event
      yield {
        type: 'decision',
        data: {
          consultedExecutives,
          reasoning: decision.reasoning,
          duration: decisionDuration
        }
      };

      // STEP 2: Parallel Execution - Consult selected executives (if any)
      let boardAdvice: { role: string; advice: string }[] = [];

      if (consultedExecutives.length > 0) {
        const consultationStartTime = Date.now();

        // Format conversation history (exclude the latest message as it's passed separately)
        const conversationHistory = this.formatConversationHistory(messages.slice(0, -1));

        // Execute consultations and stream results as they complete
        const consultationPromises = consultedExecutives.map(exec => {
          switch (exec) {
            case 'CFO':
              return this.consultCFO(conversationHistory, latestUserMessage);
            case 'CMO':
              return this.consultCMO(conversationHistory, latestUserMessage);
            case 'COO':
              return this.consultCOO(conversationHistory, latestUserMessage);
          }
        });

        // Wait for consultations and yield results as they complete
        const consultations: ExecutiveConsultation[] = [];
        for (const promise of consultationPromises) {
          const consultation = await promise;
          consultations.push(consultation);

          // Yield consultation event
          yield {
            type: 'consultation',
            data: {
              role: consultation.role,
              advice: consultation.advice,
              duration: consultation.duration,
              success: consultation.success
            }
          };

          // Track each consultation
          if (this.posthogKey && consultation.success) {
            trackAIPerformance(
              this.posthogKey,
              userId,
              `${consultation.role}_CHAT`,
              consultation.duration,
              consultation.attempts,
              consultation.success,
              { request_id: requestId },
              this.environment
            );
          }
        }

        consultationDuration = Date.now() - consultationStartTime;

        // Build board advice array (filter out failed consultations)
        boardAdvice = consultations
          .filter(c => c.success)
          .map(c => ({
            role: c.role,
            advice: c.advice
          }));
      }

      // STEP 3: Synthesis - CEO generates final response (with token streaming)
      const conversationHistory = this.formatConversationHistory(messages.slice(0, -1));

      // Yield synthesis start event
      yield {
        type: 'synthesis_start',
        data: {}
      };

      let reply = '';
      const filter = new StreamThinkingFilter();
      let synthesisAttempts = 1;

      try {
        // Stream the CEO response token by token
        const model = this.getModelForProvider(provider);
        const chatOptions: any = {
          model,
          messages: [{
            role: 'user',
            content: getCEOChatSynthesisPrompt(conversationHistory, latestUserMessage, boardAdvice, brandContext)
          }],
          temperature: 0.7,
          max_tokens: 1000,
          stream: true
        };

        if (this.userSettings?.vultr_rag_collection_id && provider instanceof VultrProvider) {
          chatOptions.collectionId = this.userSettings.vultr_rag_collection_id;
        }

        const stream = await provider.chat(chatOptions);

        console.log('Stream type:', typeof stream, 'Is async iterable:', stream[Symbol.asyncIterator] !== undefined);

        // Check if stream is a ReadableStream (Cloudflare Workers AI format)
        if (stream instanceof ReadableStream || (stream && typeof stream.getReader === 'function')) {
          const reader = stream.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              buffer += decoder.decode(value, { stream: true });

              // Parse SSE format (Server-Sent Events)
              const lines = buffer.split('\n');
              buffer = lines.pop() || ''; // Keep incomplete line in buffer

              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  const data = line.slice(6); // Remove 'data: ' prefix

                  if (data === '[DONE]') continue;

                  try {
                    const parsed = JSON.parse(data);

                    // Extract content from OpenAI-style streaming format
                    if (parsed.choices && parsed.choices[0]?.delta?.content) {
                      const token = parsed.choices[0].delta.content;
                      const filteredToken = filter.process(token);
                      if (filteredToken) {
                        reply += filteredToken;

                        // Yield each token as it arrives
                        yield {
                          type: 'synthesis_chunk',
                          data: {
                            token: filteredToken,
                            accumulated: reply
                          }
                        };
                      }
                    }
                  } catch (parseError) {
                    // Skip malformed JSON
                    console.warn('Failed to parse SSE chunk:', data);
                  }
                }
              }
            }
          } finally {
            reader.releaseLock();
          }
        } else if (stream && stream[Symbol.asyncIterator]) {
          // Handle async iterable format
          for await (const chunk of stream) {
            let token = '';

            // Handle different chunk formats
            if (typeof chunk === 'string') {
              token = chunk;
            } else if (chunk.response) {
              token = chunk.response;
            } else if (chunk.choices && chunk.choices[0]?.delta?.content) {
              token = chunk.choices[0].delta.content;
            }

            if (token) {
              const filteredToken = filter.process(token);
              if (filteredToken) {
                reply += filteredToken;

                // Yield each token as it arrives
                yield {
                  type: 'synthesis_chunk',
                  data: {
                    token: filteredToken,
                    accumulated: reply
                  }
                };
              }
            }
          }
        } else {
          // Not a stream - handle as single response
          throw new Error('Response is not a stream');
        }

        if (!reply) {
          throw new Error('No response generated');
        }

        // Yield synthesis complete event
        yield {
          type: 'synthesis_complete',
          data: {
            reply
          }
        };

      } catch (streamError) {
        // Log error but don't fallback to non-streaming
        console.error('Streaming synthesis failed:', streamError);
        throw streamError;
      }

      const totalDuration = Date.now() - startTime;

      // Track overall CEO chat performance
      if (this.posthogKey) {
        trackAIPerformance(
          this.posthogKey,
          userId,
          'CEO_CHAT_STREAM',
          totalDuration,
          synthesisAttempts,
          true,
          {
            request_id: requestId,
            message_count: messages.length,
            consulted_executives: consultedExecutives.join(','),
            consultation_duration_ms: consultationDuration,
            streaming: true
          },
          this.environment
        );

        trackEvent(
          this.posthogKey,
          userId,
          AnalyticsEvents.CEO_SYNTHESIS_COMPLETED,
          {
            request_id: requestId,
            duration_ms: totalDuration,
            consulted_executives: consultedExecutives.join(','),
            had_consultation: consultedExecutives.length > 0,
            streaming: true
          },
          this.environment
        );
      }

      // Yield completion event with metadata
      yield {
        type: 'complete',
        data: {
          success: true,
          consultedExecutives,
          consultationDuration: consultedExecutives.length > 0 ? consultationDuration : undefined,
          totalDuration,
          attempts: synthesisAttempts
        }
      };

    } catch (error) {
      const totalDuration = Date.now() - startTime;

      console.error('CEO chat stream error:', error);

      // Fallback: Direct CEO response without consultation
      try {
        console.log('Attempting fallback CEO response without consultation');

        // Yield synthesis start
        yield {
          type: 'synthesis_start',
          data: {}
        };

        // Try streaming fallback first
        try {
          const model = this.getModelForProvider(provider);
          const stream = await provider.chat({
            model,
            messages: [
              { role: 'system', content: "You are the CEO of my company with my company's best interest at heart." },
              ...messages
            ],
            temperature: 0.7,
            max_tokens: 1000,
            stream: true
          });

          let reply = '';
          const filter = new StreamThinkingFilter();

          // Handle ReadableStream format (Cloudflare Workers AI)
          if (stream instanceof ReadableStream || (stream && typeof stream.getReader === 'function')) {
            const reader = stream.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });

                // Parse SSE format (Server-Sent Events)
                const lines = buffer.split('\n');
                buffer = lines.pop() || ''; // Keep incomplete line in buffer

                for (const line of lines) {
                  if (line.startsWith('data: ')) {
                    const data = line.slice(6); // Remove 'data: ' prefix

                    if (data === '[DONE]') continue;

                    try {
                      const parsed = JSON.parse(data);

                      // Extract content from OpenAI-style streaming format
                      if (parsed.choices && parsed.choices[0]?.delta?.content) {
                        const token = parsed.choices[0].delta.content;
                        const filteredToken = filter.process(token);
                        if (filteredToken) {
                          reply += filteredToken;

                          yield {
                            type: 'synthesis_chunk',
                            data: {
                              token: filteredToken,
                              accumulated: reply
                            }
                          };
                        }
                      }
                    } catch (parseError) {
                      // Skip malformed JSON
                      console.warn('Failed to parse SSE chunk:', data);
                    }
                  }
                }
              }
            } finally {
              reader.releaseLock();
            }
          } else if (stream && stream[Symbol.asyncIterator]) {
            // Handle async iterable format
            for await (const chunk of stream) {
              let token = '';

              if (typeof chunk === 'string') {
                token = chunk;
              } else if (chunk.response) {
                token = chunk.response;
              } else if (chunk.choices && chunk.choices[0]?.delta?.content) {
                token = chunk.choices[0].delta.content;
              }

              if (token) {
                const filteredToken = filter.process(token);
                if (filteredToken) {
                  reply += filteredToken;

                  yield {
                    type: 'synthesis_chunk',
                    data: {
                      token: filteredToken,
                      accumulated: reply
                    }
                  };
                }
              }
            }
          }

          // Track fallback performance
          if (this.posthogKey) {
            trackAIPerformance(
              this.posthogKey,
              userId,
              'CEO_CHAT_STREAM_FALLBACK',
              totalDuration,
              1,
              true,
              { request_id: requestId, streaming: true },
              this.environment
            );
          }

          // Yield synthesis complete event
          yield {
            type: 'synthesis_complete',
            data: {
              reply
            }
          };

          // Yield completion event
          yield {
            type: 'complete',
            data: {
              success: true,
              consultedExecutives: [],
              totalDuration,
              attempts: 1
            }
          };

          return;

        } catch (streamFallbackError) {
          console.error('Streaming fallback failed:', streamFallbackError);
        }

        // Ultimate fallback - yield error
        yield {
          type: 'error',
          data: {
            error: 'CEO chat failed',
            message: error instanceof Error ? error.message : 'Unknown error',
            totalDuration
          }
        };
      } catch (fallbackError) {
        console.error('Fallback CEO response also failed:', fallbackError);
      }
    }

  }

  // Private helper methods

  private async executeCFOAnalysis(fileContent: string, userId: string = 'anonymous'): Promise<RetryResult<any>> {
    return this.runAI(
      userId,
      {
        messages: [{ role: 'user', content: getCFOPrompt(fileContent) }],
        temperature: 0.7,
        max_tokens: 800
      },
      'CFO Analysis'
    );
  }

  private async executeCMOAnalysis(fileContent: string, userId: string = 'anonymous'): Promise<RetryResult<any>> {
    return this.runAI(
      userId,
      {
        messages: [{ role: 'user', content: getCMOPrompt(fileContent) }],
        temperature: 0.7,
        max_tokens: 800
      },
      'CMO Analysis'
    );
  }

  private async executeCOOAnalysis(fileContent: string, userId: string = 'anonymous'): Promise<RetryResult<any>> {
    return this.runAI(
      userId,
      {
        messages: [{ role: 'user', content: getCOOPrompt(fileContent) }],
        temperature: 0.7,
        max_tokens: 800
      },
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
    }, this.environment);
  }

  // Board Consultation Methods for CEO Chat

  /**
   * Determine which board members should be consulted
   */
  private async decideBoardConsultation(
    userMessage: string,
    userId: string,
    requestId: string
  ): Promise<BoardConsultationDecision> {
    try {
      const result = await this.runAI(
        userId,
        {
          messages: [{ role: 'user', content: getBoardConsultationDecisionPrompt(userMessage) }],
          temperature: 0.3, // Low temperature for consistent decision-making
          max_tokens: 200
        },
        'Board Consultation Decision'
      );

      if (!result.success) {
        console.warn('Board consultation decision failed, defaulting to no consultation');
        return { executives: [], reasoning: 'Decision step failed - CEO will respond directly' };
      }

      const content = result.data?.choices[0]?.message?.content || '{}';

      // Parse JSON response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn('No valid JSON found in decision response, defaulting to no consultation');
        return { executives: [], reasoning: 'Invalid response format - CEO will respond directly' };
      }

      const decision = JSON.parse(jsonMatch[0]) as BoardConsultationDecision;

      // Validate executives array
      const validExecutives = ['CFO', 'CMO', 'COO'];
      decision.executives = decision.executives.filter(exec => validExecutives.includes(exec));

      console.log(`Board consultation decision: ${decision.executives.join(', ') || 'None'} - ${decision.reasoning}`);

      return decision;

    } catch (error) {
      console.error('Error in board consultation decision:', error);
      return { executives: [], reasoning: 'Error in decision step - CEO will respond directly' };
    }
  }

  /**
   * Consult with CFO
   */
  private async consultCFO(
    conversationHistory: string,
    userQuestion: string,
    userId: string = 'anonymous'
  ): Promise<ExecutiveConsultation> {
    const result = await this.runAI(
      userId,
      {
        messages: [{ role: 'user', content: getCFOChatPrompt(conversationHistory, userQuestion) }],
        temperature: 0.7,
        max_tokens: 400
      },
      'CFO Consultation'
    );

    return {
      role: 'CFO',
      advice: new StreamThinkingFilter().process(result.data?.choices[0]?.message?.content || 'CFO advice unavailable'),
      duration: result.totalDuration,
      attempts: result.attempts,
      success: result.success
    };
  }

  /**
   * Consult with CMO
   */
  private async consultCMO(
    conversationHistory: string,
    userQuestion: string,
    userId: string = 'anonymous'
  ): Promise<ExecutiveConsultation> {
    const result = await this.runAI(
      userId,
      {
        messages: [{ role: 'user', content: getCMOChatPrompt(conversationHistory, userQuestion) }],
        temperature: 0.7,
        max_tokens: 400
      },
      'CMO Consultation'
    );

    return {
      role: 'CMO',
      advice: new StreamThinkingFilter().process(result.data?.choices[0]?.message?.content || 'CMO advice unavailable'),
      duration: result.totalDuration,
      attempts: result.attempts,
      success: result.success
    };
  }

  /**
   * Consult with COO
   */
  private async consultCOO(
    conversationHistory: string,
    userQuestion: string,
    userId: string = 'anonymous'
  ): Promise<ExecutiveConsultation> {
    const result = await this.runAI(
      userId,
      {
        messages: [{ role: 'user', content: getCOOChatPrompt(conversationHistory, userQuestion) }],
        temperature: 0.7,
        max_tokens: 400
      },
      'COO Consultation'
    );

    return {
      role: 'COO',
      advice: new StreamThinkingFilter().process(result.data?.choices[0]?.message?.content || 'COO advice unavailable'),
      duration: result.totalDuration,
      attempts: result.attempts,
      success: result.success
    };
  }

  /**
   * Execute parallel consultations with selected executives
   */
  private async executeExecutiveConsultations(
    executives: ('CFO' | 'CMO' | 'COO')[],
    conversationHistory: string,
    userQuestion: string,
    userId: string = 'anonymous'
  ): Promise<ExecutiveConsultation[]> {
    if (executives.length === 0) {
      return [];
    }

    const consultationPromises = executives.map(exec => {
      switch (exec) {
        case 'CFO':
          return this.consultCFO(conversationHistory, userQuestion, userId);
        case 'CMO':
          return this.consultCMO(conversationHistory, userQuestion, userId);
        case 'COO':
          return this.consultCOO(conversationHistory, userQuestion, userId);
      }
    });

    const consultations = await Promise.all(consultationPromises);

    // Filter out failed consultations but don't fail the entire request
    return consultations.filter(c => c.success);
  }

  /**
   * Format conversation history from messages array
   */
  private formatConversationHistory(messages: { role: string; content: string }[]): string {
    if (messages.length === 0) {
      return 'No previous conversation.';
    }

    return messages
      .map(msg => {
        const role = msg.role === 'user' ? 'User' : msg.role === 'assistant' ? 'CEO' : 'System';
        return `${role}: ${msg.content}`;
      })
      .join('\n\n');
  }

  /**
   * Fetch brand document content for user
   */
  private async fetchBrandContext(
    userId: string,
    db: SqlDatabase,
    bucket: Bucket
  ): Promise<string | null> {
    try {
      const logger = new LoggerService(this.posthogKey, this.environment);
      const databaseService = new DatabaseService(db, logger);
      const storageService = new StorageService(bucket);

      // Get active brand document
      const brandDoc = await databaseService.getActiveBrandDocument(userId);

      if (!brandDoc) {
        console.log('No active brand document found for user:', userId);
        return null;
      }

      // Fetch document content
      const file = await storageService.get(brandDoc.documentKey);

      if (!file) {
        console.warn('Brand document not found in storage:', brandDoc.documentKey);
        return null;
      }

      // Read text content
      const text = await file.text();
      console.log(`Loaded brand document for user ${userId}: ${text.length} chars`);

      return text;
    } catch (error) {
      console.error('Error fetching brand context:', error);
      return null; // Graceful degradation
    }
  }
}
