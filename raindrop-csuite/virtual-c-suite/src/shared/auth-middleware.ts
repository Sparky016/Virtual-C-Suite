import { Context, Next } from 'hono';
import { AuthService } from '../services/AuthService';
import { LoggerService } from '../services/LoggerService';
import { SESSION_COOKIE_NAME, COOKIE_OPTIONS, CLEAR_COOKIE_OPTIONS } from './cookie-config';
import { decodeJwt } from 'jose';
import { getCookie, setCookie } from 'hono/cookie';

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

        // Ensure WorkOS configuration is available
        if (!c.env.WORKOS_API_KEY || !c.env.WORKOS_CLIENT_ID) {
            logger.error('WorkOS configuration missing in environment');
            return c.json({ error: 'Server configuration error' }, 500);
        }

        // Get session from HTTP-only cookie
        const sessionCookie = getCookie(c, SESSION_COOKIE_NAME);

        if (!sessionCookie) {
            return c.json({ error: 'No session found. Please sign in.' }, 401);
        }

        // Parse session data
        let sessionData;
        try {
            sessionData = JSON.parse(sessionCookie);
        } catch (parseError) {
            logger.error('Failed to parse session cookie', parseError);
            setCookie(c, SESSION_COOKIE_NAME, '', CLEAR_COOKIE_OPTIONS);
            return c.json({ error: 'Invalid session. Please sign in again.' }, 401);
        }

        // Check if access token is expired
        const decoded = decodeJwt(sessionData.accessToken);
        const now = Math.floor(Date.now() / 1000);

        if (decoded.exp && decoded.exp < now) {
            // Access token expired - attempt automatic refresh
            logger.info('Access token expired, attempting refresh');

            if (!sessionData.refreshToken) {
                logger.warn('No refresh token available');
                setCookie(c, SESSION_COOKIE_NAME, '', CLEAR_COOKIE_OPTIONS);
                return c.json({ error: 'Session expired. Please sign in again.' }, 401);
            }

            try {
                const authService = new AuthService(
                    c.env.WORKOS_API_KEY,
                    c.env.WORKOS_CLIENT_ID,
                    logger
                );

                // Refresh the access token
                const authResponse = await authService.authenticateWithRefreshToken(
                    sessionData.refreshToken
                );

                // Update session cookie with new tokens
                const newSessionData = {
                    accessToken: authResponse.accessToken,
                    refreshToken: authResponse.refreshToken,
                    user: authResponse.user,
                };

                setCookie(c, SESSION_COOKIE_NAME, JSON.stringify(newSessionData), COOKIE_OPTIONS);

                // Attach refreshed user to context
                c.set('user', authResponse.user);
                c.set('accessToken', authResponse.accessToken);

                logger.info('Token automatically refreshed');

            } catch (refreshError: any) {
                logger.error('Token refresh failed in middleware', refreshError);
                setCookie(c, SESSION_COOKIE_NAME, '', CLEAR_COOKIE_OPTIONS);
                return c.json({
                    error: 'Session expired. Please sign in again.',
                    code: 'SESSION_EXPIRED'
                }, 401);
            }
        } else {
            // Access token still valid
            c.set('user', sessionData.user);
            c.set('accessToken', sessionData.accessToken);
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
