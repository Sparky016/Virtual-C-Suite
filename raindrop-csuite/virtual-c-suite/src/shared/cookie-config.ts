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
    secure: true,        // HTTPS only (required for sameSite: None)
    sameSite: 'None' as const,  // Required for cross-site cookies (frontend on Netlify, backend on Raindrop)
    path: '/',           // Cookie available for entire domain
    maxAge: 432000,      // 5 days in seconds (matches session cookie duration)
};

export const SESSION_COOKIE_NAME = 'session';

/**
 * Cookie options for clearing/expiring cookies
 */
export const CLEAR_COOKIE_OPTIONS = {
    ...COOKIE_OPTIONS,
    maxAge: 0,  // Expire immediately
};
