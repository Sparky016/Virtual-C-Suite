import { serve } from '@hono/node-server';
import { createHonoApp } from '../utils/create-app';

const app = createHonoApp();

const port = parseInt(process.env.PORT || '3000');
console.log(`Upload API server is running on port ${port}`);

serve({
  fetch: app.fetch,
  port
});
