import { serve } from '@hono/node-server';
import { app } from './index';
import { LocalD1Mock } from '../shared/LocalD1Mock';

const port = parseInt(process.env.PORT || '3001');
console.log(`Analysis Coordinator server is running on port ${port}`);

// Initialize local mock DB
const mockDb = new LocalD1Mock('.dev.db') as any;

serve({
  fetch: (request) => {
    return app.fetch(request, {
      ...process.env,
      TRACKING_DB: mockDb
    });
  },
  port
});
