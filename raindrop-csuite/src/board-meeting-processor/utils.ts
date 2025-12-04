// board-meeting-processor utility functions

import { BucketEvent, ExecutiveAnalysis, SynthesizedReport, Env } from './interfaces';
import SambaNova from 'sambanova';

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
const AI_MODEL = 'Meta-Llama-3.3-70B-Instruct';
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

async function callAI(prompt: string, env: Env): Promise<any> {
  const client = new SambaNova({
    apiKey: env.SAMBANOVA_API_KEY,
  });

  return await client.chat.completions.create({
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
 * Saves synthesized report to output bucket as formatted JSON
 */
export async function saveReportToOutputBucket(report: SynthesizedReport, env: Env): Promise<string> {
  try {
    const reportKey = buildReportKey(report.requestId);
    const reportMarkdown = formatReportAsMarkdown(report);

    await env.OUTPUT_BUCKET.put(reportKey, reportMarkdown);

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
  return `reports/${requestId}.md`;
}

/**
 * Formats report as Markdown string
 */
function formatReportAsMarkdown(report: SynthesizedReport): string {
  let markdown = `# Virtual C-Suite Strategic Report\n\n`;
  markdown += `**Request ID:** ${report.requestId}\n`;
  markdown += `**Date:** ${report.timestamp}\n\n`;
  markdown += `## Executive Summary\n\n`;
  markdown += report.consolidatedInsights.map(insight => `- ${insight}`).join('\n') + '\n\n';
  markdown += `## Strategic Action Plan\n\n`;
  markdown += report.actionItems.map((item, index) => `${index + 1}. ${item}`).join('\n') + '\n\n';
  markdown += `## Detailed Executive Analysis\n\n`;

  for (const analysis of report.executiveAnalyses) {
    markdown += `### ${analysis.role} Perspective\n\n`;
    markdown += `${analysis.analysis}\n\n`;
    markdown += `**Key Insights:**\n`;
    markdown += analysis.keyInsights.map(i => `- ${i}`).join('\n') + '\n\n';
    markdown += `**Recommendations:**\n`;
    markdown += analysis.recommendations.map(r => `- ${r}`).join('\n') + '\n\n';
    markdown += `---\n\n`;
  }

  return markdown;
}



/**
 * Updates request record with completed status and report URL
 */
export async function saveFinalReport(requestId: string, reportUrl: string, env: Env): Promise<void> {
  // In a bucket-only architecture, the presence of the report file indicates completion.
  // We might optionally write a status file, but for now we just log it.
  env.logger.debug('Final report saved', { requestId, reportUrl });
}
