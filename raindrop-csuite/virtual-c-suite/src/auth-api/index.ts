import { Env } from './raindrop.gen';
import { AuthService } from '../services/authentication/AuthService';
import { LoggerService } from '../services/Logger/LoggerService';
import { createHonoApp } from '../utils/create-app';
import { Service } from '@liquidmetal-ai/raindrop-framework';
import { cors } from '../_app/cors';
import { COOKIE_OPTIONS, SESSION_COOKIE_NAME, CLEAR_COOKIE_OPTIONS } from '../shared/cookie-config';
import { getCookie, setCookie } from 'hono/cookie';

const app = createHonoApp();

// Health check endpoint
app.get('/health', (c) => {
    return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/auth/exchange', async (c) => {
    try {
        const { idToken } = await c.req.json();

        // Input validation
        if (!idToken || typeof idToken !== 'string' || idToken.trim().length === 0) {
            return c.json({ error: 'ID token is required' }, 400);
        }

        const logger = new LoggerService(c.env.POSTHOG_API_KEY);
        const projectId = process.env.FIREBASE_PROJECT_ID || '';
        const authService = new AuthService(projectId, c.env.mem, logger);

        // Verify the ID token
        const decodedToken = await authService.verifyIdToken(idToken);

        // Create session cookie (14 days)
        const expiresIn = 60 * 60 * 24 * 14 * 1000; // 14 days in milliseconds
        const sessionCookie = await authService.createSessionCookie(idToken, expiresIn);

        // Get user details
        const userRecord = await authService.getUser(decodedToken.uid);

        // Store session in secure HTTP-only cookie
        setCookie(c, SESSION_COOKIE_NAME, sessionCookie, COOKIE_OPTIONS);

        return c.json({
            success: true,
            user: {
                uid: userRecord.uid,
                email: userRecord.email,
                displayName: userRecord.displayName,
                photoURL: userRecord.photoURL,
            },
            expiresIn: expiresIn / 1000, // Return in seconds
        });

    } catch (error: any) {
        const logger = new LoggerService(c.env.POSTHOG_API_KEY);

        // Handle specific Firebase error types
        if (error.code === 'auth/email-not-verified') {
            return c.json({
                error: 'EMAIL_VERIFICATION_REQUIRED',
                message: 'Please verify your email before signing in'
            }, 401);
        }

        if (error.code === 'auth/invalid-id-token' || error.code === 'auth/argument-error') {
            return c.json({
                error: 'INVALID_TOKEN',
                message: 'ID token is invalid or expired'
            }, 401);
        }

        logger.error('Authentication failed', error);

        return c.json({
            error: 'AUTHENTICATION_FAILED',
            message: 'Authentication failed. Please try again.'
        }, 401);
    }
});

app.get('/auth/user', async (c) => {
    try {
        // Get session from HTTP-only cookie
        const sessionCookie = getCookie(c, SESSION_COOKIE_NAME);

        if (!sessionCookie) {
            return c.json({ error: 'No session found' }, 401);
        }

        const logger = new LoggerService(c.env.POSTHOG_API_KEY);
        const projectId = process.env.FIREBASE_PROJECT_ID || '';
        const authService = new AuthService(projectId, c.env.mem, logger);

        // Verify session cookie and get decoded claims
        const decodedClaims = await authService.verifySessionCookie(sessionCookie);

        // Get user details
        const userRecord = await authService.getUser(decodedClaims.uid);

        return c.json({
            uid: userRecord.uid,
            email: userRecord.email,
            displayName: userRecord.displayName,
            photoURL: userRecord.photoURL,
        });

    } catch (error: any) {
        const logger = new LoggerService(c.env.POSTHOG_API_KEY);

        // Check if token expired
        if (error.code === 'auth/session-cookie-expired' || error.code === 'auth/session-cookie-revoked') {
            logger.info('Session cookie expired or revoked');
            return c.json({
                error: 'TOKEN_EXPIRED',
                message: 'Session expired. Please sign in again.'
            }, 401);
        }

        logger.error('Failed to get user', error);

        return c.json({
            error: 'INVALID_SESSION',
            message: 'Invalid or expired session'
        }, 401);
    }
});

app.post('/auth/refresh', async (c) => {
    try {
        const { idToken } = await c.req.json();

        if (!idToken) {
            return c.json({ error: 'ID token is required' }, 401);
        }

        const logger = new LoggerService(c.env.POSTHOG_API_KEY);
        const projectId = process.env.FIREBASE_PROJECT_ID || '';
        const authService = new AuthService(projectId, c.env.mem, logger);

        logger.info('Refreshing session');

        // Verify the new ID token
        const decodedToken = await authService.verifyIdToken(idToken);

        // Create new session cookie (14 days)
        const expiresIn = 60 * 60 * 24 * 14 * 1000; // 14 days in milliseconds
        const sessionCookie = await authService.createSessionCookie(idToken, expiresIn);

        // Get user details
        const userRecord = await authService.getUser(decodedToken.uid);

        // Update session cookie
        setCookie(c, SESSION_COOKIE_NAME, sessionCookie, COOKIE_OPTIONS);

        logger.info('Session refresh successful');

        return c.json({
            success: true,
            expiresIn: expiresIn / 1000,
            user: {
                uid: userRecord.uid,
                email: userRecord.email,
                displayName: userRecord.displayName,
                photoURL: userRecord.photoURL,
            },
        });

    } catch (error: any) {
        const logger = new LoggerService(c.env.POSTHOG_API_KEY);

        // Handle specific errors
        if (error.code === 'auth/invalid-id-token' || error.code === 'auth/argument-error') {
            logger.warn('ID token invalid or expired');
            // Clear invalid session
            setCookie(c, SESSION_COOKIE_NAME, '', CLEAR_COOKIE_OPTIONS);
            return c.json({
                error: 'INVALID_TOKEN',
                message: 'ID token is invalid or expired. Please sign in again.'
            }, 401);
        }

        logger.error('Session refresh failed', error);

        return c.json({
            error: 'REFRESH_FAILED',
            message: 'Failed to refresh session. Please try again.'
        }, 401);
    }
});

app.post('/auth/logout', async (c) => {
    try {
        const logger = new LoggerService(c.env.POSTHOG_API_KEY);
        const sessionCookie = getCookie(c, SESSION_COOKIE_NAME);

        if (!sessionCookie) {
            // No session to logout from
            return c.json({ success: true });
        }

        const projectId = process.env.FIREBASE_PROJECT_ID || '';
        const authService = new AuthService(projectId, c.env.mem, logger);

        // Verify session cookie to get user ID
        const decodedClaims = await authService.verifySessionCookie(sessionCookie);

        logger.info('User logging out', { uid: decodedClaims.uid });

        // Revoke all refresh tokens for this user
        await authService.revokeRefreshTokens(decodedClaims.uid);

        // Clear session cookie
        setCookie(c, SESSION_COOKIE_NAME, '', CLEAR_COOKIE_OPTIONS);

        return c.json({
            success: true,
        });

    } catch (error: any) {
        const logger = new LoggerService(c.env.POSTHOG_API_KEY);
        logger.error('Logout error', error);

        // Even on error, clear the local session
        setCookie(c, SESSION_COOKIE_NAME, '', CLEAR_COOKIE_OPTIONS);

        return c.json({ success: true });
    }
});

export default class extends Service<Env> {
    async fetch(request: Request): Promise<Response> {
        return app.fetch(request, this.env);
    }
}
