import { NextResponse } from 'next/server';
import { cancelProcessingJob, getJob } from '@/lib/db';
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
    assertProcessAction(job.status !== 'completed', 409, 'Completed jobs cannot be cancelled');
    assertProcessAction(job.status !== 'failed', 409, 'Job is already failed/cancelled');

    cancelProcessingJob(jobIdNum);
    console.log(`Job ${jobIdNum} cancelled`);

    return NextResponse.json({ success: true, message: 'Job cancelled' });
  } catch (error) {
    return processActionErrorResponse('Failed to cancel job', error, 'Failed to cancel job');
  }
}
