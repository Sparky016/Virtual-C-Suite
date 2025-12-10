import 'dotenv/config';
import { serve } from '@hono/node-server';
import { app } from './index';

const port = parseInt(process.env.PORT || '3003');
console.log(`Auth API server is running on port ${port}`);

process.env.FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'virtual-c-suite';

const mockMem = {
    get: async () => null,
    put: async () => { },
};

serve({
    fetch: (request, env) => {
        const fullEnv = {
            ...process.env,
            ...env,
            mem: mockMem,
            FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || 'virtual-c-suite',
        };
        return app.fetch(request, fullEnv);
    },
    port,
});
