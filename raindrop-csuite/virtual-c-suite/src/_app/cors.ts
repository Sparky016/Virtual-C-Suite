import { createCorsHandler } from '@liquidmetal-ai/raindrop-framework/core/cors';

export const cors = createCorsHandler({
    origin: (request: Request, env: any) => {
        const origin = request.headers.get('origin');

        // Allow local development
        if (origin && (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:'))) {
            return origin;
        }

        // Check configured allowed origins
        const allowedOrigins = (env.ALLOWED_ORIGINS as string)?.split(',') || [];
        const defaultOrigins = [
            'https://virtual-csuite.netlify.app',
            'https://www.virtual-csuite.netlify.app'
        ];

        if (origin && (allowedOrigins.includes(origin) || defaultOrigins.includes(origin))) {
            return origin;
        }

        return null; // Block other origins
    },
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: true, // Needed if frontend sends auth headers/cookies
    maxAge: 86400
});
