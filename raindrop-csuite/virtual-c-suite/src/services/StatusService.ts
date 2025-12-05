// Status Service - Handles status checking, timeout logic, and progress tracking
import { DatabaseService, AnalysisRequest, ProgressInfo } from './DatabaseService';
import { LoggerService } from './LoggerService';

export interface StatusCheckResult {
  requestId: string;
  status: string;
  progress?: ProgressInfo;
  createdAt: string;
  completedAt?: string;
  error?: string;
  message?: string;
  timedOut: boolean;
}

export class StatusService {
  private databaseService: DatabaseService;
  private logger: LoggerService;
  private timeoutMs: number;

  constructor(
    databaseService: DatabaseService,
    logger: LoggerService,
    timeoutMs: number = 5 * 60 * 1000 // 5 minutes default
  ) {
    this.databaseService = databaseService;
    this.logger = logger;
    this.timeoutMs = timeoutMs;
  }

  /**
   * Check if a request has timed out
   */
  hasTimedOut(request: AnalysisRequest): boolean {
    const now = Date.now();
    const elapsed = now - request.created_at;
    return request.status === 'processing' && elapsed > this.timeoutMs;
  }

  /**
   * Handle timeout for a request
   */
  async handleTimeout(requestId: string, request: AnalysisRequest): Promise<StatusCheckResult> {
    const now = Date.now();
    const elapsed = now - request.created_at;

    this.logger.warn(`Request ${requestId} timed out after ${elapsed}ms`);

    // Mark as failed due to timeout
    await this.databaseService.updateAnalysisRequestStatus(
      requestId,
      'failed',
      'Processing timeout exceeded (5 minutes)',
      now
    );

    return {
      requestId,
      status: 'failed',
      error: 'Processing timeout exceeded',
      message: 'Analysis took longer than expected. Please try again.',
      createdAt: new Date(request.created_at).toISOString(),
      completedAt: new Date(now).toISOString(),
      timedOut: true
    };
  }

  /**
   * Check status of an analysis request
   */
  async checkStatus(requestId: string): Promise<StatusCheckResult | null> {
    // Get request from database
    const request = await this.databaseService.getAnalysisRequest(requestId);

    if (!request) {
      return null;
    }

    // Check for timeout
    if (this.hasTimedOut(request)) {
      return await this.handleTimeout(requestId, request);
    }

    // Get progress information
    const analyses = await this.databaseService.getExecutiveAnalyses(requestId);
    const progress = this.databaseService.calculateProgress(analyses, request.status);

    // Track status check
    this.logger.trackStatusChecked(requestId, request.status, progress);

    return {
      requestId,
      status: request.status,
      progress,
      createdAt: new Date(request.created_at).toISOString(),
      completedAt: request.completed_at ? new Date(request.completed_at).toISOString() : undefined,
      timedOut: false
    };
  }
}
