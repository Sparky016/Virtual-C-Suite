import { serve } from '@hono/node-server';
import { app } from './index';
import { LocalD1Mock } from '../shared/LocalD1Mock';
import { LocalBucketMock } from '../shared/LocalBucketMock';

const port = parseInt(process.env.PORT || '3000');
console.log(`Upload API server is running on port ${port}`);

// Initialize local mocks
const mockDb = new LocalD1Mock('.dev.db') as any;
const mockBucket = new LocalBucketMock('.dev-buckets/input') as any;

serve({
  fetch: (request) => {
    return app.fetch(request, {
      ...process.env,
      TRACKING_DB: mockDb,
      INPUT_BUCKET: mockBucket
    });
  },
  port
});
