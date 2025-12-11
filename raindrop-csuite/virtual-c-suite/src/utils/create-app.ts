import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import { AppBindings } from '../config/env';

/**
 * Creates a pre-configured, type-safe Hono application instance.
 * All common setup (middleware, environment types) is encapsulated here.
 */
export function createHonoApp(): Hono<{ Bindings: AppBindings }> {
    // Instantiate the Hono app with the shared AppBindings type
    const app = new Hono<{ Bindings: AppBindings }>();

    // Apply global middleware here that should run for ALL services
    app.use('*', logger());

    // Configure CORS
    // Note: Framework-level CORS is configured in src/_app/cors.ts
    // This provides application-level CORS for services
    app.use('*', async (c, next) => {
        const corsMiddleware = cors({
            origin: (origin) => {
                // Allow local development
                if (origin && (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:'))) {
                    return origin;
                }

                const allowedOrigins = c.env?.ALLOWED_ORIGINS?.split(',') || ['*'];
                if (allowedOrigins.includes('*')) return origin;
                return allowedOrigins.includes(origin) ? origin : null;
            },
            allowHeaders: ['Content-Type', 'Authorization', 'x-sambanova-key'],
            allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            credentials: true,
        });
        return corsMiddleware(c, next);
    });

    return app;
}

// Optional: Re-export the utility type for easier imports elsewhere
export type AppHono = Hono<{ Bindings: AppBindings }>;
