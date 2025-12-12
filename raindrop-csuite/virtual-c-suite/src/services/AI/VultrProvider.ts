import { AIProvider, AIChatOptions } from './AIProvider';

export class VultrProvider implements AIProvider {
    private apiKey: string;
    private baseUrl = 'https://api.vultrinference.com/v1'; // Updated to match RAG docs

    constructor(apiKey: string) {
        if (!apiKey) throw new Error('API key is required');
        this.apiKey = apiKey;
    }

    async run(model: string, options: any): Promise<any> {
        // Adapter to make Vultr look like Cloudflare AI for simple cases
        // Or just implement direct fetch
        if (options.messages) {
            return this.chat({
                model,
                messages: options.messages,
                temperature: options.temperature,
                max_tokens: options.max_tokens,
                stream: options.stream,
                collectionId: options.collectionId
            });
        }
        throw new Error('Vultr provider only supports chat/messages format currently');
    }

    async chat(options: AIChatOptions): Promise<any> {
        const isRAG = !!options.collectionId;
        const endpoint = isRAG ? '/chat/completions/RAG' : '/chat/completions';

        const body: any = {
            model: options.model,
            messages: options.messages,
            temperature: options.temperature,
            max_tokens: options.max_tokens,
            stream: options.stream
        };

        if (isRAG) {
            body.collection = options.collectionId;
        }

        const response = await fetch(`${this.baseUrl}${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Vultr API Error: ${response.status} - ${errorText}`);
        }

        if (options.stream) {
            if (!response.body) throw new Error('No body in response');
            return response.body; // Return ReadableStream for standard streaming
        }

        return await response.json();
    }

    async createVectorStore(name: string): Promise<string> {
        if (!name) throw new Error('Collection name is required');
        const response = await fetch(`${this.baseUrl}/vector_store`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`
            },
            body: JSON.stringify({ name })
        });

        if (!response.ok) {
            throw new Error(`Failed to create vector store: ${response.statusText}`);
        }

        const data: any = await response.json();
        return data.id;
    }

    async addVectorStoreItem(collectionId: string, text: string, description?: string): Promise<void> {
        if (!collectionId) throw new Error('Collection id is required');
        if (!text) throw new Error('Text is required');
        if (!description) throw new Error('Description is required');

        const response = await fetch(`${this.baseUrl}/vector_store/${collectionId}/items`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`
            },
            body: JSON.stringify({
                text,
                description,
                chunk: true // Auto-chunking
            })
        });

        if (!response.ok) {
            throw new Error(`Failed to add item to vector store: ${response.statusText}`);
        }
    }
}
