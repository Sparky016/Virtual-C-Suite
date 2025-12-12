import { AIProvider, AIChatOptions } from './AIProvider';

export class CloudflareProvider implements AIProvider {
    private ai: any; // Cloudflare AI binding

    constructor(ai: any) {
        this.ai = ai;
    }

    async run(model: string, options: any): Promise<any> {
        return this.ai.run(model, options);
    }

    async chat(options: AIChatOptions): Promise<any> {
        return this.ai.run(options.model, {
            messages: options.messages,
            temperature: options.temperature,
            max_tokens: options.max_tokens,
            stream: options.stream
        });
    }
}
