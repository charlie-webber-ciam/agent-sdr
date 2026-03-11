import { NextResponse } from 'next/server';
import { getJob, getPendingAccounts, resetJobToPending } from '@/lib/db';
import { isJobActive, processJob } from '@/lib/processor';
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
    const jobId = parseJobId(body.jobId, 'jobId');

    // Verify job exists
    const job = getJob(jobId);
    assertProcessAction(job, 404, 'Job not found');
    assertProcessAction(job.status !== 'processing', 409, 'Job is currently processing');
    assertProcessAction(!isJobActive(jobId), 409, 'Job already has an active processing loop');

    // Check if there are pending accounts in this job
    const pendingAccounts = getPendingAccounts(jobId);
    assertProcessAction(pendingAccounts.length > 0, 409, 'No pending accounts found for this job');

    // Reset job status to pending
    resetJobToPending(jobId);

    runInBackground(`process/restart job ${jobId}`, () => processJob(jobId));

    return NextResponse.json({
      success: true,
      message: `Restarted processing for ${pendingAccounts.length} pending accounts`,
      pendingCount: pendingAccounts.length,
    });
  } catch (error) {
    return processActionErrorResponse('Failed to restart processing', error, 'Failed to restart processing');
  }
}
