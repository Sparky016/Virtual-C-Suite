import {
  BucketEventNotification,
  Each,
  Message,
} from "@liquidmetal-ai/raindrop-framework";
import { Env } from './raindrop.gen';
import { formatFinalReport } from '../shared/prompts';
import { trackEvent, AnalyticsEvents } from '../analytics/analytics';
import { DatabaseService } from '../services/DatabaseService';
import { StorageService } from '../services/StorageService';
import { AIOrchestrationService } from '../services/AIOrchestrationService';

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

    // Initialize Services
    const inputStorage = new StorageService(this.env.INPUT_BUCKET);
    const outputStorage = new StorageService(this.env.OUTPUT_BUCKET);
    const dbService = new DatabaseService(this.env.TRACKING_DB);
    const aiService = new AIOrchestrationService(this.env.AI, (this.env as ProcessorEnv).POSTHOG_API_KEY);

    try {
      console.log(`Processing uploaded file: ${event.object.key}`);

      // Extract request ID from object metadata or key
      const file = await inputStorage.get(event.object.key);
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

      // Execute Executive Analyses (CFO, CMO, COO)
      const executives = await aiService.executeExecutiveAnalyses({ fileContent, requestId, userId });

      // Save individual analyses
      const analysisCreatedAt = Date.now();
      await Promise.all([
        dbService.createExecutiveAnalysis(requestId, 'CFO', executives.cfo.analysis, analysisCreatedAt),
        dbService.createExecutiveAnalysis(requestId, 'CMO', executives.cmo.analysis, analysisCreatedAt),
        dbService.createExecutiveAnalysis(requestId, 'COO', executives.coo.analysis, analysisCreatedAt)
      ]);

      // Execute CEO Synthesis
      const ceo = await aiService.executeCEOSynthesis(
        { fileContent, requestId, userId },
        executives.cfo.analysis,
        executives.cmo.analysis,
        executives.coo.analysis
      );

      // Generate final report
      const finalReport = formatFinalReport(
        requestId,
        executives.cfo.analysis,
        executives.cmo.analysis,
        executives.coo.analysis,
        ceo.synthesis
      );

      // Save report to output bucket
      const reportKey = `reports/${requestId}/final-report.md`;
      await outputStorage.put(reportKey, finalReport);

      // Store final report in database
      await dbService.createFinalReport(requestId, finalReport, reportKey, Date.now());

      // Update request status to completed
      await dbService.updateAnalysisRequestStatus(requestId, 'completed', undefined, Date.now());

      const totalDuration = Date.now() - startTime;
      console.log(`Total processing completed in ${totalDuration}ms for request ${requestId}`);

      // Track report generation and analysis completion
      trackEvent((this.env as ProcessorEnv).POSTHOG_API_KEY, userId, AnalyticsEvents.REPORT_GENERATED, {
        request_id: requestId,
        total_duration_ms: totalDuration,
        ai_duration_ms: (executives.cfo.duration + executives.cmo.duration + executives.coo.duration) / 3, // Avg duration
        synthesis_duration_ms: ceo.duration
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
        const userId = 'unknown';

        // Track analysis failure
        trackEvent((this.env as ProcessorEnv).POSTHOG_API_KEY, userId, AnalyticsEvents.ANALYSIS_FAILED, {
          request_id: requestId,
          error: errorMessage,
          duration_ms: Date.now() - startTime
        });

        await dbService.updateAnalysisRequestStatus(requestId, 'failed', errorMessage);
      }
    }
  }
}
