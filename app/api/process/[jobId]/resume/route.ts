import { NextResponse } from 'next/server';
import { getJob, resumeProcessingJob } from '@/lib/db';
import { isJobActive, processJob } from '@/lib/processor';
import {
  assertProcessAction,
  parseJobId,
  processActionErrorResponse,
  runInBackground,
} from '@/lib/process-action-utils';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;
    const jobIdNum = parseJobId(jobId);

    const job = getJob(jobIdNum);
    assertProcessAction(job, 404, 'Job not found');
    assertProcessAction(job.status === 'processing', 409, `Job is ${job.status}. Only processing jobs can be resumed.`);
    assertProcessAction(!(job.paused !== 1 && isJobActive(jobIdNum)), 409, 'Job is already running');

    resumeProcessingJob(jobIdNum);
    console.log(`Job ${jobIdNum} resumed`);

    // If the processing loop is not running (e.g. after a server restart),
    // re-launch it so the job actually continues.
    if (!isJobActive(jobIdNum)) {
      console.log(`Job ${jobIdNum} has no active processing loop — re-launching`);
      runInBackground(`process/resume job ${jobIdNum}`, () => processJob(jobIdNum));
    }

    return NextResponse.json({ success: true, message: 'Job resumed' });
  } catch (error) {
    return processActionErrorResponse('Failed to resume job', error, 'Failed to resume job');
  }
}
