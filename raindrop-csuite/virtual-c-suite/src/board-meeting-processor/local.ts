import { serve } from '@hono/node-server';
import { Hono } from 'hono';

const app = new Hono();

app.get('/health', (c) => c.json({ status: 'ok', service: 'board-meeting-processor' }));

const port = parseInt(process.env.PORT || '3002');
console.log(`Board Meeting Processor (Health Server) running on port ${port}`);

serve({
  fetch: app.fetch,
  port
});
