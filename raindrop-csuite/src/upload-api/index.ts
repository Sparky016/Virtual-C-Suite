// upload-api Hono application

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import {
  validateUploadRequest,
  storeFileToInputBucket,
  createAnalysisRequest,
  getRequestStatus,
  getReport,
  generateRequestId
} from './utils';
import { Env } from './interfaces';

const app = new Hono<{ Bindings: Env }>();

app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization']
}));

app.post('/upload', async (c) => {
  const env = c.env;

  try {
    const validation = await validateUploadRequest(c.req.raw, env);

    if (!validation.valid || !validation.file) {
      return c.json({ error: validation.error }, 400);
    }

    const requestId = generateRequestId();
    const file = validation.file;

    await storeFileToInputBucket(file, requestId, env);
    await createAnalysisRequest(requestId, file.name, env);

    env.logger.info('File upload processed successfully', { requestId, fileName: file.name });

    return c.json({
      requestId,
      message: 'File uploaded successfully and queued for analysis'
    }, 200);
  } catch (error) {
    env.logger.error('Error processing upload', { error: String(error) });
    return c.json({ error: 'Internal server error' }, 500);
  }
});

app.get('/status/:requestId', async (c) => {
  const env = c.env;
  const requestId = c.req.param('requestId');

  try {
    const status = await getRequestStatus(requestId, env);
    return c.json(status, 200);
  } catch (error) {
    env.logger.warn('Status request failed', { requestId, error: String(error) });
    return c.json({ error: 'Request not found' }, 404);
  }
});

app.get('/reports/:requestId', async (c) => {
  const env = c.env;
  const requestId = c.req.param('requestId');

  try {
    const report = await getReport(requestId, env);
    return c.json(report, 200);
  } catch (error) {
    env.logger.warn('Report request failed', { requestId, error: String(error) });
    return c.json({ error: 'Request not found' }, 404);
  }
});

app.options('*', (c) => {
  return new Response('', { status: 204 });
});

export default app;
