import { NextResponse } from 'next/server';
import { processEnrichmentJob } from '@/lib/enrichment-processor';
import { getEnrichmentJob } from '@/lib/db';
import {
  assertProcessAction,
  parseJobId,
  parseJsonBody,
  processActionErrorResponse,
  runInBackground,
} from '@/lib/process-action-utils';

/**
 * POST /api/enrichment/start
 *
 * Starts processing an enrichment job in the background.
 *
 * Body:
 * - jobId: number - the enrichment job ID to process
 */
export async function POST(request: Request) {
  try {
    const body = await parseJsonBody<{ jobId?: unknown }>(request);
    const jobId = parseJobId(body.jobId);
    const job = getEnrichmentJob(jobId);
    assertProcessAction(job, 404, 'Enrichment job not found');
    assertProcessAction(job.status === 'pending', 409, `Job is ${job.status}. Only pending jobs can be started.`);

    runInBackground(`enrichment/start job ${jobId} (${job.type})`, () => processEnrichmentJob(jobId));

    return NextResponse.json({
      success: true,
      message: `Started enrichment job ${jobId}`,
      jobId,
      type: job.type,
    });
  } catch (error) {
    return processActionErrorResponse(
      'Failed to start enrichment job',
      error,
      'Failed to start enrichment job'
    );
  }
}
