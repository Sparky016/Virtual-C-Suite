import {
  BucketEventNotification,
  Each,
  Message,
} from "@liquidmetal-ai/raindrop-framework";
import { Env } from './raindrop.gen';
import { getCFOPrompt, getCMOPrompt, getCOOPrompt, getCEOSynthesisPrompt, formatFinalReport } from '../shared/prompts';
import { retryAICall, RetryResult } from '../shared/retry-logic';
import { trackEvent, trackAIPerformance, AnalyticsEvents } from '../shared/analytics';

interface ProcessorEnv extends Env {
  POSTHOG_API_KEY?: string;
}

export default class extends Each<BucketEventNotification, Env> {
  async process(message: Message<BucketEventNotification>): Promise<void> {
    const event = message.body;

    console.log('Bucket event received:', {
      action: event.action,
      bucket: event.bucket,
      objectKey: event.object.key,
      size: event.object.size,
      eventTime: event.eventTime,
      timestamp: new Date().toISOString()
    });

    if (event.action === 'PutObject' || event.action === 'CompleteMultipartUpload') {
      await this.handleFileUpload(event);
    }
  }

  // === File Upload Handler ===
  private async handleFileUpload(event: BucketEventNotification): Promise<void> {
    const startTime = Date.now();
    let requestId: string | undefined;

    try {
      console.log(`Processing uploaded file: ${event.object.key}`);

      // Extract request ID from object metadata or key
      const file = await this.env.INPUT_BUCKET.get(event.object.key);
      if (!file) {
        console.error('File not found in bucket:', event.object.key);
        return;
      }

      requestId = file.customMetadata?.requestId as string;
      if (!requestId) {
        console.error('No requestId in metadata');
        return;
      }

      console.log(`Starting analysis for request: ${requestId}`);

      // Track analysis started
      const userId = file.customMetadata?.userId as string || 'unknown';
      trackEvent((this.env as ProcessorEnv).POSTHOG_API_KEY, userId, AnalyticsEvents.ANALYSIS_STARTED, {
        request_id: requestId,
        file_key: event.object.key
      });

      // Read file content
      const fileContent = await file.text();
      console.log(`File content length: ${fileContent.length} characters`);

      // SCATTER: Parallel AI analysis from three expert perspectives with retry logic
      console.log('Starting parallel AI analysis with retry support...');
      const aiStartTime = Date.now();

      const [cfoRetryResult, cmoRetryResult, cooRetryResult] = await Promise.all([
        // CFO Analysis with retry
        retryAICall(
          this.env.AI,
          'llama-3.3-70b',
          {
            model: 'llama-3.3-70b',
            messages: [{ role: 'user', content: getCFOPrompt(fileContent) }],
            temperature: 0.7,
            max_tokens: 800
          },
          undefined, // Use default retry config
          'CFO Analysis'
        ),

        // CMO Analysis with retry
        retryAICall(
          this.env.AI,
          'llama-3.3-70b',
          {
            model: 'llama-3.3-70b',
            messages: [{ role: 'user', content: getCMOPrompt(fileContent) }],
            temperature: 0.7,
            max_tokens: 800
          },
          undefined,
          'CMO Analysis'
        ),

        // COO Analysis with retry
        retryAICall(
          this.env.AI,
          'llama-3.3-70b',
          {
            model: 'llama-3.3-70b',
            messages: [{ role: 'user', content: getCOOPrompt(fileContent) }],
            temperature: 0.7,
            max_tokens: 800
          },
          undefined,
          'COO Analysis'
        )
      ]);

      const aiDuration = Date.now() - aiStartTime;
      console.log(`Parallel AI analysis completed in ${aiDuration}ms (CFO: ${cfoRetryResult.attempts} attempts, CMO: ${cmoRetryResult.attempts} attempts, COO: ${cooRetryResult.attempts} attempts)`);

      // Check if any AI call failed after retries
      if (!cfoRetryResult.success || !cmoRetryResult.success || !cooRetryResult.success) {
        const failedRoles = [
          !cfoRetryResult.success ? 'CFO' : null,
          !cmoRetryResult.success ? 'CMO' : null,
          !cooRetryResult.success ? 'COO' : null
        ].filter(Boolean);

        throw new Error(`AI analysis failed for: ${failedRoles.join(', ')}. Errors: ${[cfoRetryResult.error?.message, cmoRetryResult.error?.message, cooRetryResult.error?.message].filter(Boolean).join('; ')}`);
      }

      // Extract analysis text from successful results
      const cfoAnalysis = cfoRetryResult.data?.choices[0]?.message?.content || 'Analysis unavailable';
      const cmoAnalysis = cmoRetryResult.data?.choices[0]?.message?.content || 'Analysis unavailable';
      const cooAnalysis = cooRetryResult.data?.choices[0]?.message?.content || 'Analysis unavailable';

      // Track AI performance for each executive
      trackAIPerformance((this.env as ProcessorEnv).POSTHOG_API_KEY, userId, 'CFO', cfoRetryResult.totalDuration, cfoRetryResult.attempts, cfoRetryResult.success, { request_id: requestId });
      trackAIPerformance((this.env as ProcessorEnv).POSTHOG_API_KEY, userId, 'CMO', cmoRetryResult.totalDuration, cmoRetryResult.attempts, cmoRetryResult.success, { request_id: requestId });
      trackAIPerformance((this.env as ProcessorEnv).POSTHOG_API_KEY, userId, 'COO', cooRetryResult.totalDuration, cooRetryResult.attempts, cooRetryResult.success, { request_id: requestId });

      // Track individual executive analyses completed
      trackEvent((this.env as ProcessorEnv).POSTHOG_API_KEY, userId, AnalyticsEvents.CFO_ANALYSIS_COMPLETED, { request_id: requestId, duration_ms: cfoRetryResult.totalDuration });
      trackEvent((this.env as ProcessorEnv).POSTHOG_API_KEY, userId, AnalyticsEvents.CMO_ANALYSIS_COMPLETED, { request_id: requestId, duration_ms: cmoRetryResult.totalDuration });
      trackEvent((this.env as ProcessorEnv).POSTHOG_API_KEY, userId, AnalyticsEvents.COO_ANALYSIS_COMPLETED, { request_id: requestId, duration_ms: cooRetryResult.totalDuration });

      // Store individual executive analyses in database
      const createdAt = Date.now();
      await Promise.all([
        this.env.TRACKING_DB.prepare(
          `INSERT INTO executive_analyses (request_id, executive_role, analysis_text, created_at)
           VALUES (?, ?, ?, ?)`
        ).bind(requestId, 'CFO', cfoAnalysis, createdAt).run(),

        this.env.TRACKING_DB.prepare(
          `INSERT INTO executive_analyses (request_id, executive_role, analysis_text, created_at)
           VALUES (?, ?, ?, ?)`
        ).bind(requestId, 'CMO', cmoAnalysis, createdAt).run(),

        this.env.TRACKING_DB.prepare(
          `INSERT INTO executive_analyses (request_id, executive_role, analysis_text, created_at)
           VALUES (?, ?, ?, ?)`
        ).bind(requestId, 'COO', cooAnalysis, createdAt).run()
      ]);

      // GATHER: CEO Synthesis with retry logic
      console.log('Starting CEO synthesis with retry support...');
      const synthesisStartTime = Date.now();

      const ceoRetryResult = await retryAICall(
        this.env.AI,
        'llama-3.3-70b',
        {
          model: 'llama-3.3-70b',
          messages: [{ role: 'user', content: getCEOSynthesisPrompt(cfoAnalysis, cmoAnalysis, cooAnalysis) }],
          temperature: 0.8,
          max_tokens: 1000
        },
        undefined,
        'CEO Synthesis'
      );

      const synthesisDuration = Date.now() - synthesisStartTime;
      console.log(`CEO synthesis completed in ${synthesisDuration}ms (${ceoRetryResult.attempts} attempts)`);

      // Check if CEO synthesis failed after retries
      if (!ceoRetryResult.success) {
        throw new Error(`CEO synthesis failed after ${ceoRetryResult.attempts} attempts: ${ceoRetryResult.error?.message}`);
      }

      const ceoSynthesis = ceoRetryResult.data?.choices[0]?.message?.content || 'Synthesis unavailable';

      // Track CEO synthesis performance
      trackAIPerformance((this.env as ProcessorEnv).POSTHOG_API_KEY, userId, 'CEO', ceoRetryResult.totalDuration, ceoRetryResult.attempts, ceoRetryResult.success, { request_id: requestId });
      trackEvent((this.env as ProcessorEnv).POSTHOG_API_KEY, userId, AnalyticsEvents.CEO_SYNTHESIS_COMPLETED, { request_id: requestId, duration_ms: ceoRetryResult.totalDuration });

      // Generate final report
      const finalReport = formatFinalReport(
        requestId,
        cfoAnalysis,
        cmoAnalysis,
        cooAnalysis,
        ceoSynthesis
      );

      // Save report to output bucket
      const reportKey = `reports/${requestId}/final-report.md`;
      await this.env.OUTPUT_BUCKET.put(reportKey, finalReport);

      // Store final report in database
      const reportCreatedAt = Date.now();
      await this.env.TRACKING_DB.prepare(
        `INSERT INTO final_reports (request_id, report_content, report_key, created_at)
         VALUES (?, ?, ?, ?)`
      ).bind(requestId, finalReport, reportKey, reportCreatedAt).run();

      // Update request status to completed
      const completedAt = Date.now();
      await this.env.TRACKING_DB.prepare(
        `UPDATE analysis_requests
         SET status = ?, completed_at = ?
         WHERE request_id = ?`
      ).bind('completed', completedAt, requestId).run();

      const totalDuration = Date.now() - startTime;
      console.log(`Total processing completed in ${totalDuration}ms for request ${requestId}`);

      // Track report generation and analysis completion
      trackEvent((this.env as ProcessorEnv).POSTHOG_API_KEY, userId, AnalyticsEvents.REPORT_GENERATED, {
        request_id: requestId,
        total_duration_ms: totalDuration,
        ai_duration_ms: aiDuration,
        synthesis_duration_ms: synthesisDuration
      });

      trackEvent((this.env as ProcessorEnv).POSTHOG_API_KEY, userId, AnalyticsEvents.ANALYSIS_COMPLETED, {
        request_id: requestId,
        total_duration_ms: totalDuration,
        total_duration_seconds: (totalDuration / 1000).toFixed(2)
      });

    } catch (error) {
      console.error('Error processing file:', error);

      // Update request status to failed
      if (requestId) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const userId = (await this.env.INPUT_BUCKET.get(event.object.key))?.customMetadata?.userId as string || 'unknown';

        // Track analysis failure
        trackEvent((this.env as ProcessorEnv).POSTHOG_API_KEY, userId, AnalyticsEvents.ANALYSIS_FAILED, {
          request_id: requestId,
          error: errorMessage,
          duration_ms: Date.now() - startTime
        });

        await this.env.TRACKING_DB.prepare(
          `UPDATE analysis_requests
           SET status = ?, error_message = ?
           WHERE request_id = ?`
        ).bind('failed', errorMessage, requestId).run();
      }
    }
  }
}
