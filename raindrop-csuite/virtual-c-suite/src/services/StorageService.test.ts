import { describe, it, expect, vi } from 'vitest';
import { StorageService } from './StorageService';

// Mock Bucket
const createMockBucket = () => {
    return {
        put: vi.fn(),
        get: vi.fn(),
        list: vi.fn(),
        search: vi.fn(),
        getPaginatedResults: vi.fn(),
        documentChat: vi.fn(),
    };
};

describe('StorageService', () => {
    describe('Standard Operations', () => {
        it('should list objects', async () => {
            const mockBucket = createMockBucket();
            const service = new StorageService(mockBucket as any);

            mockBucket.list.mockResolvedValue({ objects: [], truncated: false });

            const result = await service.list({ prefix: 'test' });

            expect(mockBucket.list).toHaveBeenCalledWith({ prefix: 'test' });
            expect(result).toEqual({ objects: [], truncated: false });
        });

        it('should get an object', async () => {
            const mockBucket = createMockBucket();
            const service = new StorageService(mockBucket as any);

            const mockObj = { body: 'content' };
            mockBucket.get.mockResolvedValue(mockObj);

            const result = await service.get('key');

            expect(mockBucket.get).toHaveBeenCalledWith('key');
            expect(result).toBe(mockObj);
        });

        it('should put an object', async () => {
            const mockBucket = createMockBucket();
            const service = new StorageService(mockBucket as any);

            mockBucket.put.mockResolvedValue({ key: 'key' });

            await service.put('key', 'content');

            expect(mockBucket.put).toHaveBeenCalledWith('key', 'content', undefined);
        });
    });

    describe('SmartBucket Operations', () => {
        it('should search with pagination', async () => {
            const mockBucket = createMockBucket();
            const service = new StorageService(mockBucket as any);

            mockBucket.search.mockResolvedValue({ results: [] });

            await service.search('query', 1);

            expect(mockBucket.search).toHaveBeenCalledWith(expect.objectContaining({
                input: 'query',
                requestId: expect.stringContaining('search-')
            }));
        });

        it('should search page 2 with requestId', async () => {
            const mockBucket = createMockBucket();
            const service = new StorageService(mockBucket as any);

            mockBucket.getPaginatedResults.mockResolvedValue({ results: [] });

            await service.search('query', 2, 10, 'req-id');

            expect(mockBucket.getPaginatedResults).toHaveBeenCalledWith({
                requestId: 'req-id',
                page: 2,
                pageSize: 10
            });
        });

        it('should throw error if search not supported', async () => {
            const mockBucket = { put: vi.fn(), get: vi.fn(), list: vi.fn() }; // No search
            const service = new StorageService(mockBucket as any);

            await expect(service.search('query')).rejects.toThrow('Search not supported');
        });

        it('should perform document chat', async () => {
            const mockBucket = createMockBucket();
            const service = new StorageService(mockBucket as any);

            mockBucket.documentChat.mockResolvedValue({ answer: 'answer' });

            await service.documentChat('obj-id', 'question');

            expect(mockBucket.documentChat).toHaveBeenCalledWith(expect.objectContaining({
                objectId: 'obj-id',
                input: 'question',
                requestId: expect.stringContaining('chat-')
            }));
        });

        it('should throw error if document chat not supported', async () => {
            const mockBucket = { put: vi.fn(), get: vi.fn(), list: vi.fn() }; // No chat
            const service = new StorageService(mockBucket as any);

            await expect(service.documentChat('id', 'q')).rejects.toThrow('Document chat not supported');
        });
    });
});
