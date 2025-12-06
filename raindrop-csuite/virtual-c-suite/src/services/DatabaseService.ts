// Database Service - Abstracts all database operations for testability
import { SqlDatabase } from '@liquidmetal-ai/raindrop-framework';

export interface AnalysisRequest {
  request_id: string;
  user_id: string;
  file_key: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  created_at: number;
  completed_at?: number;
  error_message?: string;
}

export interface ExecutiveAnalysis {
  executive_role: string;
  analysis_text: string;
}

export interface FinalReport {
  report_content: string;
  report_key: string;
  created_at: number;
}

export interface ProgressInfo {
  cfo: 'completed' | 'pending';
  cmo: 'completed' | 'pending';
  coo: 'completed' | 'pending';
  synthesis: 'completed' | 'pending';
}

export class DatabaseService {
  private db: SqlDatabase;

  constructor(db: SqlDatabase) {
    this.db = db;
  }

  /**
   * Create a new analysis request
   */
  async createAnalysisRequest(
    requestId: string,
    userId: string,
    fileKey: string,
    status: string = 'processing'
  ): Promise<void> {
    const createdAt = Date.now();
    await this.db.prepare(
      `INSERT INTO analysis_requests (request_id, user_id, file_key, status, created_at)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(requestId, userId, fileKey, status, createdAt).run();
  }

  /**
   * Get analysis request by ID
   */
  async getAnalysisRequest(requestId: string): Promise<AnalysisRequest | null> {
    const result = await this.db.prepare(
      `SELECT request_id, user_id, file_key, status, created_at, completed_at, error_message
       FROM analysis_requests
       WHERE request_id = ?`
    ).bind(requestId).first();

    return result as unknown as AnalysisRequest | null;
  }

  /**
   * Update analysis request status
   */
  async updateAnalysisRequestStatus(
    requestId: string,
    status: string,
    errorMessage?: string,
    completedAt?: number
  ): Promise<void> {
    const completedTime = completedAt || Date.now();

    if (errorMessage) {
      await this.db.prepare(
        `UPDATE analysis_requests
         SET status = ?, error_message = ?, completed_at = ?
         WHERE request_id = ?`
      ).bind(status, errorMessage, completedTime, requestId).run();
    } else {
      await this.db.prepare(
        `UPDATE analysis_requests
         SET status = ?, completed_at = ?
         WHERE request_id = ?`
      ).bind(status, completedTime, requestId).run();
    }
  }

  /**
   * Get executive analyses for a request
   */
  async getExecutiveAnalyses(requestId: string): Promise<ExecutiveAnalysis[]> {
    const result = await this.db.prepare(
      `SELECT executive_role, analysis_text
       FROM executive_analyses
       WHERE request_id = ?`
    ).bind(requestId).all();

    return result.results as unknown as ExecutiveAnalysis[];
  }

  /**
   * Get final report for a request
   */
  async getFinalReport(requestId: string): Promise<FinalReport | null> {
    const result = await this.db.prepare(
      `SELECT report_content, report_key, created_at
       FROM final_reports
       WHERE request_id = ?`
    ).bind(requestId).first();

    return result as unknown as FinalReport | null;
  }

  /**
   * Calculate progress based on executive analyses
   */
  calculateProgress(analyses: ExecutiveAnalysis[], requestStatus: string): ProgressInfo {
    return {
      cfo: analyses.some((a) => a.executive_role === 'CFO') ? 'completed' : 'pending',
      cmo: analyses.some((a) => a.executive_role === 'CMO') ? 'completed' : 'pending',
      coo: analyses.some((a) => a.executive_role === 'COO') ? 'completed' : 'pending',
      synthesis: requestStatus === 'completed' ? 'completed' : 'pending'
    };
  }

  /**
   * Create executive analysis record
   */
  async createExecutiveAnalysis(
    requestId: string,
    executiveRole: string,
    analysisText: string,
    createdAt: number
  ): Promise<void> {
    await this.db.prepare(
      `INSERT INTO executive_analyses (request_id, executive_role, analysis_text, created_at)
       VALUES (?, ?, ?, ?)`
    ).bind(requestId, executiveRole, analysisText, createdAt).run();
  }

  /**
   * Create final report record
   */
  async createFinalReport(
    requestId: string,
    reportContent: string,
    reportKey: string,
    createdAt: number
  ): Promise<void> {
    await this.db.prepare(
      `INSERT INTO final_reports (request_id, report_content, report_key, created_at)
       VALUES (?, ?, ?, ?)`
    ).bind(requestId, reportContent, reportKey, createdAt).run();
  }
}

