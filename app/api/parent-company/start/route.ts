import { NextResponse } from 'next/server';
import { processParentCompanyJob } from '@/lib/parent-company-processor';
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
    assertProcessAction(job, 404, 'Parent company job not found');
    assertProcessAction(job.status === 'pending', 409, `Job is ${job.status}. Only pending jobs can be started.`);

    runInBackground(`parent-company/start job ${jobId}`, () => processParentCompanyJob(jobId));

    return NextResponse.json({
      success: true,
      message: `Started parent company job ${jobId}`,
      jobId,
    });
  } catch (error) {
    return processActionErrorResponse(
      'Failed to start parent company job',
      error,
      'Failed to start parent company job'
    );
  }
}
