import { requireAuthenticated, verifyIssuer } from '@liquidmetal-ai/raindrop-framework/core/auth';

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
    const issuer = env.JWT_ISSUER as string;
    const audience = env.JWT_AUDIENCE as string;

    if (!issuer || !audience) {
        // Fail closed if configuration is missing in production context
        console.error("Auth configuration missing: JWT_ISSUER or JWT_AUDIENCE not set.");
        return false;
    }

    // Call verifyIssuer with request and env. 
    // Assuming verifyIssuer reads issuer/audience from env or is capable of handling standard Env.
    // We explicitly add them to env just in case verifyIssuer looks for specific keys if not found in vars,
    // but usually it reads from env.JWT_ISSUER.
    // We use 'as any' to bypass the specific Env type check if verifyIssuer expects a wider type.
    return await verifyIssuer(request, { ...env, issuer, audience });
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
