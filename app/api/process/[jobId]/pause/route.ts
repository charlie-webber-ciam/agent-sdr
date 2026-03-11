import { NextResponse } from 'next/server';
import { getJob, pauseProcessingJob } from '@/lib/db';
import {
  assertProcessAction,
  parseJobId,
  processActionErrorResponse,
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
    assertProcessAction(job.status === 'processing', 409, `Job is ${job.status}. Only processing jobs can be paused.`);
    assertProcessAction(job.paused !== 1, 409, 'Job is already paused');

    pauseProcessingJob(jobIdNum);
    console.log(`Job ${jobIdNum} paused`);

    return NextResponse.json({ success: true, message: 'Job paused' });
  } catch (error) {
    return processActionErrorResponse('Failed to pause job', error, 'Failed to pause job');
  }
}
