import { NextResponse } from 'next/server';
import { processHqStateJob } from '@/lib/hq-state-processor';
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
    assertProcessAction(job, 404, 'HQ state job not found');
    assertProcessAction(job.status === 'pending', 409, `Job is ${job.status}. Only pending jobs can be started.`);

    runInBackground(`hq-state/start job ${jobId}`, () => processHqStateJob(jobId));

    return NextResponse.json({
      success: true,
      message: `Started HQ state job ${jobId}`,
      jobId,
    });
  } catch (error) {
    return processActionErrorResponse('Failed to start HQ state job', error, 'Failed to start HQ state job');
  }
}
