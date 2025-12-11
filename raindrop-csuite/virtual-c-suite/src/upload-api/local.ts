import { serve } from '@hono/node-server';
import { app } from './index';
import { AppBindings } from '../config/env';
import { MockBucket, MockD1Database } from '../utils/local-mocks';

const port = parseInt(process.env.PORT || '3000');
console.log(`Upload API server is running on port ${port}`);

const mockEnv: AppBindings = {
  // Raindrop Infrastructure
  _raindrop: {} as any,
  AI: {} as any,
  annotation: {} as any,
  INPUT_BUCKET: new MockBucket() as any,
  logger: console as any, // Simple console logger for local
  mem: {} as any,
  OUTPUT_BUCKET: new MockBucket() as any,
  tracer: {} as any,
  TRACKING_DB: new MockD1Database() as any,

  // Config
  ALLOWED_ORIGINS: 'http://localhost:5173,http://localhost:4173',
  NODE_ENV: 'development',
  POSTHOG_API_KEY: 'mock-posthog-key', // Prevent analytics errors
  RATE_LIMIT_PER_USER: '100'
};

serve({
  fetch: (request) => app.fetch(request, mockEnv),
  port
});
