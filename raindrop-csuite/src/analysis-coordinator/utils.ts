// analysis-coordinator utility functions

import { ExecutiveAnalysis, SynthesisResult, PromptTemplate, Env } from './interfaces';
import SambaNova from 'sambanova';

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
/**
 * Synthesizes multiple executive analyses into consolidated insights and prioritized actions
 */
export async function synthesize(analyses: ExecutiveAnalysis[], env: Env): Promise<SynthesisResult> {
  validateAnalyses(analyses);

  env.logger.info('Starting synthesis of executive analyses', { count: analyses.length });

  const prompt = buildSynthesisPrompt(analyses);
  const aiResponse = await callAI(prompt, env);
  const synthesis = parseSynthesisResponse(aiResponse);

  env.logger.info('Synthesis complete', {
    insightsCount: synthesis.consolidatedInsights.length,
    actionItemsCount: synthesis.actionItems.length
  });

  return synthesis;
}

function buildSynthesisPrompt(analyses: ExecutiveAnalysis[]): string {
  let prompt = `You are the CEO of the company. You have received reports from your CFO, CMO, and COO.
Your goal is to synthesize these conflicting opinions into a final strategic summary and a prioritized action plan.

Here are the reports:

`;

  for (const analysis of analyses) {
    prompt += `--- ${analysis.role} REPORT ---\n`;
    prompt += `${analysis.analysis}\n`;
    prompt += `Key Insights: ${analysis.keyInsights.join(', ')}\n`;
    prompt += `Recommendations: ${analysis.recommendations.join(', ')}\n\n`;
  }

  prompt += `
Based on these reports, provide a consolidated strategic summary.
Resolve conflicts between the executives (e.g. if CFO says cut costs but CMO says spend more, decide the best path).

Please provide your response in JSON format with the following structure:
{
  "consolidatedInsights": ["insight1", "insight2", ...],
  "actionItems": ["action1", "action2", ...]
}
`;

  return prompt;
}

async function callAI(prompt: string, env: Env): Promise<any> {
  const client = new SambaNova({
    apiKey: env.SAMBANOVA_API_KEY,
  });

  return await client.chat.completions.create({
    model: 'Meta-Llama-3.3-70B-Instruct',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7
  });
}

function parseSynthesisResponse(aiResponse: any): SynthesisResult {
  const content = aiResponse.choices[0].message.content;
  try {
    return JSON.parse(content);
  } catch {
    // Fallback if JSON parsing fails
    return {
      consolidatedInsights: ["Failed to parse AI response"],
      actionItems: ["Check logs for raw response"]
    };
  }
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
