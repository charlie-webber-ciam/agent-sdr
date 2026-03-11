import { NextResponse } from 'next/server';
import { processActivitySummarizationJob } from '@/lib/activity-summarization-processor';
import { getCategorizationJob } from '@/lib/db';
import {
  assertProcessAction,
  parseJobId,
  parseJsonBody,
  processActionErrorResponse,
  runInBackground,
} from '@/lib/process-action-utils';

export async function POST(request: Request) {
  try {
    const body = await parseJsonBody<{ jobId?: unknown }>(request);
    const jobId = parseJobId(body.jobId);
    const job = getCategorizationJob(jobId);
    assertProcessAction(job, 404, 'Activity summarization job not found');
    assertProcessAction(job.status === 'pending', 409, `Job is ${job.status}. Only pending jobs can be started.`);

    runInBackground(`activity-summarization/start job ${jobId}`, () => processActivitySummarizationJob(jobId));

    return NextResponse.json({
      success: true,
      message: `Started activity summarization job ${jobId}`,
      jobId,
    });
  } catch (error) {
    return processActionErrorResponse(
      'Failed to start activity summarization job',
      error,
      'Failed to start activity summarization job'
    );
  }
}
