import { serve } from '@hono/node-server';
import { app } from './index';

const port = parseInt(process.env.PORT || '3002');
console.log(`Brand API server is running on port ${port}`);

serve({
  fetch: app.fetch,
  port
});
