// board-meeting-processor interface definitions

export interface BucketEvent {
  key: string;
  size: number;
  contentType: string;
}

export interface ExecutiveAnalysis {
  role: 'CFO' | 'CMO' | 'COO';
  analysis: string;
  keyInsights: string[];
  recommendations: string[];
}

export interface SynthesizedReport {
  requestId: string;
  executiveAnalyses: ExecutiveAnalysis[];
  consolidatedInsights: string[];
  actionItems: string[];
  timestamp: string;
}

export interface Env {
  INPUT_BUCKET: any;
  OUTPUT_BUCKET: any;
  ANALYSIS_COORDINATOR: any;
  SAMBANOVA_API_KEY: string;
  logger: Logger;
}

export interface Logger {
  debug(message: string, fields?: Record<string, any>): void;
  info(message: string, fields?: Record<string, any>): void;
  warn(message: string, fields?: Record<string, any>): void;
  error(message: string, fields?: Record<string, any>): void;
}

export interface AIRunOptions {
  model: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
}
