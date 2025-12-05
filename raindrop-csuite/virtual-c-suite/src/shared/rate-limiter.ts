// Rate limiting utility for Virtual C-Suite
// Uses database to track upload attempts per user

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  blockDurationMs?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  message?: string;
}

// Default rate limit: 10 uploads per 15 minutes per user
export const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 10,
  windowMs: 15 * 60 * 1000, // 15 minutes
  blockDurationMs: 5 * 60 * 1000 // 5 minutes block if exceeded
};

export class RateLimiter {
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig = DEFAULT_RATE_LIMIT) {
    this.config = config;
  }

  /**
   * Check if a user has exceeded their rate limit
   * @param db Database connection
   * @param userId User identifier
   * @param maxRequestsOverride Optional override for max requests (e.g. from env)
   * @returns Rate limit result with allowed status
   */
  async checkLimit(db: any, userId: string, maxRequestsOverride?: number): Promise<RateLimitResult> {
    const maxRequests = maxRequestsOverride || this.config.maxRequests;
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    // Count requests in the current window
    const result = await db.prepare(
      `SELECT COUNT(*) as count
       FROM analysis_requests
       WHERE user_id = ? AND created_at >= ?`
    ).bind(userId, windowStart).first();

    const requestCount = (result?.count as number) || 0;
    const remaining = Math.max(0, this.config.maxRequests - requestCount);
    const allowed = requestCount < this.config.maxRequests;

    // Calculate reset time
    const oldestRequest = await db.prepare(
      `SELECT MIN(created_at) as oldest
       FROM analysis_requests
       WHERE user_id = ? AND created_at >= ?`
    ).bind(userId, windowStart).first();

    const resetAt = oldestRequest?.oldest
      ? (oldestRequest.oldest as number) + this.config.windowMs
      : now + this.config.windowMs;

    return {
      allowed,
      remaining,
      resetAt,
      message: allowed
        ? undefined
        : `Rate limit exceeded. ${requestCount} requests in the last ${this.config.windowMs / 60000} minutes. Try again in ${Math.ceil((resetAt - now) / 60000)} minutes.`
    };
  }

  /**
   * Check and optionally clean up old rate limit records
   * @param db Database connection
   * @param userId User identifier
   */
  async cleanupOldRecords(db: any, userId: string): Promise<void> {
    const cutoffTime = Date.now() - this.config.windowMs * 2; // Keep 2x window for safety

    await db.prepare(
      `DELETE FROM analysis_requests
       WHERE user_id = ? AND created_at < ? AND status IN ('failed', 'completed')`
    ).bind(userId, cutoffTime).run();
  }
}

/**
 * Get rate limit headers for HTTP responses
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': DEFAULT_RATE_LIMIT.maxRequests.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': new Date(result.resetAt).toISOString(),
    'Retry-After': Math.ceil((result.resetAt - Date.now()) / 1000).toString()
  };
}
