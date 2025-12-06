import { describe, it, expect, vi } from 'vitest';
import { CacheService } from './CacheService';

// Mock KvCache
const createMockCache = () => {
    return {
        put: vi.fn(),
        get: vi.fn(),
    };
};

describe('CacheService', () => {
    it('should put string value', async () => {
        const mockCache = createMockCache();
        const service = new CacheService(mockCache as any);

        await service.put('key', 'value');

        expect(mockCache.put).toHaveBeenCalledWith('key', 'value', {});
    });

    it('should put object value as json', async () => {
        const mockCache = createMockCache();
        const service = new CacheService(mockCache as any);

        const obj = { foo: 'bar' };
        await service.put('key', obj);

        expect(mockCache.put).toHaveBeenCalledWith('key', JSON.stringify(obj), {});
    });

    it('should put value with ttl', async () => {
        const mockCache = createMockCache();
        const service = new CacheService(mockCache as any);

        await service.put('key', 'value', 60);

        expect(mockCache.put).toHaveBeenCalledWith('key', 'value', { expirationTtl: 60 });
    });

    it('should get value', async () => {
        const mockCache = createMockCache();
        const service = new CacheService(mockCache as any);

        mockCache.get.mockResolvedValue('value');

        const result = await service.get('key');

        expect(mockCache.get).toHaveBeenCalledWith('key', { type: 'json' });
        expect(result).toBe('value');
    });

    it('should get value with specific type', async () => {
        const mockCache = createMockCache();
        const service = new CacheService(mockCache as any);

        mockCache.get.mockResolvedValue('value');

        await service.get('key', 'text');

        expect(mockCache.get).toHaveBeenCalledWith('key', { type: 'text' });
    });
});
