import { NextResponse } from 'next/server';
import { processCategorizationJob } from '@/lib/categorization-processor';
import { getCategorizationJob } from '@/lib/db';
import {
  assertProcessAction,
  parseJobId,
  parseJsonBody,
  processActionErrorResponse,
  runInBackground,
} from '@/lib/process-action-utils';

/**
 * POST /api/categorization/start
 *
 * Starts processing a categorization job in the background.
 *
 * Body:
 * - jobId: number - the categorization job ID to process
 */
export async function POST(request: Request) {
  try {
    const body = await parseJsonBody<{ jobId?: unknown }>(request);
    const jobId = parseJobId(body.jobId);
    const job = getCategorizationJob(jobId);
    assertProcessAction(job, 404, 'Categorization job not found');
    assertProcessAction(job.status === 'pending', 409, `Job is ${job.status}. Only pending jobs can be started.`);

    runInBackground(`categorization/start job ${jobId}`, () => processCategorizationJob(jobId));

    return NextResponse.json({
      success: true,
      message: `Started categorization job ${jobId}`,
      jobId,
    });

  } catch (error) {
    return processActionErrorResponse(
      'Failed to start categorization job',
      error,
      'Failed to start categorization job'
    );
  }
}
