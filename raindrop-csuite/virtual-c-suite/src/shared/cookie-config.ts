/**
 * Secure cookie configuration for WorkOS session management
 *
 * Security features:
 * - httpOnly: Prevents JavaScript access (XSS protection)
 * - secure: HTTPS only (prevents MITM attacks)
 * - sameSite: CSRF protection
 * - path: Cookie scope
 */

export const COOKIE_OPTIONS = {
    httpOnly: true,      // Prevents JavaScript access via document.cookie
    secure: process.env.NODE_ENV === 'production',  // HTTPS only in production
    sameSite: 'strict' as const,  // Strict CSRF protection
    path: '/',           // Cookie available for entire domain
    maxAge: 1800000,     // 30 minutes (matches recommended access token duration)
};

export const SESSION_COOKIE_NAME = 'wos-session';

/**
 * Cookie options for clearing/expiring cookies
 */
export const CLEAR_COOKIE_OPTIONS = {
    ...COOKIE_OPTIONS,
    maxAge: 0,  // Expire immediately
};
