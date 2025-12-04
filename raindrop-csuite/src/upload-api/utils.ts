// upload-api utility functions

import { UploadRequest, UploadResponse, StatusResponse, ReportResponse, Env } from './interfaces';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_FILE_TYPES = ['application/pdf', 'text/csv', 'text/plain'];

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
  if (!ALLOWED_FILE_TYPES.includes(file.type)) {
    env.logger.warn('Upload validation failed: Invalid file format', { type: file.type });
    return { valid: false, error: 'Invalid file format. Only PDF, CSV, and TXT files are accepted' };
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
 * Creates a new analysis request marker (optional in bucket-based flow, implied by input file)
 */
export async function createAnalysisRequest(requestId: string, fileName: string, env: Env): Promise<void> {
  // In bucket-based architecture, the presence of the input file initiates the process.
  // We don't need to insert into a DB.
  env.logger.debug('Analysis request initiated (file stored)', { requestId, fileName });
}

/**
 * Retrieves the current status of an analysis request by checking bucket contents
 */
export async function getRequestStatus(requestId: string, env: Env): Promise<StatusResponse> {
  try {
    // Check for output report first (completed)
    const reportKey = `reports/${requestId}.md`;
    const reportExists = await env.OUTPUT_BUCKET.head(reportKey);

    if (reportExists) {
      return { requestId, status: 'completed' };
    }

    // Check for input file (processing/pending)
    // We need to list because we don't know the filename extension in the input bucket key
    // Expected key: uploads/{requestId}/{filename}
    const list = await env.INPUT_BUCKET.list({ prefix: `uploads/${requestId}/` });

    if (list.objects.length > 0) {
      return { requestId, status: 'processing' };
    }

    throw new Error('Request not found');
  } catch (error) {
    env.logger.error('Failed to get request status', { error: String(error), requestId });
    throw error;
  }
}



/**
 * Retrieves completed analysis report or current status
 */
export async function getReport(requestId: string, env: Env): Promise<ReportResponse> {
  try {
    const reportKey = `reports/${requestId}.md`;
    const reportObject = await env.OUTPUT_BUCKET.get(reportKey);

    if (reportObject) {
      const reportText = await reportObject.text();
      return {
        requestId,
        status: 'completed',
        report: reportText
      };
    }

    // If report not found, check status
    const status = await getRequestStatus(requestId, env);
    return {
      requestId,
      status: status.status
    };

  } catch (error) {
    env.logger.error('Failed to get report', { error: String(error), requestId });
    throw error; // Or return 404
  }
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
