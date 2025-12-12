
export interface AIChatMessage {
    role: string;
    content: string;
}

export interface AIChatOptions {
    model: string;
    messages: AIChatMessage[];
    temperature?: number;
    max_tokens?: number;
    stream?: boolean;
    collectionId?: string; // For RAG
}

export interface AIProvider {
    /**
     * Run a completion task (generic AI.run replacement)
     */
    run(model: string, options: any): Promise<any>;

    /**
     * Specialized chat method
     */
    chat(options: AIChatOptions): Promise<any>;
}
