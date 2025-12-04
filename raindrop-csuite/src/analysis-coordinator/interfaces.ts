// analysis-coordinator interface definitions

export interface ExecutiveAnalysis {
  role: 'CFO' | 'CMO' | 'COO';
  analysis: string;
  keyInsights: string[];
  recommendations: string[];
}

export interface SynthesisResult {
  consolidatedInsights: string[];
  actionItems: string[];
}

export interface PromptTemplate {
  role: string;
  context: string;
  instructions: string[];
}

export interface Env {
  SAMBANOVA_API_KEY: string;
  logger: Logger;
}

export interface Logger {
  debug(message: string, fields?: Record<string, any>): void;
  info(message: string, fields?: Record<string, any>): void;
  warn(message: string, fields?: Record<string, any>): void;
  error(message: string, fields?: Record<string, any>): void;
}
