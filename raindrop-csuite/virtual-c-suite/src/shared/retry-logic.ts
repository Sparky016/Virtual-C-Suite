// Retry logic with exponential backoff for AI API calls
// Handles transient failures gracefully

export interface RetryConfig {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableErrors?: string[];
}

export interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  attempts: number;
  totalDuration: number;
}

// Default retry configuration for AI API calls
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelayMs: 1000, // 1 second
  maxDelayMs: 10000, // 10 seconds max
  backoffMultiplier: 2,
  retryableErrors: [
    'ECONNRESET',
    'ETIMEDOUT',
    'ECONNREFUSED',
    'ENETUNREACH',
    'EAI_AGAIN',
    '429', // Rate limit
    '500', // Internal server error
    '502', // Bad gateway
    '503', // Service unavailable
    '504'  // Gateway timeout
  ]
};

/**
 * Determines if an error is retryable based on configuration
 */
function isRetryableError(error: any, config: RetryConfig): boolean {
  if (!config.retryableErrors || config.retryableErrors.length === 0) {
    return true; // Retry all errors if no specific errors configured
  }

  const errorMessage = error?.message || error?.toString() || '';
  const errorCode = error?.code || error?.status?.toString() || '';

  return config.retryableErrors.some(retryableError =>
    errorMessage.includes(retryableError) || errorCode === retryableError
  );
}

/**
 * Calculate delay for next retry attempt using exponential backoff
 */
function calculateDelay(attempt: number, config: RetryConfig): number {
  const delay = config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt - 1);
  // Add jitter (random 0-20% variation) to prevent thundering herd
  const jitter = delay * 0.2 * Math.random();
  return Math.min(delay + jitter, config.maxDelayMs);
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry an async function with exponential backoff
 * @param fn Function to retry
 * @param config Retry configuration
 * @param context Optional context for logging
 * @returns Promise with retry result
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
  context?: string
): Promise<RetryResult<T>> {
  const startTime = Date.now();
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      const data = await fn();
      const totalDuration = Date.now() - startTime;

      if (attempt > 1) {
        console.log(`${context || 'Operation'} succeeded on attempt ${attempt}/${config.maxAttempts} after ${totalDuration}ms`);
      }

      return {
        success: true,
        data,
        attempts: attempt,
        totalDuration
      };

    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const isRetryable = isRetryableError(error, config);
      const isLastAttempt = attempt === config.maxAttempts;

      console.error(`${context || 'Operation'} failed on attempt ${attempt}/${config.maxAttempts}:`, {
        error: lastError.message,
        retryable: isRetryable,
        willRetry: isRetryable && !isLastAttempt
      });

      // Don't retry if error is not retryable or if this was the last attempt
      if (!isRetryable || isLastAttempt) {
        break;
      }

      // Calculate and wait before next retry
      const delay = calculateDelay(attempt, config);
      console.log(`${context || 'Operation'} retrying in ${delay}ms...`);
      await sleep(delay);
    }
  }

  // All retries exhausted
  const totalDuration = Date.now() - startTime;
  console.error(`${context || 'Operation'} failed after ${config.maxAttempts} attempts and ${totalDuration}ms`);

  return {
    success: false,
    error: lastError,
    attempts: config.maxAttempts,
    totalDuration
  };
}

/**
 * Retry multiple parallel operations with individual retry logic
 * Useful for the scatter-gather pattern with parallel AI calls
 * @param operations Array of functions to execute in parallel
 * @param config Retry configuration
 * @param contexts Optional context labels for each operation
 * @returns Array of retry results
 */
export async function retryParallel<T>(
  operations: (() => Promise<T>)[],
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
  contexts?: string[]
): Promise<RetryResult<T>[]> {
  const promises = operations.map((op, index) => {
    const context = contexts?.[index] || `Operation ${index + 1}`;
    return retryWithBackoff(op, config, context);
  });

  return Promise.all(promises);
}

/**
 * Create a retryable wrapper for AI.run calls
 * @param ai AI binding from environment
 * @param model Model name
 * @param options Model options
 * @param config Retry configuration
 * @param context Context for logging
 */
export async function retryAICall(
  ai: any, // Can be AIProvider or Cloudflare AI binding (we'll detect)
  model: string,
  options: any,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
  context?: string
): Promise<RetryResult<any>> {
  return retryWithBackoff(
    async () => {
      if (ai.run && typeof ai.run === 'function') {
        return ai.run(model, options);
      } else {
        // Fallback/Legacy
        return ai.run(model, options);
      }
    },
    config,
    context || `AI Call: ${model}`
  );
}
