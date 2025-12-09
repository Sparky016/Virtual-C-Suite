// Report Service - Handles report retrieval and validation
import { DatabaseService, AnalysisRequest, FinalReport } from './Database/DatabaseService';
import { LoggerService } from './Logger/LoggerService';

export interface ReportResult {
  requestId: string;
  status: string;
  report?: string;
  completedAt?: string;
  error?: string;
  message?: string;
}

export class ReportService {
  private databaseService: DatabaseService;
  private logger: LoggerService;

  constructor(databaseService: DatabaseService, logger: LoggerService) {
    this.databaseService = databaseService;
    this.logger = logger;
  }

  /**
   * Get report for a completed analysis request
   */
  async getReport(requestId: string): Promise<ReportResult> {
    // Get request from database
    const request = await this.databaseService.getAnalysisRequest(requestId);

    if (!request) {
      return {
        requestId,
        status: 'not_found',
        error: 'Request not found'
      };
    }

    // Check if request is still processing
    if (request.status === 'processing' || request.status === 'pending') {
      return {
        requestId,
        status: request.status,
        message: 'Analysis in progress'
      };
    }

    // Check if request failed
    if (request.status === 'failed') {
      return {
        requestId,
        status: 'failed',
        error: request.error_message || 'Analysis failed'
      };
    }

    // Get final report
    const report = await this.databaseService.getFinalReport(requestId);

    if (!report) {
      return {
        requestId,
        status: 'not_found',
        error: 'Report not found'
      };
    }

    // Track report retrieval
    this.logger.trackReportRetrieved(requestId, new Date(report.created_at).toISOString());

    return {
      requestId,
      status: 'completed',
      report: report.report_content,
      completedAt: new Date(report.created_at).toISOString()
    };
  }
}
