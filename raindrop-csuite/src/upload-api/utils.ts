// upload-api utility functions

import { UploadRequest, UploadResponse, StatusResponse, ReportResponse, Env } from './interfaces';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_FILE_TYPE = 'application/pdf';

/**
 * Validation result for file upload requests
 */
interface ValidationResult {
  valid: boolean;
  error?: string;
  file?: File;
}

/**
 * Validates an uploaded file meets requirements for size, type, and format
 */
export async function validateUploadRequest(request: Request, env: Env): Promise<ValidationResult> {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    const fileValidation = validateFile(file, env);
    if (!fileValidation.valid) {
      return fileValidation;
    }

    env.logger.debug('Upload validation successful', { fileName: (file as File).name, size: (file as File).size });
    return { valid: true, file: file as File };
  } catch (error) {
    env.logger.error('Error validating upload request', { error: String(error) });
    return { valid: false, error: 'Failed to process upload request' };
  }
}

/**
 * Validates file existence, type, format, and size
 */
function validateFile(file: File | string | null, env: Env): ValidationResult {
  if (!file) {
    env.logger.warn('Upload validation failed: No file provided');
    return { valid: false, error: 'No file provided in request' };
  }

  if (!(file instanceof File)) {
    env.logger.warn('Upload validation failed: Invalid file type');
    return { valid: false, error: 'Invalid file type' };
  }

  const typeValidation = validateFileType(file, env);
  if (!typeValidation.valid) {
    return typeValidation;
  }

  const sizeValidation = validateFileSize(file, env);
  if (!sizeValidation.valid) {
    return sizeValidation;
  }

  return { valid: true, file };
}

/**
 * Validates file MIME type matches allowed type
 */
function validateFileType(file: File, env: Env): ValidationResult {
  if (file.type !== ALLOWED_FILE_TYPE) {
    env.logger.warn('Upload validation failed: Invalid file format', { type: file.type });
    return { valid: false, error: 'Invalid file format. Only PDF files are accepted' };
  }
  return { valid: true, file };
}

/**
 * Validates file size does not exceed maximum allowed
 */
function validateFileSize(file: File, env: Env): ValidationResult {
  if (file.size > MAX_FILE_SIZE) {
    env.logger.warn('Upload validation failed: File too large', { size: file.size });
    return { valid: false, error: `File size exceeds maximum allowed size of ${MAX_FILE_SIZE} bytes` };
  }
  return { valid: true, file };
}

/**
 * Stores uploaded file to input bucket using standardized key format
 */
export async function storeFileToInputBucket(file: File, requestId: string, env: Env): Promise<void> {
  try {
    const key = buildBucketKey(requestId, file.name);
    await env.INPUT_BUCKET.put(key, file);
    env.logger.debug('File stored to input bucket', { key, size: file.size });
  } catch (error) {
    env.logger.error('Failed to store file to bucket', { error: String(error), requestId });
    throw new Error('Failed to store file');
  }
}

/**
 * Constructs standardized bucket key for uploaded files
 */
function buildBucketKey(requestId: string, fileName: string): string {
  return `uploads/${requestId}/${fileName}`;
}

/**
 * Creates a new analysis request record in the database with pending status
 */
export async function createAnalysisRequest(requestId: string, fileName: string, env: Env): Promise<void> {
  const query = buildInsertRequestQuery();
  const params = [requestId, fileName, 'pending'];

  try {
    await env.ANALYSIS_DB.execute(query, params);
    env.logger.debug('Analysis request created in database', { requestId, fileName });
  } catch (error) {
    env.logger.error('Failed to create analysis request', { error: String(error), requestId });
    throw new Error('Failed to create analysis request');
  }
}

/**
 * Constructs SQL query for inserting new analysis request
 */
function buildInsertRequestQuery(): string {
  return `
    INSERT INTO analysis_requests (request_id, file_name, status, created_at)
    VALUES (?, ?, ?, datetime('now'))
  `;
}

/**
 * Retrieves the current status of an analysis request
 */
export async function getRequestStatus(requestId: string, env: Env): Promise<StatusResponse> {
  try {
    const query = buildStatusQuery();
    const result = await env.ANALYSIS_DB.execute(query, [requestId]);

    validateQueryResult(result, requestId, env);

    const row = result.results[0];
    env.logger.debug('Retrieved request status', { requestId, status: row.status });

    return buildStatusResponse(row, requestId);
  } catch (error) {
    env.logger.error('Failed to get request status', { error: String(error), requestId });
    throw error;
  }
}

/**
 * Constructs SQL query for retrieving request status
 */
function buildStatusQuery(): string {
  return 'SELECT request_id, status FROM analysis_requests WHERE request_id = ?';
}

/**
 * Validates database query result contains data
 */
function validateQueryResult(result: any, requestId: string, env: Env): void {
  if (!result.results || result.results.length === 0) {
    env.logger.warn('Request not found', { requestId });
    throw new Error('Request not found');
  }
}

/**
 * Constructs status response from database row
 */
function buildStatusResponse(row: any, requestId: string): StatusResponse {
  return {
    requestId: row.request_id || requestId,
    status: row.status
  };
}

/**
 * Retrieves completed analysis report or current status
 */
export async function getReport(requestId: string, env: Env): Promise<ReportResponse> {
  try {
    const query = buildReportQuery();
    const result = await env.ANALYSIS_DB.execute(query, [requestId]);

    validateQueryResult(result, requestId, env);

    const row = result.results[0];
    return await buildReportResponse(row, requestId, env);
  } catch (error) {
    env.logger.error('Failed to get report', { error: String(error), requestId });
    throw error;
  }
}

/**
 * Constructs SQL query for retrieving report data
 */
function buildReportQuery(): string {
  return 'SELECT request_id, status, report_url FROM analysis_requests WHERE request_id = ?';
}

/**
 * Constructs report response, fetching completed report if available
 */
async function buildReportResponse(row: any, requestId: string, env: Env): Promise<ReportResponse> {
  const isCompleted = row.status === 'completed' && row.report_url;

  if (isCompleted) {
    const reportText = await fetchCompletedReport(row.report_url, env);
    if (reportText) {
      env.logger.debug('Retrieved completed report', { requestId });
      return {
        requestId: row.request_id || requestId,
        status: row.status,
        report: reportText
      };
    }
  }

  env.logger.debug('Retrieved report status', { requestId, status: row.status });
  return {
    requestId: row.request_id || requestId,
    status: row.status
  };
}

/**
 * Fetches completed report content from output bucket
 */
async function fetchCompletedReport(reportUrl: string, env: Env): Promise<string | null> {
  const reportObject = await env.OUTPUT_BUCKET.get(reportUrl);
  return reportObject ? await reportObject.text() : null;
}

/**
 * Generates unique request identifier combining timestamp and random string
 */
export function generateRequestId(): string {
  const timestamp = Date.now();
  const random = generateRandomString();
  return `req-${timestamp}-${random}`;
}

/**
 * Generates random alphanumeric string for uniqueness
 */
function generateRandomString(): string {
  return Math.random().toString(36).substring(2, 15);
}
