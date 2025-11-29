// analysis-coordinator service

import { buildPrompt, synthesize } from './utils';
import { ExecutiveAnalysis, SynthesisResult, Env } from './interfaces';

export { buildPrompt, synthesize };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return new Response('Not implemented', { status: 501 });
  }
};
