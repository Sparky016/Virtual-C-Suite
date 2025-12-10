import {
  BucketEventNotification,
  Each,
  Message,
} from "@liquidmetal-ai/raindrop-framework";
import { Env } from './raindrop.gen';
import { formatFinalReport } from '../shared/prompts';
import { trackEvent, AnalyticsEvents } from '../analytics/analytics';
import { DatabaseService } from '../services/Database/DatabaseService';
import { LoggerService } from '../services/Logger/LoggerService';
import { StorageService } from '../services/StorageService';
import { AIOrchestrationService } from '../services/AIOrchestrationService';

interface ProcessorEnv extends Env {
  POSTHOG_API_KEY?: string;
}

export default class extends Each<BucketEventNotification, Env> {
  async process(message: Message<BucketEventNotification>): Promise<void> {
    const event = message.body;
    // We can't use the service logger here easily without initializing it, 
    // but the processor creates a fresh one for each file upload anyway.
    // For the high level event logging, we might want to just keep console or init a temp logger.
    // However, the instructions say "Replace all... in board-meeting-processor".
    // Let's check if we can init a logger earlier or just rely on the one inside handleFileUpload.

    // Actually, looking at the code, handleFileUpload creates the logger. 
    // The top level process logs the event.

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
    const logger = new LoggerService((this.env as ProcessorEnv).POSTHOG_API_KEY);
    const dbService = new DatabaseService(this.env.TRACKING_DB, logger);
    const aiService = new AIOrchestrationService(this.env.AI, (this.env as ProcessorEnv).POSTHOG_API_KEY);

    try {
      logger.info(`Processing uploaded file: ${event.object.key}`, {
        action: event.action,
        bucket: event.bucket,
        size: event.object.size,
        eventTime: event.eventTime
      });

      // Extract request ID from object metadata or key
      const file = await inputStorage.get(event.object.key);
      if (!file) {
        logger.error('File not found in bucket', { key: event.object.key });
        return;
      }

      requestId = file.customMetadata?.requestId as string;
      if (!requestId) {
        logger.error('No requestId in metadata', { key: event.object.key });
        return;
      }

      logger.info(`Starting analysis for request: ${requestId}`);

      // Track analysis started
      const userId = file.customMetadata?.userId as string || 'unknown';
      trackEvent((this.env as ProcessorEnv).POSTHOG_API_KEY, userId, AnalyticsEvents.ANALYSIS_STARTED, {
        request_id: requestId,
        file_key: event.object.key
      });

      // Read file content
      const fileContent = await file.text();
      logger.info(`File content read`, { length: fileContent.length });

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
      logger.info(`Processing completed`, { requestId, totalDuration });

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
      logger.error('Error processing file', error);

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
