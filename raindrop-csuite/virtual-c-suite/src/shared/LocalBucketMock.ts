
import * as fs from 'fs';
import * as path from 'path';

export class LocalBucketMock {
    private basePath: string;

    constructor(basePath: string) {
        this.basePath = basePath;
        if (!fs.existsSync(this.basePath)) {
            fs.mkdirSync(this.basePath, { recursive: true });
        }
    }

    async put(key: string, body: any, options?: any): Promise<any> {
        const filePath = path.join(this.basePath, key);
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        // Handle different body types (string, ReadableStream, Uint8Array)
        let content: any = body;
        if (body instanceof ReadableStream) {
            // Simple conversion for mock purposes (not streaming efficient but works for tests)
            const reader = body.getReader();
            const chunks = [];
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                chunks.push(value);
            }
            content = Buffer.concat(chunks);
        } else if (body instanceof Uint8Array) {
            content = Buffer.from(body);
        }

        fs.writeFileSync(filePath, content);

        return {
            key,
            size: fs.statSync(filePath).size,
            etag: 'mock-etag-' + Date.now(),
            httpMetadata: options?.httpMetadata,
            customMetadata: options?.customMetadata
        };
    }

    async get(key: string): Promise<any> {
        const filePath = path.join(this.basePath, key);
        if (!fs.existsSync(filePath)) {
            return null;
        }

        const stats = fs.statSync(filePath);
        const body = fs.readFileSync(filePath);

        return {
            key,
            size: stats.size,
            etag: 'mock-etag',
            httpMetadata: { contentType: 'application/octet-stream' }, // simplified
            customMetadata: {},
            body: body, // In real R2 this is a ReadableStream, but Hono often handles Buffer too depending on usage
            arrayBuffer: async () => body.buffer,
            text: async () => body.toString(),
            json: async () => JSON.parse(body.toString())
        };
    }

    async delete(key: string): Promise<void> {
        const filePath = path.join(this.basePath, key);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    }

    async list(options?: any): Promise<any> {
        // Simplified list implementation
        const files: any[] = [];
        const traverse = (dir: string) => {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                const relativeKey = path.relative(this.basePath, fullPath).replace(/\\/g, '/');

                if (options?.prefix && !relativeKey.startsWith(options.prefix)) {
                    if (entry.isDirectory()) traverse(fullPath); // Continue searching subdirs?
                    continue;
                }

                if (entry.isDirectory()) {
                    traverse(fullPath);
                } else {
                    const stats = fs.statSync(fullPath);
                    files.push({
                        key: relativeKey,
                        size: stats.size,
                        uploaded: stats.mtime,
                        etag: 'mock-etag'
                    });
                }
            }
        }
        traverse(this.basePath);

        return {
            objects: files,
            truncated: false,
            cursor: undefined
        };
    }
}
