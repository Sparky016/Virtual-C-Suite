import { Context, Next } from 'hono';
import { AuthService } from '../services/authentication/AuthService';
import { LoggerService } from '../services/Logger/LoggerService';
import { SESSION_COOKIE_NAME, COOKIE_OPTIONS, CLEAR_COOKIE_OPTIONS } from '../shared/cookie-config';
import { decodeJwt } from 'jose';
import { getCookie, setCookie } from 'hono/cookie';

// Simple in-memory mock KV cache for local development
const mockKvCache = {
    cache: new Map<string, any>(),
    async get<T>(key: string): Promise<T | null> {
        return this.cache.get(key) || null;
    },
    async put(key: string, value: any, options?: { expirationTtl?: number }): Promise<void> {
        this.cache.set(key, value);
    }
};

/**
 * Secure authentication middleware using HTTP-only cookies
 *
 * Features:
 * - Validates session from secure HTTP-only cookie
 * - Automatically refreshes expired access tokens
 * - Attaches user to request context
 * - Zero Trust approach: authentication required by default
 */
export const authMiddleware = async (c: Context, next: Next) => {
    try {
        const logger = new LoggerService(c.env.POSTHOG_API_KEY);

        // Get session from HTTP-only cookie
        const sessionCookie = getCookie(c, SESSION_COOKIE_NAME);

        if (!sessionCookie) {
            return c.json({ error: 'No session found. Please sign in.' }, 401);
        }

        try {
            const projectId = process.env.FIREBASE_PROJECT_ID || '';
            const kvCache = (c.env as any).mem || mockKvCache;
            const authService = new AuthService(projectId, kvCache, logger);

            // Verify session cookie
            const decodedClaims = await authService.verifySessionCookie(sessionCookie);

            // Attach user to context
            // decodedClaims contains uid, email, etc.
            c.set('user', decodedClaims);

            // Note: We don't have an "accessToken" in the same sense as WorkOS here for the context 
            // unless we want to treat the session cookie as the token or fetch a fresh one.
            // For now, we'll just set the user.

        } catch (authError: any) {
            logger.error('Session verification failed', authError);

            if (authError.code === 'auth/session-cookie-expired') {
                setCookie(c, SESSION_COOKIE_NAME, '', CLEAR_COOKIE_OPTIONS);
                return c.json({ error: 'Session expired. Please sign in again.' }, 401);
            }

            setCookie(c, SESSION_COOKIE_NAME, '', CLEAR_COOKIE_OPTIONS);
            return c.json({ error: 'Invalid session. Please sign in again.' }, 401);
        }

        await next();

    } catch (error: any) {
        const logger = new LoggerService(c.env.POSTHOG_API_KEY);
        logger.error('Auth middleware error', {
            error: error.message,
            code: error.code,
        });

        return c.json({
            error: 'Authentication failed',
            message: error.message
        }, 401);
    }
};
