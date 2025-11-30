import {
  BucketEventNotification,
  Each,
  Message,
} from "@liquidmetal-ai/raindrop-framework";
import { Env } from './raindrop.gen';
import { getCFOPrompt, getCMOPrompt, getCOOPrompt, getCEOSynthesisPrompt, formatFinalReport } from '../shared/prompts';
import { generateSpeech, VOICE_IDS } from '../shared/elevenlabs';

export default class extends Each<BucketEventNotification, Env> {
  async process(message: Message<BucketEventNotification>): Promise<void> {
    const event = message.body;

    console.log('Bucket event received:', {
      action: event.action,
      bucket: event.bucket,
      objectKey: event.object.key,
      size: event.object.size,
      eventTime: event.eventTime,
      timestamp: new Date().toISOString()
    });

    if (event.action === 'PutObject' || event.action === 'CompleteMultipartUpload') {
      await this.handleFileUpload(event);
    }
  }

  // === File Upload Handler ===
  private async handleFileUpload(event: BucketEventNotification): Promise<void> {
    const startTime = Date.now();
    let requestId: string | undefined;

    try {
      console.log(`Processing uploaded file: ${event.object.key}`);

      // Extract request ID from object metadata or key
      const file = await this.env.INPUT_BUCKET.get(event.object.key);
      if (!file) {
        console.error('File not found in bucket:', event.object.key);
        return;
      }

      requestId = file.customMetadata?.requestId as string;
      if (!requestId) {
        console.error('No requestId in metadata');
        return;
      }

      console.log(`Starting analysis for request: ${requestId}`);

      // Read file content
      const fileContent = await file.text();
      console.log(`File content length: ${fileContent.length} characters`);

      // SCATTER: Parallel AI analysis from three expert perspectives
      console.log('Starting parallel AI analysis...');
      const aiStartTime = Date.now();

      const [cfoResult, cmoResult, cooResult] = await Promise.all([
        // CFO Analysis
        this.env.AI.run('llama-3.3-70b', {
          model: 'llama-3.3-70b',
          messages: [{ role: 'user', content: getCFOPrompt(fileContent) }],
          temperature: 0.7,
          max_tokens: 800
        }),

        // CMO Analysis
        this.env.AI.run('llama-3.3-70b', {
          model: 'llama-3.3-70b',
          messages: [{ role: 'user', content: getCMOPrompt(fileContent) }],
          temperature: 0.7,
          max_tokens: 800
        }),

        // COO Analysis
        this.env.AI.run('llama-3.3-70b', {
          model: 'llama-3.3-70b',
          messages: [{ role: 'user', content: getCOOPrompt(fileContent) }],
          temperature: 0.7,
          max_tokens: 800
        })
      ]);

      const aiDuration = Date.now() - aiStartTime;
      console.log(`Parallel AI analysis completed in ${aiDuration}ms`);

      // Extract analysis text
      const cfoAnalysis = cfoResult.choices[0]?.message?.content || 'Analysis unavailable';
      const cmoAnalysis = cmoResult.choices[0]?.message?.content || 'Analysis unavailable';
      const cooAnalysis = cooResult.choices[0]?.message?.content || 'Analysis unavailable';

      // Store individual executive analyses in database
      const createdAt = Date.now();
      await Promise.all([
        this.env.TRACKING_DB.prepare(
          `INSERT INTO executive_analyses (request_id, executive_role, analysis_text, created_at)
           VALUES (?, ?, ?, ?)`
        ).bind(requestId, 'CFO', cfoAnalysis, createdAt).run(),

        this.env.TRACKING_DB.prepare(
          `INSERT INTO executive_analyses (request_id, executive_role, analysis_text, created_at)
           VALUES (?, ?, ?, ?)`
        ).bind(requestId, 'CMO', cmoAnalysis, createdAt).run(),

        this.env.TRACKING_DB.prepare(
          `INSERT INTO executive_analyses (request_id, executive_role, analysis_text, created_at)
           VALUES (?, ?, ?, ?)`
        ).bind(requestId, 'COO', cooAnalysis, createdAt).run()
      ]);

      // GATHER: CEO Synthesis
      console.log('Starting CEO synthesis...');
      const synthesisStartTime = Date.now();

      const ceoResult = await this.env.AI.run('llama-3.3-70b', {
        model: 'llama-3.3-70b',
        messages: [{ role: 'user', content: getCEOSynthesisPrompt(cfoAnalysis, cmoAnalysis, cooAnalysis) }],
        temperature: 0.8,
        max_tokens: 1000
      });

      const synthesisDuration = Date.now() - synthesisStartTime;
      console.log(`CEO synthesis completed in ${synthesisDuration}ms`);

      const ceoSynthesis = ceoResult.choices[0]?.message?.content || 'Synthesis unavailable';

      // Generate final report
      let finalReport = formatFinalReport(
        requestId,
        cfoAnalysis,
        cmoAnalysis,
        cooAnalysis,
        ceoSynthesis
      );

      // Generate Audio for the report (CEO Synthesis)
      console.log('Generating audio for CEO synthesis...');
      let audioKey: string | undefined;
      try {
        const apiKey = (this.env as any).ELEVENLABS_API_KEY;
        if (apiKey) {
          const audioBuffer = await generateSpeech(ceoSynthesis, VOICE_IDS.CEO, apiKey);
          audioKey = `reports/${requestId}/ceo-synthesis.mp3`;
          await this.env.OUTPUT_BUCKET.put(audioKey, new Uint8Array(audioBuffer), {
            httpMetadata: { contentType: 'audio/mpeg' }
          });
          console.log(`Audio generated and saved to ${audioKey}`);
        } else {
          console.warn('ELEVENLABS_API_KEY not found in environment');
        }
      } catch (error) {
        console.error('Failed to generate audio:', error);
      }

      // Append audio link to final report if generated
      if (audioKey) {
        const audioNote = `\n\n## 🎧 Audio Summary\n\nAn audio version of the CEO synthesis is available: [Play Audio](/api/file/${encodeURIComponent(audioKey)})`;
        finalReport += audioNote;
      }

      // Save report to output bucket
      const reportKey = `reports/${requestId}/final-report.md`;
      await this.env.OUTPUT_BUCKET.put(reportKey, finalReport);

      // Store final report in database
      const reportCreatedAt = Date.now();
      await this.env.TRACKING_DB.prepare(
        `INSERT INTO final_reports (request_id, report_content, report_key, created_at)
         VALUES (?, ?, ?, ?)`
      ).bind(requestId, finalReport, reportKey, reportCreatedAt).run();

      // Update request status to completed
      const completedAt = Date.now();
      await this.env.TRACKING_DB.prepare(
        `UPDATE analysis_requests
         SET status = ?, completed_at = ?
         WHERE request_id = ?`
      ).bind('completed', completedAt, requestId).run();

      const totalDuration = Date.now() - startTime;
      console.log(`Total processing completed in ${totalDuration}ms for request ${requestId}`);

    } catch (error) {
      console.error('Error processing file:', error);

      // Update request status to failed
      if (requestId) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        await this.env.TRACKING_DB.prepare(
          `UPDATE analysis_requests
           SET status = ?, error_message = ?
           WHERE request_id = ?`
        ).bind('failed', errorMessage, requestId).run();
      }
    }
  }
}
