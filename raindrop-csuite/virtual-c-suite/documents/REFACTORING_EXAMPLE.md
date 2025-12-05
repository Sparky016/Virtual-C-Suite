# Refactoring Example: Upload API

## Before (Monolithic)

```typescript
// upload-api/index.ts
app.post('/upload', async (c) => {
  try {
    const formData = await c.req.formData();
    const file = formData.get('file') as File;
    const userId = formData.get('userId') as string;

    // Inline validation
    if (!file) {
      return c.json({ error: 'No file provided' }, 400);
    }

    if (!userId) {
      return c.json({ error: 'userId is required' }, 400);
    }

    // Inline file size validation
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > MAX_FILE_SIZE_MB) {
      trackEvent(c.env.POSTHOG_API_KEY, userId, AnalyticsEvents.FILE_VALIDATION_FAILED, {
        reason: 'file_size_exceeded',
        size_mb: fileSizeMB.toFixed(2),
        limit_mb: MAX_FILE_SIZE_MB
      });

      return c.json({
        error: `File size exceeds ${MAX_FILE_SIZE_MB}MB limit`,
        size: `${fileSizeMB.toFixed(2)}MB`
      }, 400);
    }

    // ... 100 more lines ...
  } catch (error) {
    // Error handling
  }
});
```

## After (Modular)

```typescript
// upload-api/index.ts
import { UploadService } from '../services/UploadService';
import { AnalysisRequestRepository } from '../repositories/AnalysisRequestRepository';
import { RateLimiter } from '../shared/rate-limiter';

// Initialize services
const uploadService = new UploadService();
const rateLimiter = new RateLimiter();

app.post('/upload', async (c) => {
  try {
    const formData = await c.req.formData();
    const file = formData.get('file') as File;
    const userId = formData.get('userId') as string;

    // Step 1: Validate request
    const validation = await uploadService.validateUploadRequest(file, userId);
    if (!validation.success) {
      if (validation.validationDetails) {
        uploadService.trackValidationFailure(
          c.env.POSTHOG_API_KEY,
          userId,
          file!,
          validation.validationDetails.reason,
          validation.validationDetails
        );
      }
      return c.json({ error: validation.error }, 400);
    }

    // Step 2: Check rate limit
    const maxRequests = c.env.RATE_LIMIT_PER_USER ?
      parseInt(c.env.RATE_LIMIT_PER_USER) : undefined;

    const rateLimit = await rateLimiter.checkLimit(
      c.env.TRACKING_DB,
      userId,
      maxRequests
    );

    if (!rateLimit.allowed) {
      return c.json({
        error: 'Rate limit exceeded',
        message: rateLimit.message
      }, 429);
    }

    // Step 3: Process upload
    const requestId = uploadService.generateRequestId();
    const fileKey = uploadService.buildFileKey(userId, requestId, file.name);
    const metadata = uploadService.prepareFileMetadata({ file, userId, requestId }, file);

    // Step 4: Store in bucket
    const arrayBuffer = await file.arrayBuffer();
    await c.env.INPUT_BUCKET.put(fileKey, new Uint8Array(arrayBuffer), metadata);

    // Step 5: Store in database
    const repository = new AnalysisRequestRepository(c.env.TRACKING_DB);
    await repository.create({
      requestId,
      userId,
      fileKey,
      status: 'processing',
      createdAt: Date.now()
    });

    // Step 6: Track success
    uploadService.trackUploadSuccess(
      c.env.POSTHOG_API_KEY,
      userId,
      requestId,
      file,
      fileKey
    );

    return c.json({
      requestId,
      status: 'processing',
      message: 'File uploaded successfully'
    }, 201);

  } catch (error) {
    console.error('Upload error:', error);
    return c.json({
      error: 'Failed to upload file',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});
```

## Benefits

### Testability
- ✅ Each service can be unit tested independently
- ✅ Easy to mock dependencies (repository, bucket, etc.)
- ✅ Clear separation of concerns

### Readability
- ✅ Handler is now a clear orchestration layer
- ✅ Each step is obvious
- ✅ Business logic is in services

### Maintainability
- ✅ Change validation? Only touch FileValidationService
- ✅ Change database? Only touch Repository
- ✅ Add new validation rule? Single location

## Testing Example

```typescript
// upload-api/index.test.ts
import { describe, test, expect, vi } from 'vitest';
import { UploadService } from '../services/UploadService';

describe('Upload API', () => {
  test('rejects files over size limit', async () => {
    const service = new UploadService();
    const largeFile = new File(['content'], 'large.csv');
    Object.defineProperty(largeFile, 'size', { value: 15 * 1024 * 1024 });

    const result = await service.validateUploadRequest(largeFile, 'user123');

    expect(result.success).toBe(false);
    expect(result.error).toContain('exceeds');
  });

  test('generates unique request IDs', () => {
    const service = new UploadService();
    const id1 = service.generateRequestId();
    const id2 = service.generateRequestId();

    expect(id1).not.toBe(id2);
    expect(id1.length).toBeGreaterThan(10);
  });

  test('builds correct file keys', () => {
    const service = new UploadService();
    const key = service.buildFileKey('user123', 'req456', 'data.csv');

    expect(key).toBe('user123/req456/data.csv');
  });
});
```
