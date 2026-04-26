import { NextResponse } from 'next/server';
import { processBulkEmailJob } from '@/lib/bulk-email-processor';
import { getBulkEmailJob } from '@/lib/db';
import {
  assertProcessAction,
  parseJobId,
  parseJsonBody,
  processActionErrorResponse,
  runInBackground,
} from '@/lib/process-action-utils';

/**
 * POST /api/bulk-email/start
 *
 * Starts processing a bulk email job in the background.
 *
 * Body:
 * - jobId: number
 */
export async function POST(request: Request) {
  try {
    const body = await parseJsonBody<{ jobId?: unknown }>(request);
    const jobId = parseJobId(body.jobId);
    const job = getBulkEmailJob(jobId);
    assertProcessAction(job, 404, 'Bulk email job not found');
    assertProcessAction(job.status === 'pending', 409, `Job is ${job.status}. Only pending jobs can be started.`);

    runInBackground(`bulk-email/start job ${jobId}`, () => processBulkEmailJob(jobId));

    return NextResponse.json({
      success: true,
      message: `Started bulk email job ${jobId}`,
      jobId,
    });
  } catch (error) {
    return processActionErrorResponse(
      'Failed to start bulk email job',
      error,
      'Failed to start bulk email job'
    );
  }
}
