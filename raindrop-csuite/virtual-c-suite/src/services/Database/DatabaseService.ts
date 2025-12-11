// Database Service - Abstracts all database operations for testability
import { SqlDatabase } from '@liquidmetal-ai/raindrop-framework';
import { LoggerService } from '../Logger/LoggerService';
import { BrandDocument } from '../../shared/types';

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
  private logger: LoggerService;

  constructor(db: SqlDatabase, logger: LoggerService) {
    this.db = db;
    this.logger = logger;
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
    this.logger.info(`Creating analysis request`, { requestId, userId, status });
    const createdAt = Date.now();
    try {
      await this.db.prepare(
        `INSERT INTO analysis_requests (request_id, user_id, file_key, status, created_at)
       VALUES (?, ?, ?, ?, ?)`
      ).bind(requestId, userId, fileKey, status, createdAt).run();
      this.logger.info(`Analysis request created successfully: ${requestId}`);
    } catch (error: any) {
      this.logger.error(`Failed to create analysis request: ${requestId}`, error);
      throw error;
    }
  }

  /**
   * Get analysis request by ID
   */
  async getAnalysisRequest(requestId: string): Promise<AnalysisRequest | null> {
    try {
      const result = await this.db.prepare(
        `SELECT request_id, user_id, file_key, status, created_at, completed_at, error_message
       FROM analysis_requests
       WHERE request_id = ?`
      ).bind(requestId).first();

      if (!result) {
        this.logger.warn(`Analysis request not found: ${requestId}`);
        return null;
      }

      return result as unknown as AnalysisRequest;
    } catch (error: any) {
      this.logger.error(`Failed to get analysis request: ${requestId}`, error);
      throw error;
    }
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
    this.logger.info(`Updating analysis request status: ${requestId}`, { status, hasError: !!errorMessage });
    const completedTime = completedAt || Date.now();

    try {
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
      this.logger.info(`Analysis request status updated: ${requestId}`);
    } catch (error: any) {
      this.logger.error(`Failed to update analysis request status: ${requestId}`, error);
      throw error;
    }
  }

  /**
   * Get executive analyses for a request
   */
  async getExecutiveAnalyses(requestId: string): Promise<ExecutiveAnalysis[]> {
    try {
      const result = await this.db.prepare(
        `SELECT executive_role, analysis_text
       FROM executive_analyses
       WHERE request_id = ?`
      ).bind(requestId).all();

      return result.results as unknown as ExecutiveAnalysis[];
    } catch (error: any) {
      this.logger.error(`Failed to get executive analyses: ${requestId}`, error);
      throw error;
    }
  }

  /**
   * Get final report for a request
   */
  async getFinalReport(requestId: string): Promise<FinalReport | null> {
    try {
      const result = await this.db.prepare(
        `SELECT report_content, report_key, created_at
       FROM final_reports
       WHERE request_id = ?`
      ).bind(requestId).first();

      if (!result) {
        this.logger.warn(`Final report not found: ${requestId}`);
        return null;
      }

      return result as unknown as FinalReport;
    } catch (error: any) {
      this.logger.error(`Failed to get final report: ${requestId}`, error);
      throw error;
    }
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
    this.logger.info(`Creating executive analysis`, { requestId, role: executiveRole });
    try {
      await this.db.prepare(
        `INSERT INTO executive_analyses (request_id, executive_role, analysis_text, created_at)
       VALUES (?, ?, ?, ?)`
      ).bind(requestId, executiveRole, analysisText, createdAt).run();
      this.logger.info(`Executive analysis created successfully: ${requestId} - ${executiveRole}`);
    } catch (error: any) {
      this.logger.error(`Failed to create executive analysis: ${requestId}`, error);
      throw error;
    }
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
    this.logger.info(`Creating final report: ${requestId}`);
    try {
      await this.db.prepare(
        `INSERT INTO final_reports (request_id, report_content, report_key, created_at)
       VALUES (?, ?, ?, ?)`
      ).bind(requestId, reportContent, reportKey, createdAt).run();
      this.logger.info(`Final report created successfully: ${requestId}`);
    } catch (error: any) {
      this.logger.error(`Failed to create final report: ${requestId}`, error);
      throw error;
    }
  }

  /**
   * Get active brand document for a user
   */
  async getActiveBrandDocument(userId: string): Promise<BrandDocument | null> {
    try {
      const result = await this.db.prepare(
        `SELECT * FROM brand_documents
         WHERE user_id = ? AND status = 'active'`
      ).bind(userId).first();

      if (!result) {
        return null;
      }

      return result as unknown as BrandDocument;
    } catch (error: any) {
      this.logger.error(`Failed to get active brand document: ${userId}`, error);
      throw error;
    }
  }

  /**
   * Deactivate all brand documents for a user
   */
  async deactivateAllBrandDocuments(userId: string): Promise<void> {
    try {
      await this.db.prepare(
        `UPDATE brand_documents
         SET status = 'inactive', updated_at = ?
         WHERE user_id = ? AND status = 'active'`
      ).bind(Date.now(), userId).run();

      this.logger.info(`Deactivated brand documents for user: ${userId}`);
    } catch (error: any) {
      this.logger.error(`Failed to deactivate brand documents: ${userId}`, error);
      throw error;
    }
  }

  /**
   * Create brand document record
   */
  async createBrandDocument(doc: BrandDocument): Promise<number> {
    try {
      const result = await this.db.prepare(
        `INSERT INTO brand_documents
         (user_id, document_key, original_filename, file_size, content_type, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        doc.userId,
        doc.documentKey,
        doc.originalFilename,
        doc.fileSize,
        doc.contentType,
        doc.status,
        doc.createdAt,
        doc.updatedAt
      ).run();

      this.logger.info(`Brand document created: ${doc.documentKey}`);
      return result.meta.last_row_id as number;
    } catch (error: any) {
      this.logger.error(`Failed to create brand document`, error);
      throw error;
    }
  }

  /**
   * Delete brand document record
   */
  async deleteBrandDocument(userId: string, documentId: number): Promise<void> {
    try {
      await this.db.prepare(
        `DELETE FROM brand_documents
         WHERE id = ? AND user_id = ?`
      ).bind(documentId, userId).run();

      this.logger.info(`Deleted brand document: ${documentId} for user: ${userId}`);
    } catch (error: any) {
      this.logger.error(`Failed to delete brand document: ${documentId}`, error);
      throw error;
    }
  }
}

