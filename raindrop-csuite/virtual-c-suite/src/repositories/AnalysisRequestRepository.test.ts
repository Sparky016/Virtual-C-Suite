// AnalysisRequestRepository Tests - Data access layer validation
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { AnalysisRequestRepository, AnalysisRequest } from './AnalysisRequestRepository';

describe('AnalysisRequestRepository', () => {
  let repository: AnalysisRequestRepository;
  let mockDb: any;
  let mockStatement: any;

  beforeEach(() => {
    // Create mock statement with chainable methods
    mockStatement = {
      bind: vi.fn().mockReturnThis(),
      run: vi.fn().mockResolvedValue({}),
      first: vi.fn().mockResolvedValue(null)
    };

    // Create mock database
    mockDb = {
      prepare: vi.fn().mockReturnValue(mockStatement)
    };

    repository = new AnalysisRequestRepository(mockDb);
  });

  describe('create', () => {
    test('inserts new analysis request into database', async () => {
      const request = {
        requestId: 'REQ123',
        userId: 'user456',
        fileKey: 'user456/REQ123/data.csv',
        status: 'processing' as const,
        createdAt: Date.now()
      };

      await repository.create(request);

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO analysis_requests')
      );
      expect(mockStatement.bind).toHaveBeenCalledWith(
        'REQ123',
        'user456',
        'user456/REQ123/data.csv',
        'processing',
        request.createdAt
      );
      expect(mockStatement.run).toHaveBeenCalled();
    });

    test('creates request with pending status', async () => {
      const request = {
        requestId: 'REQ789',
        userId: 'user999',
        fileKey: 'user999/REQ789/report.pdf',
        status: 'pending' as const,
        createdAt: 1234567890
      };

      await repository.create(request);

      expect(mockStatement.bind).toHaveBeenCalledWith(
        'REQ789',
        'user999',
        'user999/REQ789/report.pdf',
        'pending',
        1234567890
      );
    });

    test('handles database errors', async () => {
      const request = {
        requestId: 'REQ123',
        userId: 'user456',
        fileKey: 'file.csv',
        status: 'processing' as const,
        createdAt: Date.now()
      };

      mockStatement.run.mockRejectedValue(new Error('Database constraint violation'));

      await expect(repository.create(request)).rejects.toThrow('Database constraint violation');
    });

    test('uses correct SQL column names', async () => {
      const request = {
        requestId: 'REQ123',
        userId: 'user456',
        fileKey: 'file.csv',
        status: 'processing' as const,
        createdAt: Date.now()
      };

      await repository.create(request);

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringMatching(/request_id.*user_id.*file_key.*status.*created_at/)
      );
    });
  });

  describe('findById', () => {
    test('returns analysis request when found', async () => {
      const mockRequest = {
        request_id: 'REQ123',
        user_id: 'user456',
        file_key: 'user456/REQ123/data.csv',
        status: 'completed',
        created_at: 1234567890,
        completed_at: 1234567900
      };

      mockStatement.first.mockResolvedValue(mockRequest);

      const result = await repository.findById('REQ123');

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM analysis_requests WHERE request_id = ?')
      );
      expect(mockStatement.bind).toHaveBeenCalledWith('REQ123');
      expect(result).toEqual(mockRequest);
    });

    test('returns null when request not found', async () => {
      mockStatement.first.mockResolvedValue(null);

      const result = await repository.findById('NONEXISTENT');

      expect(result).toBeNull();
    });

    test('returns null when database returns undefined', async () => {
      mockStatement.first.mockResolvedValue(undefined);

      const result = await repository.findById('REQ123');

      expect(result).toBeNull();
    });

    test('queries with correct request ID', async () => {
      await repository.findById('REQ999');

      expect(mockStatement.bind).toHaveBeenCalledWith('REQ999');
    });

    test('handles database errors', async () => {
      mockStatement.first.mockRejectedValue(new Error('Database connection failed'));

      await expect(repository.findById('REQ123')).rejects.toThrow('Database connection failed');
    });

    test('returns request with error message when present', async () => {
      const mockRequest = {
        request_id: 'REQ123',
        user_id: 'user456',
        file_key: 'file.csv',
        status: 'failed',
        created_at: 1234567890,
        error_message: 'AI analysis timeout'
      };

      mockStatement.first.mockResolvedValue(mockRequest);

      const result = await repository.findById('REQ123');

      expect(result).toEqual(mockRequest);
    });
  });

  describe('updateStatus', () => {
    test('updates status without error message', async () => {
      await repository.updateStatus('REQ123', 'completed', 1234567900);

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE analysis_requests')
      );
      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('SET status = ?, completed_at = ?')
      );
      expect(mockStatement.bind).toHaveBeenCalledWith('completed', 1234567900, 'REQ123');
      expect(mockStatement.run).toHaveBeenCalled();
    });

    test('updates status with error message', async () => {
      await repository.updateStatus(
        'REQ123',
        'failed',
        1234567900,
        'AI service unavailable'
      );

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE analysis_requests')
      );
      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('SET status = ?, error_message = ?, completed_at = ?')
      );
      expect(mockStatement.bind).toHaveBeenCalledWith(
        'failed',
        'AI service unavailable',
        1234567900,
        'REQ123'
      );
    });

    test('updates to processing status', async () => {
      await repository.updateStatus('REQ456', 'processing');

      expect(mockStatement.bind).toHaveBeenCalledWith('processing', undefined, 'REQ456');
    });

    test('updates to failed status with error', async () => {
      const timestamp = Date.now();
      await repository.updateStatus(
        'REQ789',
        'failed',
        timestamp,
        'File validation failed'
      );

      expect(mockStatement.bind).toHaveBeenCalledWith(
        'failed',
        'File validation failed',
        timestamp,
        'REQ789'
      );
    });

    test('handles database errors', async () => {
      mockStatement.run.mockRejectedValue(new Error('Update failed'));

      await expect(
        repository.updateStatus('REQ123', 'completed', Date.now())
      ).rejects.toThrow('Update failed');
    });

    test('uses different SQL for error message updates', async () => {
      // Without error message
      await repository.updateStatus('REQ1', 'completed', 123);
      const sqlWithoutError = mockDb.prepare.mock.calls[0][0];

      mockDb.prepare.mockClear();

      // With error message
      await repository.updateStatus('REQ2', 'failed', 456, 'Error');
      const sqlWithError = mockDb.prepare.mock.calls[0][0];

      expect(sqlWithoutError).not.toContain('error_message');
      expect(sqlWithError).toContain('error_message');
    });
  });

  describe('countUserRequestsSince', () => {
    test('returns count of user requests in time window', async () => {
      mockStatement.first.mockResolvedValue({ count: 5 });

      const windowStart = Date.now() - 15 * 60 * 1000; // 15 minutes ago
      const count = await repository.countUserRequestsSince('user123', windowStart);

      expect(count).toBe(5);
      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('SELECT COUNT(*) as count')
      );
      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('WHERE user_id = ? AND created_at >= ?')
      );
      expect(mockStatement.bind).toHaveBeenCalledWith('user123', windowStart);
    });

    test('returns 0 when no requests found', async () => {
      mockStatement.first.mockResolvedValue({ count: 0 });

      const count = await repository.countUserRequestsSince('user456', Date.now());

      expect(count).toBe(0);
    });

    test('returns 0 when result is null', async () => {
      mockStatement.first.mockResolvedValue(null);

      const count = await repository.countUserRequestsSince('user789', Date.now());

      expect(count).toBe(0);
    });

    test('returns 0 when count is null', async () => {
      mockStatement.first.mockResolvedValue({ count: null });

      const count = await repository.countUserRequestsSince('user999', Date.now());

      expect(count).toBe(0);
    });

    test('handles large counts', async () => {
      mockStatement.first.mockResolvedValue({ count: 1000 });

      const count = await repository.countUserRequestsSince('user123', 0);

      expect(count).toBe(1000);
    });

    test('queries with correct time window', async () => {
      const windowStart = 1234567890;
      await repository.countUserRequestsSince('user123', windowStart);

      expect(mockStatement.bind).toHaveBeenCalledWith('user123', 1234567890);
    });

    test('handles database errors', async () => {
      mockStatement.first.mockRejectedValue(new Error('Query failed'));

      await expect(
        repository.countUserRequestsSince('user123', Date.now())
      ).rejects.toThrow('Query failed');
    });
  });

  describe('getOldestRequestTime', () => {
    test('returns oldest request timestamp', async () => {
      const oldestTime = 1234567890;
      mockStatement.first.mockResolvedValue({ oldest: oldestTime });

      const result = await repository.getOldestRequestTime('user123', Date.now() - 1000000);

      expect(result).toBe(oldestTime);
      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('SELECT MIN(created_at) as oldest')
      );
      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('WHERE user_id = ? AND created_at >= ?')
      );
    });

    test('returns null when no requests found', async () => {
      mockStatement.first.mockResolvedValue(null);

      const result = await repository.getOldestRequestTime('user456', Date.now());

      expect(result).toBeNull();
    });

    test('returns null when oldest is null', async () => {
      mockStatement.first.mockResolvedValue({ oldest: null });

      const result = await repository.getOldestRequestTime('user789', Date.now());

      expect(result).toBeNull();
    });

    test('queries with correct parameters', async () => {
      const since = Date.now() - 900000;
      await repository.getOldestRequestTime('user123', since);

      expect(mockStatement.bind).toHaveBeenCalledWith('user123', since);
    });

    test('handles database errors', async () => {
      mockStatement.first.mockRejectedValue(new Error('MIN aggregate failed'));

      await expect(
        repository.getOldestRequestTime('user123', Date.now())
      ).rejects.toThrow('MIN aggregate failed');
    });

    test('handles very old timestamps', async () => {
      const veryOld = 946684800000; // Year 2000
      mockStatement.first.mockResolvedValue({ oldest: veryOld });

      const result = await repository.getOldestRequestTime('user123', 0);

      expect(result).toBe(veryOld);
    });

    test('returns number type for oldest time', async () => {
      mockStatement.first.mockResolvedValue({ oldest: 1234567890 });

      const result = await repository.getOldestRequestTime('user123', 0);

      expect(typeof result).toBe('number');
    });
  });

  describe('integration scenarios', () => {
    test('create and retrieve request flow', async () => {
      const request = {
        requestId: 'REQ123',
        userId: 'user456',
        fileKey: 'user456/REQ123/data.csv',
        status: 'processing' as const,
        createdAt: 1234567890
      };

      // Create request
      await repository.create(request);

      // Mock the retrieval
      mockStatement.first.mockResolvedValue({
        request_id: request.requestId,
        user_id: request.userId,
        file_key: request.fileKey,
        status: request.status,
        created_at: request.createdAt
      });

      // Retrieve request
      const retrieved = await repository.findById('REQ123');

      expect(retrieved).toBeDefined();
      expect(retrieved?.request_id).toBe('REQ123');
    });

    test('create, update, and retrieve request with error', async () => {
      const request = {
        requestId: 'REQ456',
        userId: 'user789',
        fileKey: 'file.csv',
        status: 'pending' as const,
        createdAt: 1234567890
      };

      // Create
      await repository.create(request);

      // Update with error
      await repository.updateStatus(
        'REQ456',
        'failed',
        1234567900,
        'Processing timeout'
      );

      // Verify update call
      expect(mockStatement.bind).toHaveBeenCalledWith(
        'failed',
        'Processing timeout',
        1234567900,
        'REQ456'
      );
    });

    test('rate limiting scenario - count requests', async () => {
      const userId = 'user123';
      const windowStart = Date.now() - 15 * 60 * 1000;

      // Mock 8 requests in window
      mockStatement.first.mockResolvedValue({ count: 8 });

      const count = await repository.countUserRequestsSince(userId, windowStart);

      expect(count).toBe(8);
      // User has 2 more requests before hitting limit of 10
    });

    test('rate limiting scenario - get oldest request', async () => {
      const userId = 'user123';
      const windowStart = Date.now() - 15 * 60 * 1000;
      const oldestTime = windowStart + 60000; // 1 minute after window start

      mockStatement.first.mockResolvedValue({ oldest: oldestTime });

      const oldest = await repository.getOldestRequestTime(userId, windowStart);

      expect(oldest).toBe(oldestTime);
      // Can calculate when user's oldest request will expire
    });

    test('complete request lifecycle', async () => {
      const requestId = 'REQ999';
      const userId = 'user999';
      const createdAt = Date.now();

      // 1. Create
      await repository.create({
        requestId,
        userId,
        fileKey: 'user999/REQ999/data.csv',
        status: 'pending',
        createdAt
      });

      // 2. Update to processing
      await repository.updateStatus(requestId, 'processing');

      // 3. Update to completed
      const completedAt = createdAt + 5000;
      await repository.updateStatus(requestId, 'completed', completedAt);

      // Verify all three database operations occurred
      expect(mockDb.prepare).toHaveBeenCalledTimes(3);
      expect(mockStatement.run).toHaveBeenCalledTimes(3);
    });
  });

  describe('edge cases', () => {
    test('handles very long request IDs', async () => {
      const longId = 'REQ' + 'X'.repeat(200);

      await repository.findById(longId);

      expect(mockStatement.bind).toHaveBeenCalledWith(longId);
    });

    test('handles special characters in error messages', async () => {
      const errorMessage = "Error: File contains invalid characters: \n\t\"special\"";

      await repository.updateStatus('REQ123', 'failed', Date.now(), errorMessage);

      expect(mockStatement.bind).toHaveBeenCalledWith(
        'failed',
        errorMessage,
        expect.any(Number),
        'REQ123'
      );
    });

    test('handles zero timestamp', async () => {
      await repository.create({
        requestId: 'REQ123',
        userId: 'user456',
        fileKey: 'file.csv',
        status: 'pending',
        createdAt: 0
      });

      expect(mockStatement.bind).toHaveBeenCalledWith(
        'REQ123',
        'user456',
        'file.csv',
        'pending',
        0
      );
    });

    test('handles future timestamps', async () => {
      const futureTime = Date.now() + 1000000000;

      await repository.create({
        requestId: 'REQ123',
        userId: 'user456',
        fileKey: 'file.csv',
        status: 'pending',
        createdAt: futureTime
      });

      expect(mockStatement.bind).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        futureTime
      );
    });

    test('handles all status types', async () => {
      const statuses: AnalysisRequest['status'][] = ['pending', 'processing', 'completed', 'failed'];

      for (const status of statuses) {
        await repository.updateStatus('REQ123', status);
        expect(mockStatement.bind).toHaveBeenCalledWith(status, undefined, 'REQ123');
      }
    });
  });

  describe('constructor', () => {
    test('initializes with database instance', () => {
      const db = { prepare: vi.fn() };
      const repo = new AnalysisRequestRepository(db);

      expect(repo).toBeDefined();
    });

    test('works with any database implementation', () => {
      const customDb = {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnThis(),
          run: vi.fn(),
          first: vi.fn()
        })
      };

      const repo = new AnalysisRequestRepository(customDb);

      expect(repo).toBeDefined();
    });
  });
});
