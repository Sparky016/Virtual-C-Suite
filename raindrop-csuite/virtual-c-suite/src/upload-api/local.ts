import { serve } from '@hono/node-server';
import { app } from './index';
import { LocalD1Mock } from '../shared/LocalD1Mock';
import { LocalBucketMock } from '../shared/LocalBucketMock';
import { AppBindings } from '../config/env';

const port = parseInt(process.env.PORT || '3000');
console.log(`Upload API server is running on port ${port}`);

// Initialize local mocks (Persistent SQLite and Filesystem)
const mockDb = new LocalD1Mock('.dev.db') as any;
const mockBucket = new LocalBucketMock('.dev-buckets/input') as any;

// Create specific mock env with defaults + our mocks
const mockEnv: AppBindings = {
  // Raindrop Infrastructure
  _raindrop: {} as any,
  AI: {} as any,
  annotation: {} as any,
  INPUT_BUCKET: mockBucket,
  logger: console as any,
  mem: {} as any,
  OUTPUT_BUCKET: new LocalBucketMock('.dev-buckets/output') as any,
  tracer: {} as any,
  TRACKING_DB: mockDb,

  // Config
  ALLOWED_ORIGINS: 'http://localhost:5173,http://localhost:4173',
  NODE_ENV: 'development',
  POSTHOG_API_KEY: 'mock-posthog-key',
  RATE_LIMIT_PER_USER: '100'
};

serve({
  fetch: (request) => {
    // Inject mockEnv into the Hono app
    return app.fetch(request, mockEnv);
  },
  port
});
