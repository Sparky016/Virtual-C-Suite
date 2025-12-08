import { requireAuthenticated, verifyIssuer } from '@liquidmetal-ai/raindrop-framework/core/auth';
import { AuthService } from '../services/AuthService';
import { LoggerService } from '../services/LoggerService';
import { SESSION_COOKIE_NAME } from '../shared/cookie-config';
import * as cookie from 'cookie';

/**
 * verify is the application-wide JWT verification hook.
 * @param request The incoming request object.
 * @param env The handler environment object.
 *  **Note**: adds `jwt` property to `env` if verification is successful.
 * @returns true to allow request to continue.
 *
 * DISABLED FOR DEMO: Allows all requests without JWT verification
 */
/**
 * verify is the application-wide JWT verification hook.
 * @param request The incoming request object.
 * @param env The handler environment object.
 *  **Note**: adds `jwt` property to `env` if verification is successful.
 * @returns true to allow request to continue.
 * 
 * Verifies JWT against configured OIDC provider (e.g., WorkOS).
 */
export const verify = async (request: Request, env: any) => {
    try {
        // Parse cookies from header
        const cookieHeader = request.headers.get('Cookie');
        if (!cookieHeader) {
            return false;
        }

        const cookies = cookie.parse(cookieHeader);
        const sessionCookie = cookies[SESSION_COOKIE_NAME];

        if (!sessionCookie) {
            return false;
        }

        const logger = new LoggerService(env.POSTHOG_API_KEY);
        const projectId = process.env.FIREBASE_PROJECT_ID || '';
        const authService = new AuthService(projectId, env.mem, logger);

        // Verify session cookie
        const decodedClaims = await authService.verifySessionCookie(sessionCookie);

        // Add user info to env for downstream use
        env.user = decodedClaims;

        return true;

    } catch (error) {
        console.error('Auth verification failed', error);
        return false;
    }
};

/**
 * authorize is the application-wide authorization hook.
 * @param request The incoming request object.
 * @param env The handler environment object with env.jwt set by verify.
 * @returns true if authorized, false otherwise.
 *
 * Enforces that a valid JWT was present and verified.
 */
export const authorize = requireAuthenticated;
