import { Ai, Annotation, App, Bucket, KvCache, Logger, MRNObject, ServiceStub, SqlDatabase, Tracer } from '@liquidmetal-ai/raindrop-framework';

// Import service types for stubs (using loose typing or dynamic imports if needed, 
// but here we try to match the generated file structure if possible, 
// or use 'any' / generic ServiceStub if specific types are hard to resolve centrally)
// For now, we'll use 'any' for the service generic to avoid circular type dependencies 
// or path issues until the project structure is fully understood.
type AnyService = any;

// 1. Define the type for ALL shared environment variables and secrets.
// This is the single hydration point for type safety.
export type AppBindings = {
    // Shared Configuration & Secrets
    ALLOWED_ORIGINS?: string;
    JWT_ISSUER?: string;
    JWT_AUDIENCE?: string;
    RATE_LIMIT_PER_USER?: string;
    POSTHOG_API_KEY?: string;
    NODE_ENV?: 'development' | 'production';

    // Raindrop Infrastructure (Common)
    _raindrop: {
        app: App;
    };
    AI: Ai;
    annotation: Annotation<Omit<MRNObject, 'type' | 'applicationName' | 'versionId'>>;
    INPUT_BUCKET: Bucket;
    logger: Logger;
    mem: KvCache;
    OUTPUT_BUCKET: Bucket;
    tracer: Tracer;
    TRACKING_DB: SqlDatabase;

    // Service Stubs (Optional as they depend on the service context)
    ANALYSIS_COORDINATOR?: ServiceStub<AnyService>;
    UPLOAD_API?: ServiceStub<AnyService>;
};

// 2. Define the generic Hono type that includes the bindings
// This makes the Hono type easily importable.
import { Hono } from 'hono';
export type AppHono = Hono<{ Bindings: AppBindings }>;
