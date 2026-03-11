import { NextResponse } from 'next/server';
import { getProspectProcessingJob } from '@/lib/db';
import { processProspectJob } from '@/lib/prospect-processor';
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

    const job = getProspectProcessingJob(jobId);
    assertProcessAction(job, 404, 'Job not found');
    assertProcessAction(job.status === 'pending', 409, `Job is already ${job.status}`);

    runInBackground(`prospect-processing/start job ${jobId}`, () => processProspectJob(jobId));

    return NextResponse.json({ message: 'Processing started', jobId });
  } catch (error) {
    return processActionErrorResponse('Failed to start processing', error, 'Failed to start processing');
  }
}
