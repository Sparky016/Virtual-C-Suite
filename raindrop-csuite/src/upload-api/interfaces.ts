// upload-api interface definitions

export interface UploadRequest {
  file: File;
  contentType: string;
}

export interface UploadResponse {
  requestId: string;
  message: string;
}

export interface StatusResponse {
  requestId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  message?: string;
}

export interface ReportResponse {
  requestId: string;
  report?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

export interface Env {
  INPUT_BUCKET: any;
  OUTPUT_BUCKET: any;

  logger: Logger;
}

export interface Logger {
  debug(message: string, fields?: Record<string, any>): void;
  info(message: string, fields?: Record<string, any>): void;
  warn(message: string, fields?: Record<string, any>): void;
  error(message: string, fields?: Record<string, any>): void;
}
