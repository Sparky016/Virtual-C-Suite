// board-meeting-processor utility functions

import { BucketEvent, ExecutiveAnalysis, SynthesizedReport, Env } from './interfaces';

const BUCKET_KEY_PATTERN = /uploads\/([^\/]+)\//;
const EXPECTED_KEY_FORMAT = 'uploads/req-xxx/filename';

/**
 * Extracts request ID from bucket object key path
 * Expected format: uploads/{requestId}/{filename}
 */
export async function extractRequestIdFromKey(key: string): Promise<string> {
  const match = key.match(BUCKET_KEY_PATTERN);

  if (!match || !match[1]) {
    throw new Error(`Invalid key format: ${key}. Expected format: ${EXPECTED_KEY_FORMAT}`);
  }

  return match[1];
}

/**
 * Retrieves file content from input bucket as text
 */
export async function fetchFileContent(key: string, env: Env): Promise<string> {
  try {
    env.logger.debug('Fetching file from bucket', { key });

    const fileObject = await env.INPUT_BUCKET.get(key);
    validateFileExists(fileObject, key);

    const content = await fileObject.text();
    env.logger.debug('File content fetched successfully', { key, contentLength: content.length });

    return content;
  } catch (error) {
    env.logger.error('Failed to fetch file content', { key, error: String(error) });
    throw error;
  }
}

/**
 * Validates bucket object exists
 */
function validateFileExists(fileObject: any, key: string): void {
  if (!fileObject) {
    throw new Error(`File not found: ${key}`);
  }
}

const EXECUTIVE_ROLES: Array<'CFO' | 'CMO' | 'COO'> = ['CFO', 'CMO', 'COO'];
const AI_MODEL = 'gpt-4';
const AI_TEMPERATURE = 0.7;

/**
 * Executes AI analysis in parallel for all three executive perspectives
 */
export async function runParallelAnalyses(content: string, env: Env): Promise<ExecutiveAnalysis[]> {
  env.logger.info('Starting parallel analyses for three executives', { contentLength: content.length });

  const analysisPromises = EXECUTIVE_ROLES.map((role) => performRoleAnalysis(content, role, env));
  const analyses = await Promise.all(analysisPromises);

  env.logger.info('All parallel analyses completed successfully', { count: analyses.length });

  return analyses;
}

/**
 * Performs AI analysis for a single executive role
 */
async function performRoleAnalysis(content: string, role: 'CFO' | 'CMO' | 'COO', env: Env): Promise<ExecutiveAnalysis> {
  try {
    const prompt = env.ANALYSIS_COORDINATOR.buildPrompt(content, role);
    const aiResponse = await callAI(prompt, env);
    const parsedAnalysis = parseAIResponse(aiResponse);
    const analysis = buildExecutiveAnalysis(role, parsedAnalysis);

    env.logger.debug('Analysis completed', { role });
    return analysis;
  } catch (error) {
    env.logger.error('Analysis failed', { role, error: String(error) });
    throw new Error(`${role} analysis failed: ${error}`);
  }
}

/**
 * Calls AI service with configured model and parameters
 */
async function callAI(prompt: string, env: Env): Promise<any> {
  return await env.AI.run({
    model: AI_MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: AI_TEMPERATURE
  });
}

/**
 * Parses AI response content as JSON with fallback for non-JSON responses
 */
function parseAIResponse(aiResponse: any): any {
  const responseContent = aiResponse.choices[0].message.content;

  try {
    return JSON.parse(responseContent);
  } catch {
    return {
      analysis: responseContent,
      keyInsights: [],
      recommendations: []
    };
  }
}

/**
 * Constructs ExecutiveAnalysis from parsed AI response with field normalization
 */
function buildExecutiveAnalysis(role: 'CFO' | 'CMO' | 'COO', parsedAnalysis: any): ExecutiveAnalysis {
  return {
    role,
    analysis: extractAnalysisText(parsedAnalysis),
    keyInsights: extractKeyInsights(parsedAnalysis),
    recommendations: extractRecommendations(parsedAnalysis)
  };
}

/**
 * Extracts analysis text from various possible field names
 */
function extractAnalysisText(parsed: any): string {
  return parsed.analysis || parsed.Analysis || '';
}

/**
 * Extracts key insights from various possible field names
 */
function extractKeyInsights(parsed: any): string[] {
  return parsed.keyInsights || parsed.key_insights || parsed.KeyInsights || [];
}

/**
 * Extracts recommendations from various possible field names
 */
function extractRecommendations(parsed: any): string[] {
  return parsed.recommendations || parsed.Recommendations || [];
}

/**
 * Updates analysis request status in database
 */
export async function updateAnalysisStatus(requestId: string, status: string, env: Env): Promise<void> {
  try {
    env.logger.debug('Updating analysis status', { requestId, status });

    const query = buildUpdateStatusQuery();
    await env.ANALYSIS_DB.execute(query, [status, requestId]);

    env.logger.debug('Analysis status updated', { requestId, status });
  } catch (error) {
    env.logger.error('Failed to update analysis status', { requestId, status, error: String(error) });
    throw error;
  }
}

/**
 * Constructs SQL query for updating request status
 */
function buildUpdateStatusQuery(): string {
  return 'UPDATE analysis_requests SET status = ? WHERE request_id = ?';
}

/**
 * Saves synthesized report to output bucket as formatted JSON
 */
export async function saveReportToOutputBucket(report: SynthesizedReport, env: Env): Promise<string> {
  try {
    const reportKey = buildReportKey(report.requestId);
    const reportJson = formatReportAsJson(report);

    await env.OUTPUT_BUCKET.put(reportKey, reportJson);

    env.logger.info('Report saved to output bucket', { reportKey, requestId: report.requestId });

    return reportKey;
  } catch (error) {
    env.logger.error('Failed to save report to bucket', { requestId: report.requestId, error: String(error) });
    throw error;
  }
}

/**
 * Constructs output bucket key for report storage
 */
function buildReportKey(requestId: string): string {
  return `reports/${requestId}.json`;
}

/**
 * Formats report as pretty-printed JSON string
 */
function formatReportAsJson(report: SynthesizedReport): string {
  return JSON.stringify(report, null, 2);
}

/**
 * Persists all executive analyses to database for audit trail
 */
export async function saveExecutiveAnalyses(requestId: string, analyses: ExecutiveAnalysis[], env: Env): Promise<void> {
  try {
    for (const analysis of analyses) {
      await saveAnalysisRecord(requestId, analysis, env);
    }

    env.logger.debug('Executive analyses saved to database', { requestId, count: analyses.length });
  } catch (error) {
    env.logger.error('Failed to save executive analyses', { requestId, error: String(error) });
    throw error;
  }
}

/**
 * Saves single executive analysis record to database
 */
async function saveAnalysisRecord(requestId: string, analysis: ExecutiveAnalysis, env: Env): Promise<void> {
  const query = buildInsertAnalysisQuery();
  const params = buildAnalysisParams(requestId, analysis);
  await env.ANALYSIS_DB.execute(query, params);
}

/**
 * Constructs SQL query for inserting executive analysis
 */
function buildInsertAnalysisQuery(): string {
  return `
    INSERT INTO executive_analyses (request_id, role, analysis, key_insights, recommendations, created_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
  `;
}

/**
 * Builds parameter array for executive analysis insertion
 */
function buildAnalysisParams(requestId: string, analysis: ExecutiveAnalysis): any[] {
  return [
    requestId,
    analysis.role,
    analysis.analysis,
    JSON.stringify(analysis.keyInsights),
    JSON.stringify(analysis.recommendations)
  ];
}

/**
 * Updates request record with completed status and report URL
 */
export async function saveFinalReport(requestId: string, reportUrl: string, env: Env): Promise<void> {
  try {
    const query = buildUpdateReportQuery();
    await env.ANALYSIS_DB.execute(query, ['completed', reportUrl, requestId]);

    env.logger.debug('Final report reference saved', { requestId, reportUrl });
  } catch (error) {
    env.logger.error('Failed to save final report reference', { requestId, error: String(error) });
    throw error;
  }
}

/**
 * Constructs SQL query for updating completed report reference
 */
function buildUpdateReportQuery(): string {
  return 'UPDATE analysis_requests SET status = ?, report_url = ? WHERE request_id = ?';
}
