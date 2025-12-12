export const AI_PROVIDERS = {
    VULTR: 'vultr',
    SAMBANOVA: 'sambanova',
    CLOUDFLARE: 'cloudflare'
} as const;

export const AI_ERRORS = {
    ANONYMOUS_NOT_ALLOWED: 'Anonymous users are not allowed. Please log in.',
    MISSING_VULTR_KEY: 'Vultr API key is missing. Please update your settings.',
    MISSING_SAMBANOVA_KEY: 'SambaNova API key is missing. Please update your settings.',
    INVALID_PROVIDER_CONFIG: 'Invalid AI provider configuration.'
} as const;

export const AI_DEFAULTS = {
    MODEL: 'llama-3.3-70b'
} as const;
