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

export class AIOrchestrationService {
  private aiClient: any;
  private posthogKey?: string;
  private environment?: string;
  private model: string = 'llama-3.3-70b';

  constructor(aiClient: any, posthogKey?: string, environment?: string) {
    this.aiClient = aiClient;
    this.posthogKey = posthogKey;
    this.environment = environment;
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
    userId: string
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
          latestUserMessage
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

      const synthesisResult = await retryAICall(
        this.aiClient,
        this.model,
        {
          model: this.model,
          messages: [{
            role: 'user',
            content: getCEOChatSynthesisPrompt(conversationHistory, latestUserMessage, boardAdvice)
          }],
          temperature: 0.7,
          max_tokens: 1000
        },
        undefined,
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

        const fallbackResult = await retryAICall(
          this.aiClient,
          this.model,
          {
            model: this.model,
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
    userId: string
  ): AsyncGenerator<CEOChatStreamEvent> {
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
      let synthesisAttempts = 1;

      try {
        // Stream the CEO response token by token
        const stream = await this.aiClient.run(this.model, {
          messages: [{
            role: 'user',
            content: getCEOChatSynthesisPrompt(conversationHistory, latestUserMessage, boardAdvice)
          }],
          temperature: 0.7,
          max_tokens: 1000,
          stream: true
        });

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
                      reply += token;

                      // Yield each token as it arrives
                      yield {
                        type: 'synthesis_chunk',
                        data: {
                          token,
                          accumulated: reply
                        }
                      };
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
              reply += token;

              // Yield each token as it arrives
              yield {
                type: 'synthesis_chunk',
                data: {
                  token,
                  accumulated: reply
                }
              };
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
        console.error('Streaming synthesis failed, falling back to non-streaming:', streamError);

        // Fallback to non-streaming if streaming fails
        const synthesisResult = await retryAICall(
          this.aiClient,
          this.model,
          {
            model: this.model,
            messages: [{
              role: 'user',
              content: getCEOChatSynthesisPrompt(conversationHistory, latestUserMessage, boardAdvice)
            }],
            temperature: 0.7,
            max_tokens: 1000
          },
          undefined,
          'CEO Chat Synthesis Fallback'
        );

        if (!synthesisResult.success) {
          throw new Error('CEO synthesis failed');
        }

        reply = synthesisResult.data?.choices[0]?.message?.content || 'I apologize, but I was unable to generate a response.';
        synthesisAttempts = synthesisResult.attempts;

        // Yield the complete response
        yield {
          type: 'synthesis_complete',
          data: {
            reply
          }
        };
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
          const stream = await this.aiClient.run(this.model, {
            messages: [
              { role: 'system', content: "You are the CEO of my company with my company's best interest at heart." },
              ...messages
            ],
            temperature: 0.7,
            max_tokens: 1000,
            stream: true
          });

          let reply = '';

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
                        reply += token;

                        yield {
                          type: 'synthesis_chunk',
                          data: {
                            token,
                            accumulated: reply
                          }
                        };
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
                reply += token;

                yield {
                  type: 'synthesis_chunk',
                  data: {
                    token,
                    accumulated: reply
                  }
                };
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
          console.error('Streaming fallback failed, trying non-streaming:', streamFallbackError);

          // Non-streaming fallback
          const fallbackResult = await retryAICall(
            this.aiClient,
            this.model,
            {
              model: this.model,
              messages: [
                { role: 'system', content: "You are the CEO of my company with my company's best interest at heart." },
                ...messages
              ],
              temperature: 0.7,
              max_tokens: 1000
            },
            undefined,
            'CEO Chat Fallback Non-Stream'
          );

          if (fallbackResult.success) {
            const reply = fallbackResult.data?.choices[0]?.message?.content || 'I apologize, but I was unable to generate a response.';

            // Track fallback performance
            if (this.posthogKey) {
              trackAIPerformance(
                this.posthogKey,
                userId,
                'CEO_CHAT_STREAM_FALLBACK_NON_STREAM',
                totalDuration,
                fallbackResult.attempts,
                true,
                { request_id: requestId, streaming: false },
                this.environment
              );
            }

            // Yield synthesis complete event with fallback response
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
                attempts: fallbackResult.attempts
              }
            };

            return;
          }
        }
      } catch (fallbackError) {
        console.error('Fallback CEO response also failed:', fallbackError);
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
      const result = await retryAICall(
        this.aiClient,
        this.model,
        {
          model: this.model,
          messages: [{ role: 'user', content: getBoardConsultationDecisionPrompt(userMessage) }],
          temperature: 0.3, // Low temperature for consistent decision-making
          max_tokens: 200
        },
        undefined,
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
    userQuestion: string
  ): Promise<ExecutiveConsultation> {
    const result = await retryAICall(
      this.aiClient,
      this.model,
      {
        model: this.model,
        messages: [{ role: 'user', content: getCFOChatPrompt(conversationHistory, userQuestion) }],
        temperature: 0.7,
        max_tokens: 400
      },
      undefined,
      'CFO Consultation'
    );

    return {
      role: 'CFO',
      advice: result.data?.choices[0]?.message?.content || 'CFO advice unavailable',
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
    userQuestion: string
  ): Promise<ExecutiveConsultation> {
    const result = await retryAICall(
      this.aiClient,
      this.model,
      {
        model: this.model,
        messages: [{ role: 'user', content: getCMOChatPrompt(conversationHistory, userQuestion) }],
        temperature: 0.7,
        max_tokens: 400
      },
      undefined,
      'CMO Consultation'
    );

    return {
      role: 'CMO',
      advice: result.data?.choices[0]?.message?.content || 'CMO advice unavailable',
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
    userQuestion: string
  ): Promise<ExecutiveConsultation> {
    const result = await retryAICall(
      this.aiClient,
      this.model,
      {
        model: this.model,
        messages: [{ role: 'user', content: getCOOChatPrompt(conversationHistory, userQuestion) }],
        temperature: 0.7,
        max_tokens: 400
      },
      undefined,
      'COO Consultation'
    );

    return {
      role: 'COO',
      advice: result.data?.choices[0]?.message?.content || 'COO advice unavailable',
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
    userQuestion: string
  ): Promise<ExecutiveConsultation[]> {
    if (executives.length === 0) {
      return [];
    }

    const consultationPromises = executives.map(exec => {
      switch (exec) {
        case 'CFO':
          return this.consultCFO(conversationHistory, userQuestion);
        case 'CMO':
          return this.consultCMO(conversationHistory, userQuestion);
        case 'COO':
          return this.consultCOO(conversationHistory, userQuestion);
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
}
