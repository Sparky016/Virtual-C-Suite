import { AppBindings } from '../config/env';

// PostHog Configuration - using fetch API for Workers compatibility
const DEFAULT_POSTHOG_HOST = 'https://us.i.posthog.com';

/**
 * Workers-compatible PostHog client using fetch API
 * Works in both Cloudflare Workers and Node.js (18+)
 */
class WorkersPostHogClient {
  private apiKey: string;
  private host: string;

  constructor(apiKey: string, host?: string) {
    this.apiKey = apiKey;
    this.host = host || DEFAULT_POSTHOG_HOST;
  }

  /**
   * Capture an event
   */
  capture(options: {
    distinctId: string;
    event: string;
    properties?: Record<string, any>;
  }): void {
    // Fire and forget - don't await to avoid blocking
    fetch(`${this.host}/capture/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: this.apiKey,
        distinct_id: options.distinctId,
        event: options.event,
        properties: options.properties || {},
        timestamp: new Date().toISOString(),
      }),
    }).catch(error => {
      console.error('Failed to capture PostHog event:', error);
    });
  }

  /**
   * Identify a user
   */
  identify(options: {
    distinctId: string;
    properties?: Record<string, any>;
  }): void {
    // Fire and forget - don't await to avoid blocking
    fetch(`${this.host}/capture/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: this.apiKey,
        distinct_id: options.distinctId,
        event: '$identify',
        properties: {
          $set: options.properties || {},
        },
        timestamp: new Date().toISOString(),
      }),
    }).catch(error => {
      console.error('Failed to identify PostHog user:', error);
    });
  }

  /**
   * Flush - no-op in Workers since we send immediately
   */
  async flush(): Promise<void> {
    // No-op: we send events immediately via fetch
    return Promise.resolve();
  }

  /**
   * Shutdown - no-op in Workers
   */
  async shutdown(): Promise<void> {
    // No-op: nothing to clean up
    return Promise.resolve();
  }
}

// Singleton PostHog client
let posthogClient: WorkersPostHogClient | null = null;
let currentApiKey: string | undefined = undefined;

/**
 * Initialize PostHog client (lazy initialization)
 */
function getPostHogClient(apiKey?: string, host?: string): WorkersPostHogClient | null {
  if (!apiKey) {
    console.warn('PostHog API key not provided. Analytics disabled.');
    return null;
  }

  // Reinitialize if API key changed
  if (!posthogClient || currentApiKey !== apiKey) {
    posthogClient = new WorkersPostHogClient(apiKey, host);
    currentApiKey = apiKey;
    console.log(`PostHog analytics initialized with host: ${host || DEFAULT_POSTHOG_HOST}`);
  }

  return posthogClient;
}

/**
 * Event names for Virtual C-Suite
 */
export const AnalyticsEvents = {
  // Upload events
  FILE_UPLOADED: 'file_uploaded',
  FILE_UPLOAD_FAILED: 'file_upload_failed',
  FILE_VALIDATED: 'file_validated',
  FILE_VALIDATION_FAILED: 'file_validation_failed',

  // Rate limiting events
  RATE_LIMIT_CHECKED: 'rate_limit_checked',
  RATE_LIMIT_EXCEEDED: 'rate_limit_exceeded',

  // Analysis events
  ANALYSIS_STARTED: 'analysis_started',
  ANALYSIS_COMPLETED: 'analysis_completed',
  ANALYSIS_FAILED: 'analysis_failed',

  // AI call events
  AI_CALL_STARTED: 'ai_call_started',
  AI_CALL_COMPLETED: 'ai_call_completed',
  AI_CALL_FAILED: 'ai_call_failed',
  AI_CALL_RETRIED: 'ai_call_retried',

  // Executive analysis events
  CFO_ANALYSIS_COMPLETED: 'cfo_analysis_completed',
  CMO_ANALYSIS_COMPLETED: 'cmo_analysis_completed',
  COO_ANALYSIS_COMPLETED: 'coo_analysis_completed',
  CEO_SYNTHESIS_COMPLETED: 'ceo_synthesis_completed',

  // Report events
  REPORT_GENERATED: 'report_generated',
  REPORT_RETRIEVED: 'report_retrieved',

  // Status check events
  STATUS_CHECKED: 'status_checked'
} as const;

/**
 * Track an event in PostHog
 */
export function trackEvent(
  apiKey: string | undefined,
  userId: string,
  event: string,
  properties?: Record<string, any>,
  environment?: string
): void {
  const client = getPostHogClient(apiKey);
  if (!client) return;

  try {
    // console.log(`Tracking event: ${event} for user: ${userId}`);
    client.capture({
      distinctId: userId,
      event,
      properties: {
        ...properties,
        timestamp: new Date().toISOString(),
        environment: environment || 'production'
      }
    });

    // Attempt to flush immediately
    client.flush().catch(err => console.error('Error flushing events:', err));

  } catch (error) {
    console.error('Failed to track event:', error);
  }
}

/**
 * Track a timed event (with duration)
 */
export function trackTimedEvent(
  apiKey: string | undefined,
  userId: string,
  event: string,
  durationMs: number,
  properties?: Record<string, any>,
  environment?: string
): void {
  trackEvent(apiKey, userId, event, {
    ...properties,
    duration_ms: durationMs,
    duration_seconds: (durationMs / 1000).toFixed(2)
  }, environment);
}

/**
 * Identify a user in PostHog
 */
export function identifyUser(
  apiKey: string | undefined,
  userId: string,
  properties?: Record<string, any>
): void {
  const client = getPostHogClient(apiKey);
  if (!client) return;

  try {
    client.identify({
      distinctId: userId,
      properties: {
        ...properties,
        first_seen: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Failed to identify user:', error);
  }
}

/**
 * Flush all pending events (call before shutdown)
 */
export async function flushAnalytics(apiKey: string | undefined): Promise<void> {
  const client = getPostHogClient(apiKey);
  if (!client) return;

  try {
    await client.flush();
    console.log('PostHog events flushed');
  } catch (error) {
    console.error('Failed to flush PostHog events:', error);
  }
}

/**
 * Shutdown PostHog client
 */
export async function shutdownAnalytics(apiKey: string | undefined): Promise<void> {
  const client = getPostHogClient(apiKey);
  if (!client) return;

  try {
    await client.shutdown();
    posthogClient = null;
    console.log('PostHog client shut down');
  } catch (error) {
    console.error('Failed to shutdown PostHog client:', error);
  }
}

/**
 * Helper to track AI performance metrics
 */
export function trackAIPerformance(
  apiKey: string | undefined,
  userId: string,
  role: 'CFO' | 'CMO' | 'COO' | 'CEO' | 'CEO_CHAT' | 'CFO_CHAT' | 'CMO_CHAT' | 'COO_CHAT' | 'CEO_CHAT_FALLBACK' | 'CEO_CHAT_STREAM' | 'CEO_CHAT_STREAM_FALLBACK' | 'CEO_CHAT_STREAM_FALLBACK_NON_STREAM',
  durationMs: number,
  attempts: number,
  success: boolean,
  properties?: Record<string, any>,
  environment?: string
): void {
  trackTimedEvent(
    apiKey,
    userId,
    success ? AnalyticsEvents.AI_CALL_COMPLETED : AnalyticsEvents.AI_CALL_FAILED,
    durationMs,
    {
      ...properties,
      role,
      attempts,
      success,
      retried: attempts > 1
    },
    environment
  );
}
