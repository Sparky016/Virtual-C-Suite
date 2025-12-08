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
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { apiReference } from '@scalar/hono-api-reference';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';

// Load environment variables from .env file
config();

const app = new OpenAPIHono<{ Bindings: AppBindings }>();

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

// OpenAPI Documentation
app.doc('/doc', {
    openapi: '3.0.0',
    info: {
        version: '1.0.0',
        title: 'Auth API',
        description: 'API for handling user authentication via WorkOS',
    },
});

/*
// Swagger UI / API Reference
app.get(
    '/reference',
    apiReference({
        spec: {
            url: '/doc',
        },
    } as any)
);
*/

// POST /auth/exchange - Exchange code for token
// POST /auth/exchange - Exchange code for token
app.post('/auth/exchange', async (c) => {
    try {
        const body = await c.req.json();
        const { code } = body;

        // Additional manual validation (zod handles type, but existing logic had trim check)
        if (!code.trim().length) {
            return c.json({ error: 'Authorization code is required' }, 400);
        }

        // Validate code format (basic alphanumeric + common OAuth chars)
        if (!/^[A-Za-z0-9_-]+$/.test(code)) {
            return c.json({ error: 'Invalid code format' }, 400);
        }

        const logger = new LoggerService(c.env.POSTHOG_API_KEY);
        const authService = new AuthService(c.env.WORKOS_API_KEY!, c.env.WORKOS_CLIENT_ID!, logger);

        const authResponse = await authService.authenticateWithCode(code);

        // Decode access token to get actual expiry
        const decoded = decodeJwt(authResponse.accessToken);
        const expiresIn = decoded.exp ? decoded.exp - Math.floor(Date.now() / 1000) : 1800; // Default 30 min

        // Store session in secure HTTP-only cookie
        const sessionData = {
            accessToken: authResponse.accessToken,
            refreshToken: authResponse.refreshToken,
            user: authResponse.user,
        };

        setCookie(c, SESSION_COOKIE_NAME, JSON.stringify(sessionData), COOKIE_OPTIONS);

        return c.json({
            success: true,
            user: authResponse.user,
            expiresIn,
        });

    } catch (error: any) {
        const logger = new LoggerService(c.env.POSTHOG_API_KEY);

        // Handle specific WorkOS error types
        if (error.code === 'email_verification_required') {
            return c.json({
                error: 'EMAIL_VERIFICATION_REQUIRED',
                message: 'Please verify your email before signing in'
            }, 401);
        }

        if (error.code === 'invalid_grant') {
            return c.json({
                error: 'INVALID_CODE',
                message: 'Authorization code is invalid or expired'
            }, 401);
        }

        logger.error('Authentication failed', error);

        return c.json({
            error: 'AUTHENTICATION_FAILED',
            message: 'Authentication failed. Please try again.'
        }, 401);
    }
}
);

// GET /auth/user - Get current user
// GET /auth/user - Get current user
app.get('/auth/user', async (c) => {
    try {
        // Get session from HTTP-only cookie
        const sessionCookie = getCookie(c, SESSION_COOKIE_NAME);

        if (!sessionCookie) {
            return c.json({ error: 'No session found' }, 401);
        }

        // Parse session data
        const sessionData = JSON.parse(sessionCookie);
        const logger = new LoggerService(c.env.POSTHOG_API_KEY);
        const authService = new AuthService(c.env.WORKOS_API_KEY!, c.env.WORKOS_CLIENT_ID!, logger);

        // Verify token is still valid by fetching user
        const user = await authService.getUser(sessionData.accessToken);

        return c.json(user);

    } catch (error: any) {
        const logger = new LoggerService(c.env.POSTHOG_API_KEY);

        // Check if token expired
        if (error.message?.includes('expired') || error.code === 'token_expired') {
            logger.info('Access token expired, refresh needed');
            return c.json({
                error: 'TOKEN_EXPIRED',
                message: 'Session expired. Please refresh your token.'
            }, 401);
        }

        logger.error('Failed to get user', error);

        return c.json({
            error: 'INVALID_SESSION',
            message: 'Invalid or expired session'
        }, 401);
    }
}
);

// POST /auth/refresh - Refresh token
// POST /auth/refresh - Refresh token
app.post('/auth/refresh', async (c) => {
    try {
        // Get refresh token from cookie session
        const sessionCookie = getCookie(c, SESSION_COOKIE_NAME);

        if (!sessionCookie) {
            return c.json({ error: 'No session found' }, 401);
        }

        const sessionData = JSON.parse(sessionCookie);

        if (!sessionData.refreshToken) {
            return c.json({ error: 'No refresh token in session' }, 401);
        }

        const logger = new LoggerService(c.env.POSTHOG_API_KEY);
        const authService = new AuthService(c.env.WORKOS_API_KEY!, c.env.WORKOS_CLIENT_ID!, logger);

        logger.info('Refreshing access token');

        // Exchange refresh token for new tokens (WorkOS rotates refresh tokens automatically)
        const authResponse = await authService.authenticateWithRefreshToken(sessionData.refreshToken);

        // Decode new access token to get actual expiry
        const decoded = decodeJwt(authResponse.accessToken);
        const expiresIn = decoded.exp ? decoded.exp - Math.floor(Date.now() / 1000) : 1800;

        // Update session cookie with new tokens (token rotation)
        const newSessionData = {
            accessToken: authResponse.accessToken,
            refreshToken: authResponse.refreshToken, // New refresh token from WorkOS
            user: authResponse.user,
        };

        setCookie(c, SESSION_COOKIE_NAME, JSON.stringify(newSessionData), COOKIE_OPTIONS);

        logger.info('Token refresh successful');

        return c.json({
            success: true,
            expiresIn,
            user: authResponse.user,
        });

    } catch (error: any) {
        const logger = new LoggerService(c.env.POSTHOG_API_KEY);

        // Handle specific errors
        if (error.code === 'invalid_grant') {
            logger.warn('Refresh token invalid or expired');
            // Clear invalid session
            setCookie(c, SESSION_COOKIE_NAME, '', CLEAR_COOKIE_OPTIONS);
            return c.json({
                error: 'INVALID_REFRESH_TOKEN',
                message: 'Refresh token is invalid or expired. Please sign in again.'
            }, 401);
        }

        logger.error('Token refresh failed', error);

        return c.json({
            error: 'REFRESH_FAILED',
            message: 'Failed to refresh token. Please try again.'
        }, 401);
    }
}
);

// POST /auth/logout - Logout
// POST /auth/logout - Logout
app.post('/auth/logout', async (c) => {
    try {
        const logger = new LoggerService(c.env.POSTHOG_API_KEY);
        const sessionCookie = getCookie(c, SESSION_COOKIE_NAME);

        if (!sessionCookie) {
            // No session to logout from
            return c.json({ success: true });
        }

        // Parse session to get access token
        const sessionData = JSON.parse(sessionCookie);
        const accessToken = sessionData.accessToken;

        // Decode JWT to get session ID (sid claim)
        const decoded = decodeJwt(accessToken);
        const sessionId = decoded.sid as string;

        if (sessionId) {
            // Create WorkOS client and get logout URL
            const authService = new AuthService(c.env.WORKOS_API_KEY!, c.env.WORKOS_CLIENT_ID!, logger);
            const logoutUrl = authService.getLogoutUrl(sessionId);

            logger.info('User logging out', { sessionId });

            // Clear session cookie
            setCookie(c, SESSION_COOKIE_NAME, '', CLEAR_COOKIE_OPTIONS);

            return c.json({
                success: true,
                logoutUrl, // Client should redirect to this URL
            });
        } else {
            logger.warn('No session ID found in token');
            // Clear cookie anyway
            setCookie(c, SESSION_COOKIE_NAME, '', CLEAR_COOKIE_OPTIONS);
            return c.json({ success: true });
        }

    } catch (error: any) {
        const logger = new LoggerService(c.env.POSTHOG_API_KEY);
        logger.error('Logout error', error);

        // Even on error, clear the local session
        setCookie(c, SESSION_COOKIE_NAME, '', CLEAR_COOKIE_OPTIONS);

        return c.json({ success: true });
    }
}
);

export default class extends Service<Env> {
    async fetch(request: Request): Promise<Response> {
        return app.fetch(request, this.env);
    }
}
