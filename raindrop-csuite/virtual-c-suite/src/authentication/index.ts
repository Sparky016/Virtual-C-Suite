import { AppBindings } from '../config/env';
import { Env } from '../upload-api/raindrop.gen';
import { AuthService } from '../services/AuthService';
import { LoggerService } from '../services/LoggerService';
import { Service } from '@liquidmetal-ai/raindrop-framework';
import { serve } from '@hono/node-server';
import { config } from 'dotenv';
import { COOKIE_OPTIONS, SESSION_COOKIE_NAME, CLEAR_COOKIE_OPTIONS } from '../shared/cookie-config';
import { decodeJwt } from 'jose';
import { getCookie, setCookie } from 'hono/cookie';
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';

// Load environment variables from .env file
config();

const app = new Hono<{ Bindings: AppBindings }>();

// Middleware
app.use('*', logger());
app.use('*', async (c, next) => {
    const corsMiddleware = cors({
        origin: (origin) => {
            const allowedOrigins = c.env.ALLOWED_ORIGINS?.split(',') || ['*'];
            if (allowedOrigins.includes('*')) return origin;
            return allowedOrigins.includes(origin) ? origin : null;
        },
        credentials: true,
    });
    return corsMiddleware(c, next);
});

if (process.env.START_LOCAL_SERVER === 'true') {
    const port = parseInt(process.env.PORT || '3003');
    console.log(`Auth Server is running on port ${port}`);

    const env = {
        ...process.env,
    };

    serve({
        fetch: (request) => app.fetch(request, env),
        port
    });
}

// Health check endpoint
app.get('/health', (c) => {
    return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// POST /auth/login - Create session cookie from ID token
app.post('/auth/login', async (c) => {
    try {
        const body = await c.req.json();
        const idToken = body.idToken;

        if (!idToken) {
            return c.json({ error: 'ID token is required' }, 400);
        }

        const logger = new LoggerService(c.env.POSTHOG_API_KEY);
        const authService = new AuthService(logger);

        // Verify the ID token first
        await authService.verifyIdToken(idToken);

        // Create session cookie (5 days)
        const expiresIn = 60 * 60 * 24 * 5 * 1000;
        const sessionCookie = await authService.createSessionCookie(idToken, expiresIn);

        // Store session in secure HTTP-only cookie
        setCookie(c, SESSION_COOKIE_NAME, sessionCookie, { ...COOKIE_OPTIONS, maxAge: expiresIn / 1000 });

        return c.json({ status: 'success' });
    } catch (error: any) {
        const logger = new LoggerService(c.env.POSTHOG_API_KEY);
        logger.error('Login failed', error);
        return c.json({ error: 'Unauthorized' }, 401);
    }
});

// GET /auth/user - Get current user from session cookie
app.get('/auth/user', async (c) => {
    try {
        const sessionCookie = getCookie(c, SESSION_COOKIE_NAME);

        if (!sessionCookie) {
            return c.json({ error: 'No session found' }, 401);
        }

        const logger = new LoggerService(c.env.POSTHOG_API_KEY);
        const authService = new AuthService(logger);

        // Verify session cookie
        const decodedClaims = await authService.verifySessionCookie(sessionCookie);

        // Optionally fetch full user record
        const userRecord = await authService.getUser(decodedClaims.uid);

        return c.json({
            uid: userRecord.uid,
            email: userRecord.email,
            displayName: userRecord.displayName,
            photoURL: userRecord.photoURL,
            // Add other needed fields
        });

    } catch (error: any) {
        const logger = new LoggerService(c.env.POSTHOG_API_KEY);
        logger.error('Failed to get user session', error);

        if (error.code === 'auth/session-cookie-expired') {
            setCookie(c, SESSION_COOKIE_NAME, '', CLEAR_COOKIE_OPTIONS);
            return c.json({ error: 'Session expired' }, 401);
        }

        return c.json({ error: 'Invalid session' }, 401);
    }
});

// GET /auth/logout - Logout and clear session
app.get('/auth/logout', async (c) => {
    const logger = new LoggerService(c.env.POSTHOG_API_KEY);
    const sessionCookie = getCookie(c, SESSION_COOKIE_NAME);

    // Clear cookie first
    setCookie(c, SESSION_COOKIE_NAME, '', CLEAR_COOKIE_OPTIONS);

    if (sessionCookie) {
        try {
            const authService = new AuthService(logger);
            const decodedClaims = await authService.verifySessionCookie(sessionCookie);
            await authService.revokeRefreshTokens(decodedClaims.uid);
            logger.info(`User ${decodedClaims.uid} logged out`);
        } catch (error) {
            // Ignore errors during logout (e.g. invalid cookie)
            logger.warn('Error during logout revocation', error);
        }
    }

    const frontendUrl = c.env.FRONTEND_URL || 'http://localhost:5173/';
    return c.redirect(frontendUrl);
});

export default class extends Service<Env> {
    async fetch(request: Request): Promise<Response> {
        return app.fetch(request, this.env);
    }
}
