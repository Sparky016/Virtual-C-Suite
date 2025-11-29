// analysis-coordinator utility functions

import { ExecutiveAnalysis, SynthesisResult, PromptTemplate, Env } from './interfaces';

const VALID_ROLES: Array<'CFO' | 'CMO' | 'COO'> = ['CFO', 'CMO', 'COO'];

/**
 * Builds executive-specific analysis prompt from content and role
 */
export function buildPrompt(content: string, role: 'CFO' | 'CMO' | 'COO'): string {
  validateContent(content);
  validateRole(role);

  const template = getPromptTemplate(role);
  return constructPrompt(template, content);
}

/**
 * Validates content is non-empty
 */
function validateContent(content: string): void {
  if (!content || content.trim().length === 0) {
    throw new Error('Content cannot be empty');
  }
}

/**
 * Validates role is one of the allowed executive roles
 */
function validateRole(role: string): void {
  if (!VALID_ROLES.includes(role as 'CFO' | 'CMO' | 'COO')) {
    throw new Error(`Invalid role: ${role}. Must be one of: ${VALID_ROLES.join(', ')}`);
  }
}

/**
 * Constructs full prompt from template and content
 */
function constructPrompt(template: PromptTemplate, content: string): string {
  return `You are acting as a ${template.role}.

${template.context}

Analyze the following board meeting transcript:

${content}

${template.instructions.join('\n')}

Please provide your analysis in JSON format with the following structure:
{
  "analysis": "Your detailed analysis here",
  "keyInsights": ["insight1", "insight2", ...],
  "recommendations": ["recommendation1", "recommendation2", ...]
}`;
}

/**
 * Retrieves role-specific prompt template with context and instructions
 */
export function getPromptTemplate(role: 'CFO' | 'CMO' | 'COO'): PromptTemplate {
  const templates = buildPromptTemplates();
  return templates[role];
}

/**
 * Constructs all executive role prompt templates
 */
function buildPromptTemplates(): Record<'CFO' | 'CMO' | 'COO', PromptTemplate> {
  return {
    CFO: buildCFOTemplate(),
    CMO: buildCMOTemplate(),
    COO: buildCOOTemplate()
  };
}

/**
 * Builds CFO prompt template focused on financial analysis
 */
function buildCFOTemplate(): PromptTemplate {
  return {
    role: 'CFO',
    context: 'As the Chief Financial Officer, your focus is on financial performance, fiscal responsibility, and strategic financial planning. You analyze revenue, costs, profitability, cash flow, and financial risks.',
    instructions: [
      'Analyze the financial implications discussed in the meeting',
      'Identify key financial metrics and performance indicators',
      'Assess financial risks and opportunities',
      'Provide recommendations for financial optimization'
    ]
  };
}

/**
 * Builds CMO prompt template focused on marketing and customer analysis
 */
function buildCMOTemplate(): PromptTemplate {
  return {
    role: 'CMO',
    context: 'As the Chief Marketing Officer, your focus is on customer acquisition, brand positioning, marketing strategy, and market trends. You analyze customer behavior, market opportunities, and competitive positioning.',
    instructions: [
      'Analyze marketing and customer-related discussions',
      'Identify market opportunities and customer insights',
      'Assess brand positioning and competitive landscape',
      'Provide recommendations for marketing strategy and customer engagement'
    ]
  };
}

/**
 * Builds COO prompt template focused on operations analysis
 */
function buildCOOTemplate(): PromptTemplate {
  return {
    role: 'COO',
    context: 'As the Chief Operations Officer, your focus is on operations efficiency, process optimization, and execution. You analyze workflows, resource allocation, productivity, and operational risks.',
    instructions: [
      'Analyze operations processes and efficiency discussed',
      'Identify operations bottlenecks and improvement opportunities',
      'Assess resource allocation and utilization',
      'Provide recommendations for operations optimization and execution'
    ]
  };
}

/**
 * Synthesizes multiple executive analyses into consolidated insights and prioritized actions
 */
export async function synthesize(analyses: ExecutiveAnalysis[], env: Env): Promise<SynthesisResult> {
  validateAnalyses(analyses);

  env.logger.info('Starting synthesis of executive analyses', { count: analyses.length });

  const insights = extractInsights(analyses);
  const actionItems = prioritizeActionItems(analyses);

  env.logger.info('Synthesis complete', {
    insightsCount: insights.length,
    actionItemsCount: actionItems.length
  });

  return buildSynthesisResult(insights, actionItems);
}

/**
 * Validates analyses array is non-empty
 */
function validateAnalyses(analyses: ExecutiveAnalysis[]): void {
  if (!analyses || analyses.length === 0) {
    throw new Error('Cannot synthesize empty analyses array');
  }
}

/**
 * Constructs synthesis result from insights and action items
 */
function buildSynthesisResult(insights: string[], actionItems: string[]): SynthesisResult {
  return {
    consolidatedInsights: insights,
    actionItems
  };
}

const STOP_WORDS = new Set(['is', 'are', 'the', 'a', 'an', 'and', 'or', 'but']);

/**
 * Normalizes text for comparison by removing stop words and sorting
 */
function normalizeForComparison(text: string): string {
  const words = extractSignificantWords(text);
  return words.sort().join(' ');
}

/**
 * Extracts significant words by filtering out stop words
 */
function extractSignificantWords(text: string): string[] {
  return text.trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(word => !STOP_WORDS.has(word));
}

/**
 * Extracts and deduplicates insights from all analyses
 */
export function extractInsights(analyses: ExecutiveAnalysis[]): string[] {
  const allInsights: string[] = [];
  const seenInsights = new Set<string>();

  for (const analysis of analyses) {
    addUniqueInsights(analysis.keyInsights, seenInsights, allInsights);
  }

  return allInsights;
}

/**
 * Adds insights to collection if not already seen
 */
function addUniqueInsights(insights: string[], seenSet: Set<string>, resultArray: string[]): void {
  for (const insight of insights) {
    const normalized = normalizeForComparison(insight);
    if (isUniqueInsight(normalized, seenSet)) {
      seenSet.add(normalized);
      resultArray.push(insight.trim());
    }
  }
}

/**
 * Checks if normalized insight is unique
 */
function isUniqueInsight(normalized: string, seenSet: Set<string>): boolean {
  return normalized.length > 0 && !seenSet.has(normalized);
}

/**
 * Prioritizes action items by frequency across analyses
 */
export function prioritizeActionItems(analyses: ExecutiveAnalysis[]): string[] {
  const itemFrequency = buildFrequencyMap(analyses);
  return sortByFrequency(itemFrequency);
}

/**
 * Builds frequency map of all recommendations
 */
function buildFrequencyMap(analyses: ExecutiveAnalysis[]): Map<string, number> {
  const itemFrequency = new Map<string, number>();

  for (const analysis of analyses) {
    countRecommendations(analysis.recommendations, itemFrequency);
  }

  return itemFrequency;
}

/**
 * Counts recommendation occurrences in frequency map
 */
function countRecommendations(recommendations: string[], frequencyMap: Map<string, number>): void {
  for (const recommendation of recommendations) {
    const normalized = recommendation.trim();
    if (normalized) {
      incrementFrequency(normalized, frequencyMap);
    }
  }
}

/**
 * Increments frequency count for item
 */
function incrementFrequency(item: string, frequencyMap: Map<string, number>): void {
  const currentCount = frequencyMap.get(item) || 0;
  frequencyMap.set(item, currentCount + 1);
}

/**
 * Sorts items by frequency in descending order
 */
function sortByFrequency(frequencyMap: Map<string, number>): string[] {
  return Array.from(frequencyMap.entries())
    .sort(compareByFrequency)
    .map(extractItem);
}

/**
 * Compares frequency map entries for descending sort
 */
function compareByFrequency(a: [string, number], b: [string, number]): number {
  return b[1] - a[1];
}

/**
 * Extracts item from frequency map entry
 */
function extractItem(entry: [string, number]): string {
  return entry[0];
}

/**
 * Formats executive analysis as markdown report section
 */
export function formatAnalysisForReport(analysis: ExecutiveAnalysis): string {
  const sections: string[] = [
    formatHeader(analysis.role),
    formatAnalysisText(analysis.analysis),
    formatKeyInsights(analysis.keyInsights),
    formatRecommendations(analysis.recommendations)
  ];

  return sections.filter(Boolean).join('');
}

/**
 * Formats role header as markdown heading
 */
function formatHeader(role: string): string {
  return `### ${role} Analysis\n\n`;
}

/**
 * Formats analysis text section
 */
function formatAnalysisText(analysisText: string): string {
  return `${analysisText}\n\n`;
}

/**
 * Formats key insights as bulleted list
 */
function formatKeyInsights(insights: string[]): string {
  if (insights.length === 0) {
    return '';
  }

  const header = '#### Key Insights\n\n';
  const items = insights.map(insight => `- ${insight}\n`).join('');
  return header + items + '\n';
}

/**
 * Formats recommendations as bulleted list
 */
function formatRecommendations(recommendations: string[]): string {
  if (recommendations.length === 0) {
    return '';
  }

  const header = '#### Recommendations\n\n';
  const items = recommendations.map(rec => `- ${rec}\n`).join('');
  return header + items + '\n';
}
