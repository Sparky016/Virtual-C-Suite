import { AIProvider, AIChatOptions } from './AIProvider';

export class SambaNovaProvider implements AIProvider {
    private apiKey: string;
    private baseUrl = 'https://api.sambanova.ai/v1'; // Standard OpenAI compatible endpoint

    constructor(apiKey: string) {
        this.apiKey = apiKey;
    }

    async run(model: string, options: any): Promise<any> {
        if (options.messages) {
            return this.chat({
                model,
                messages: options.messages,
                temperature: options.temperature,
                max_tokens: options.max_tokens,
                stream: options.stream
            });
        }
        throw new Error('SambaNova provider only supports chat/messages format currently');
    }

    async chat(options: AIChatOptions): Promise<any> {
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`
            },
            body: JSON.stringify({
                model: options.model,
                messages: options.messages,
                temperature: options.temperature,
                max_tokens: options.max_tokens,
                stream: options.stream
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`SambaNova API Error: ${response.status} - ${errorText}`);
        }

        if (options.stream) {
            if (!response.body) throw new Error('No body in response');
            return response.body;
        }

        return await response.json();
    }
}
