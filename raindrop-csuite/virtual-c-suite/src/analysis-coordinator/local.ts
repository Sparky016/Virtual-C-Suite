import { serve } from '@hono/node-server';
import { app } from './index';

const port = parseInt(process.env.PORT || '3001');
console.log(`Analysis Coordinator server is running on port ${port}`);

serve({
  fetch: app.fetch,
  port
});
