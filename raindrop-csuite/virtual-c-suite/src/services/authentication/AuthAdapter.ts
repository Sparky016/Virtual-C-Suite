import type { KvCache } from '@liquidmetal-ai/raindrop-framework';
import { LoggerService } from '../Logger/LoggerService';

export const createKeyStore = (kvCache: KvCache, logger: LoggerService) => ({
    get: async <ExpectedValue = unknown>(): Promise<ExpectedValue | null> => {
        try {
            const value = await kvCache.get<ExpectedValue>('firebase-public-jwk');
            return value;
        } catch (error) {
            logger.error('Error getting public JWK from cache:', error);
            return null;
        }
    },
    put: async (value: string, expirationTtl: number): Promise<void> => {
        try {
            await kvCache.put('firebase-public-jwk', value, { expirationTtl });
        } catch (error) {
            logger.error('Error putting public JWK to cache:', error);
        }
    }
});
