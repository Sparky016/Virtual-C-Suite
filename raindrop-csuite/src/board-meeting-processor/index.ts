// board-meeting-processor bucket event handler

import { BucketEvent, SynthesizedReport, Env } from './interfaces';
import {
  extractRequestIdFromKey,
  fetchFileContent,
  runParallelAnalyses,
  extractRequestIdFromKey,
  fetchFileContent,
  runParallelAnalyses,
  saveReportToOutputBucket,
  saveFinalReport
} from './utils';

async function handleBucketEvent(event: BucketEvent, env: Env): Promise<void> {
  let requestId: string | null = null;

  try {
    requestId = await extractRequestIdFromKey(event.key);

    env.logger.info('Processing board meeting file', {
      requestId,
      key: event.key,
      size: event.size
    });



    const fileContent = await fetchFileContent(event.key, env);

    const analyses = await runParallelAnalyses(fileContent, env);



    const synthesis = await env.ANALYSIS_COORDINATOR.synthesize(analyses, env);

    const report: SynthesizedReport = {
      requestId,
      executiveAnalyses: analyses,
      consolidatedInsights: synthesis.consolidatedInsights,
      actionItems: synthesis.actionItems,
      timestamp: new Date().toISOString()
    };

    const reportUrl = await saveReportToOutputBucket(report, env);

    await saveFinalReport(requestId, reportUrl, env);

    env.logger.info('Board meeting processing completed successfully', {
      requestId,
      reportUrl
    });
  } catch (error) {
    env.logger.error('Board meeting processing failed', {
      requestId,
      key: event.key,
      error: String(error)
    });



    throw error;
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return new Response('Not implemented', { status: 501 });
  }
};

export { handleBucketEvent };
