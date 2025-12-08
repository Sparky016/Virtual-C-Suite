// Logger Service - Centralizes all logging and analytics tracking
import { trackEvent, trackAIPerformance, AnalyticsEvents } from '../analytics/analytics';

export class LoggerService {
  private posthogKey?: string;

  constructor(posthogKey?: string) {
    this.posthogKey = posthogKey;
  }

  /**
   * Track a generic event
   */
  trackEvent(userId: string, event: string, properties?: Record<string, any>): void {
    trackEvent(this.posthogKey, userId, event, properties);
  }

  /**
   * Track AI performance metrics
   */
  trackAIPerformance(
    userId: string,
    role: 'CFO' | 'CMO' | 'COO' | 'CEO',
    duration: number,
    attempts: number,
    success: boolean,
    properties?: Record<string, any>
  ): void {
    trackAIPerformance(this.posthogKey, userId, role, duration, attempts, success, properties);
  }

  /**
   * Track rate limit check
   */
  trackRateLimitCheck(userId: string, allowed: boolean, remaining: number): void {
    this.trackEvent(userId, AnalyticsEvents.RATE_LIMIT_CHECKED, {
      allowed,
      remaining
    });
  }

  /**
   * Track rate limit exceeded
   */
  trackRateLimitExceeded(userId: string, message: string, remaining: number, resetAt: string): void {
    this.trackEvent(userId, AnalyticsEvents.RATE_LIMIT_EXCEEDED, {
      message,
      remaining,
      resetAt
    });
  }

  /**
   * Track file validation success
   */
  trackFileValidated(userId: string, fileName: string, fileType: string, fileSizeMB: string): void {
    this.trackEvent(userId, AnalyticsEvents.FILE_VALIDATED, {
      file_name: fileName,
      file_type: fileType,
      file_size_mb: fileSizeMB
    });
  }

  /**
   * Track file validation failure
   */
  trackFileValidationFailed(userId: string, reason: string, details: Record<string, any>): void {
    this.trackEvent(userId, AnalyticsEvents.FILE_VALIDATION_FAILED, {
      reason,
      ...details
    });
  }

  /**
   * Track successful file upload
   */
  trackFileUploaded(
    userId: string,
    requestId: string,
    fileName: string,
    fileType: string,
    fileSizeMB: string,
    fileKey: string
  ): void {
    this.trackEvent(userId, AnalyticsEvents.FILE_UPLOADED, {
      request_id: requestId,
      file_name: fileName,
      file_type: fileType,
      file_size_mb: fileSizeMB,
      file_key: fileKey
    });
  }

  /**
   * Track file upload failure
   */
  trackFileUploadFailed(userId: string, error: string): void {
    this.trackEvent(userId, AnalyticsEvents.FILE_UPLOAD_FAILED, {
      error
    });
  }

  /**
   * Track status check
   */
  trackStatusChecked(requestId: string, status: string, progress?: Record<string, any>): void {
    this.trackEvent('system', AnalyticsEvents.STATUS_CHECKED, {
      request_id: requestId,
      status,
      progress
    });
  }

  /**
   * Track report retrieval
   */
  trackReportRetrieved(requestId: string, completedAt: string): void {
    this.trackEvent('system', AnalyticsEvents.REPORT_RETRIEVED, {
      request_id: requestId,
      completed_at: completedAt
    });
  }

  /**
   * Log informational message
   */
  info(message: string, ...args: any[]): void {
    console.log(message, ...args);
  }

  /**
   * Log warning message
   */
  warn(message: string, ...args: any[]): void {
    console.warn(message, ...args);
  }

  /**
   * Log error message
   */
  error(message: string, ...args: any[]): void {
    console.error(message, ...args);
  }
}
