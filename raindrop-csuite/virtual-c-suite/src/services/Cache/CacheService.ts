import { KvCache, KvCachePutOptions, KvCacheGetOptions } from '@liquidmetal-ai/raindrop-framework';

export class CacheService {
    private cache: KvCache;

    constructor(cache: KvCache) {
        this.cache = cache;
    }

    async put(key: string, value: any, ttl?: number): Promise<void> {
        const options: KvCachePutOptions = {};
        if (ttl) {
            options.expirationTtl = ttl;
        }
        await this.cache.put(key, typeof value === 'string' ? value : JSON.stringify(value), options);
    }

    async get<T>(key: string, type: 'json' | 'text' | 'arrayBuffer' | 'stream' = 'json'): Promise<T | null> {
        const options: KvCacheGetOptions<typeof type> = { type };
        return this.cache.get(key, options as any) as Promise<T | null>;
    }
}
