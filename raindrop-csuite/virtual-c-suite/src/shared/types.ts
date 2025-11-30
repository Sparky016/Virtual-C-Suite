// Shared TypeScript types and interfaces for Virtual C-Suite

export interface AnalysisRequest {
  requestId: string;
  userId: string;
  fileKey: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: number;
  completedAt?: number;
  errorMessage?: string;
}

export interface ExecutiveAnalysis {
  id?: number;
  requestId: string;
  executiveRole: 'CFO' | 'CMO' | 'COO';
  analysisText: string;
  createdAt: number;
}

export interface FinalReport {
  requestId: string;
  reportContent: string;
  reportKey: string;
  createdAt: number;
}

export interface UploadResponse {
  requestId: string;
  status: string;
  message: string;
}

export interface ReportResponse {
  requestId: string;
  status: string;
  report?: string;
  completedAt?: string;
  error?: string;
  message?: string;
}

export interface StatusResponse {
  requestId: string;
  status: string;
  progress?: {
    cfo: string;
    cmo: string;
    coo: string;
    synthesis: string;
  };
}

export interface AIAnalysisResult {
  role: 'CFO' | 'CMO' | 'COO' | 'CEO';
  analysis: string;
}

export interface ParsedFileData {
  content: string;
  type: 'csv' | 'pdf' | 'txt';
  metadata?: Record<string, any>;
}

export const MAX_FILE_SIZE_MB = 10;
export const ALLOWED_FILE_TYPES = ['text/csv', 'application/pdf', 'text/plain'];
export const ALLOWED_EXTENSIONS = ['.csv', '.pdf', '.txt'];
