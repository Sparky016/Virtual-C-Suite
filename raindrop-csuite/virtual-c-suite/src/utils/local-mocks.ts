export class MockD1Database {
    prepare(query: string) {
        return {
            bind: (...args: any[]) => {
                return {
                    first: async () => {
                        // Return defaults that work for RateLimiter and AnalysisRequest
                        return {
                            count: 0,
                            oldest: Date.now(),
                            request_id: 'mock-request-id',
                            user_id: 'mock-user-id',
                            file_key: 'mock-file-key',
                            status: 'processing',
                            created_at: Date.now(),
                            // executive_analyses
                            executive_role: 'CFO',
                            analysis_text: 'Mock analysis',
                            // final_report
                            report_content: 'Mock report content',
                            report_key: 'mock-report-key'
                        };
                    },
                    run: async () => {
                        return { success: true };
                    },
                    all: async () => {
                        return { results: [] };
                    }
                };
            }
        };
    }
}

export class MockBucket {
    async put(key: string, body: any, options?: any) {
        console.log(`[MockBucket] put ${key}`);
        return { key };
    }
    async get(key: string) {
        console.log(`[MockBucket] get ${key}`);
        return null;
    }
    async list(options?: any) {
        console.log(`[MockBucket] list`);
        return { objects: [], truncated: false };
    }
    // SmartBucket methods
    async search(options: any) {
        console.log(`[MockBucket] search`);
        return { results: [], pagination: {} };
    }
    async documentChat(options: any) {
        console.log(`[MockBucket] chat`);
        return { answer: "This is a mock answer." };
    }
}

export class MockKV {
    async put(key: string, value: any, options?: any) {
        console.log(`[MockKV] put ${key}`);
    }
    async get(key: string) {
        console.log(`[MockKV] get ${key}`);
        return null;
    }
}

export class MockAI {
    async run(model: string, options: any) {
        console.log(`[MockAI] run ${model}`);
        return { response: "Mock AI response" };
    }
}

export class RaindropAI {
    private apiUrl: string;
    private apiKey: string;

    constructor() {
        this.apiUrl = process.env.RAINDROP_API_URL || 'https://svc-01kbq2wytx4bs28v44fr4z0pab.01kaznjk8gmz58tjkr7a40m5xj.lmapp.run';
        this.apiKey = process.env.RAINDROP_API_KEY || '';

        if (!this.apiKey) {
            console.warn('[RaindropAI] Missing RAINDROP_API_KEY. Calls might fail if auth is required.');
        }
    }

    async run(model: string, inputs: any) {
        console.log(`[RaindropAI] run ${model} against ${this.apiUrl}`);

        try {
            // Include model in body as Raindrop service expects it
            const body = {
                model,
                ...inputs
            };

            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Raindrop AI API Error (${response.status}): ${errorText}`);
            }

            const result = await response.json() as any;
            return result.result || result;
        } catch (error) {
            console.error('[RaindropAI] Error calling AI API:', error);
            throw error;
        }
    }
}
