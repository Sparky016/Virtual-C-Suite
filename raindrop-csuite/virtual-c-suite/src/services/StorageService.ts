import { Bucket, BucketListOptions, BucketPutOptions } from '@liquidmetal-ai/raindrop-framework';

export interface StorageSearchResult {
    results: any[];
    pagination: any;
}

export interface StorageChatResult {
    answer: string;
}

export class StorageService {
    private bucket: Bucket;

    constructor(bucket: Bucket) {
        this.bucket = bucket;
    }

    async put(key: string, body: Uint8Array | string, options?: BucketPutOptions): Promise<any> {
        return this.bucket.put(key, body, options);
    }

    async get(key: string): Promise<any> {
        return this.bucket.get(key);
    }

    async list(options?: BucketListOptions): Promise<any> {
        return this.bucket.list(options);
    }

    async delete(key: string): Promise<void> {
        return this.bucket.delete(key);
    }

    // Abstraction for SmartBucket specific methods (casting to any internally if needed, or assuming interface extension)
    async search(query: string, page: number = 1, pageSize: number = 10, requestId?: string): Promise<StorageSearchResult> {
        const smartBucket = this.bucket as any;
        if (!smartBucket.search) {
            throw new Error('Search not supported on this bucket');
        }

        if (page === 1) {
            if (!requestId) requestId = `search-${Date.now()}`;
            return smartBucket.search({ input: query, requestId });
        } else {
            if (!requestId) throw new Error('requestId required for pagination');
            return smartBucket.getPaginatedResults({ requestId, page, pageSize });
        }
    }

    async documentChat(objectId: string, query: string, requestId?: string): Promise<StorageChatResult> {
        const smartBucket = this.bucket as any;
        if (!smartBucket.documentChat) {
            throw new Error('Document chat not supported on this bucket');
        }

        if (!requestId) requestId = `chat-${Date.now()}`;
        return smartBucket.documentChat({ objectId, input: query, requestId });
    }
}
