// Analysis Request Repository - Data access for analysis requests
export interface AnalysisRequest {
  requestId: string;
  userId: string;
  fileKey: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: number;
  completedAt?: number;
  errorMessage?: string;
}

export class AnalysisRequestRepository {
  private db: any;

  constructor(db: any) {
    this.db = db;
  }

  /**
   * Create a new analysis request
   */
  async create(request: Omit<AnalysisRequest, 'completedAt' | 'errorMessage'>): Promise<void> {
    await this.db.prepare(
      `INSERT INTO analysis_requests (request_id, user_id, file_key, status, created_at)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(
      request.requestId,
      request.userId,
      request.fileKey,
      request.status,
      request.createdAt
    ).run();
  }

  /**
   * Find request by ID
   */
  async findById(requestId: string): Promise<AnalysisRequest | null> {
    const result = await this.db.prepare(
      `SELECT * FROM analysis_requests WHERE request_id = ?`
    ).bind(requestId).first();

    return result || null;
  }

  /**
   * Update request status
   */
  async updateStatus(
    requestId: string,
    status: AnalysisRequest['status'],
    completedAt?: number,
    errorMessage?: string
  ): Promise<void> {
    if (errorMessage) {
      await this.db.prepare(
        `UPDATE analysis_requests
         SET status = ?, error_message = ?, completed_at = ?
         WHERE request_id = ?`
      ).bind(status, errorMessage, completedAt, requestId).run();
    } else {
      await this.db.prepare(
        `UPDATE analysis_requests
         SET status = ?, completed_at = ?
         WHERE request_id = ?`
      ).bind(status, completedAt, requestId).run();
    }
  }

  /**
   * Count requests for user in time window
   */
  async countUserRequestsSince(userId: string, since: number): Promise<number> {
    const result = await this.db.prepare(
      `SELECT COUNT(*) as count
       FROM analysis_requests
       WHERE user_id = ? AND created_at >= ?`
    ).bind(userId, since).first();

    return (result?.count as number) || 0;
  }

  /**
   * Get oldest request time for user in window
   */
  async getOldestRequestTime(userId: string, since: number): Promise<number | null> {
    const result = await this.db.prepare(
      `SELECT MIN(created_at) as oldest
       FROM analysis_requests
       WHERE user_id = ? AND created_at >= ?`
    ).bind(userId, since).first();

    return result?.oldest as number || null;
  }
}
