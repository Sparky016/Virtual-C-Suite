
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { SambaNovaProvider } from '../SambaNovaProvider';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch as any;

describe('SambaNovaProvider', () => {
    let provider: SambaNovaProvider;
    const apiKey = 'test-api-key';

    beforeEach(() => {
        provider = new SambaNovaProvider(apiKey);
        mockFetch.mockClear();
    });

    describe('initialization', () => {
        it('should initialize with api key', () => {
            expect(provider).toBeInstanceOf(SambaNovaProvider);
        });
    });

    describe('chat', () => {
        it('should call correct endpoint with correct headers and body', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    choices: [{
                        message: {
                            role: 'assistant',
                            content: 'Test response'
                        }
                    }]
                })
            });

            const options = {
                model: 'Meta-Llama-3.1-70B-Instruct',
                messages: [{ role: 'user', content: 'Hello' }],
                temperature: 0.7,
                max_tokens: 100
            };

            const result = await provider.chat(options as any);

            expect(mockFetch).toHaveBeenCalledWith(
                'https://api.sambanova.ai/v1/chat/completions',
                expect.objectContaining({
                    method: 'POST',
                    headers: expect.objectContaining({
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`
                    }),
                    body: JSON.stringify({
                        model: options.model,
                        messages: options.messages,
                        temperature: options.temperature,
                        max_tokens: options.max_tokens,
                        stream: undefined
                    })
                })
            );

            expect(result.choices[0].message.content).toBe('Test response');
        });

        it('should handle API errors correctly', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 401,
                text: async () => 'Unauthorized'
            });

            const options = {
                model: 'demo-model',
                messages: [{ role: 'user', content: 'hi' }]
            };

            await expect(provider.chat(options)).rejects.toThrow('SambaNova API Error: 401 - Unauthorized');
        });

        it('should handle streaming responses', async () => {
            const mockStream = new ReadableStream({
                start(controller) {
                    controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n'));
                    controller.close();
                }
            });

            mockFetch.mockResolvedValueOnce({
                ok: true,
                body: mockStream
            });

            const result = await provider.chat({
                model: 'demo-model',
                messages: [{ role: 'user', content: 'hi' }],
                stream: true
            });

            expect(result).toBeInstanceOf(ReadableStream);
        });

        it('should throw error if streaming response has no body', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                body: null
            });

            await expect(provider.chat({
                model: 'demo-model',
                messages: [{ role: 'user', content: 'hi' }],
                stream: true
            })).rejects.toThrow('No body in response');
        });
    });

    describe('run (adapter)', () => {
        it('should adapt run call to chat', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ choices: [{ message: { content: 'Adapted response' } }] })
            });

            const result = await provider.run('demo-model', {
                messages: [{ role: 'user', content: 'hello' }],
                temperature: 0.5
            });

            expect(mockFetch).toHaveBeenCalledWith(
                'https://api.sambanova.ai/v1/chat/completions',
                expect.objectContaining({
                    body: expect.stringContaining('"temperature":0.5')
                })
            );
            expect(result.choices[0].message.content).toBe('Adapted response');
        });

        it('should throw error if run called without messages', async () => {
            await expect(provider.run('demo-model', {})).rejects.toThrow('SambaNova provider only supports chat/messages format currently');
        });
    });
});
