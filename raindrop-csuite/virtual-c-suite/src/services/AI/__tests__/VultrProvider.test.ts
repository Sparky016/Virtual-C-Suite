
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { VultrProvider } from '../VultrProvider';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch as any;

describe('VultrProvider', () => {
    let provider: VultrProvider;
    const apiKey = 'test-api-key';

    beforeEach(() => {
        provider = new VultrProvider(apiKey);
        mockFetch.mockClear();
    });

    it('should initialize with api key', () => {
        expect(provider).toBeInstanceOf(VultrProvider);
    });

    it('should throw error if api key is not provided', () => {
        expect(() => new VultrProvider('')).toThrow('API key is required');
    });

    it('should create vector store', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ id: 'new-collection-id' })
        });

        const id = await provider.createVectorStore('test-store');
        expect(id).toBe('new-collection-id');
        expect(mockFetch).toHaveBeenCalledWith(
            'https://api.vultrinference.com/v1/vector_store',
            expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({ name: 'test-store' }),
                headers: expect.objectContaining({ 'Authorization': 'Bearer test-api-key' })
            })
        );
    });

    it('should throw error if collection name is not provided', async () => {
        await expect(provider.createVectorStore('')).rejects.toThrow('Collection name is required');
    });

    it('should throw error if collection id is not provided', async () => {
        await expect(provider.addVectorStoreItem('', 'some text', 'desc')).rejects.toThrow('Collection id is required');
    });

    it('should throw error if text is not provided', async () => {
        await expect(provider.addVectorStoreItem('col-id', '', 'desc')).rejects.toThrow('Text is required');
    });

    it('should throw error if description is not provided', async () => {
        await expect(provider.addVectorStoreItem('col-id', 'some text', '')).rejects.toThrow('Description is required');
    });

    it('should add item to vector store', async () => {
        mockFetch.mockResolvedValueOnce({ ok: true });

        await provider.addVectorStoreItem('col-id', 'some text', 'desc');

        expect(mockFetch).toHaveBeenCalledWith(
            'https://api.vultrinference.com/v1/vector_store/col-id/items',
            expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({
                    text: 'some text',
                    description: 'desc',
                    chunk: true
                })
            })
        );
    });

    it('should use correct standard chat endpoint', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ choices: [{ message: { content: 'response' } }] })
        });

        await provider.chat({
            model: 'test-model',
            messages: [{ role: 'user', content: 'hello' }]
        });

        expect(mockFetch).toHaveBeenCalledWith(
            'https://api.vultrinference.com/v1/chat/completions',
            expect.objectContaining({
                method: 'POST',
                headers: expect.objectContaining({
                    'Authorization': `Bearer ${apiKey}`
                })
            })
        );
    });

    it('should use RAG endpoint when collectionId is provided', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ choices: [{ message: { content: 'rag response' } }] })
        });

        await provider.chat({
            model: 'test-model',
            messages: [{ role: 'user', content: 'hello' }],
            collectionId: 'test-collection'
        });

        expect(mockFetch).toHaveBeenCalledWith(
            'https://api.vultrinference.com/v1/chat/completions/RAG',
            expect.objectContaining({
                method: 'POST',
                body: expect.stringContaining('"collection":"test-collection"')
            })
        );
    });

    it('should handle API errors', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 400,
            text: async () => 'Bad Request'
        });

        await expect(provider.chat({
            model: 'test-model',
            messages: [{ role: 'user', content: 'hello' }]
        })).rejects.toThrow('Vultr API Error: 400 - Bad Request');
    });

    it('run method should adapter to chat', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ choices: [{ message: { content: 'response' } }] })
        });

        await provider.run('test-model', {
            messages: [{ role: 'user', content: 'hello' }]
        });

        expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should throw error if run called without messages', async () => {
        await expect(provider.run('test-model', {})).rejects.toThrow('Vultr provider only supports chat/messages format currently');
    });
});
