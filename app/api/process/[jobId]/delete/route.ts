import { NextResponse } from 'next/server';
import { deleteProcessingJob, getJob } from '@/lib/db';
import { isJobActive } from '@/lib/processor';
import {
  assertProcessAction,
  parseJobId,
  processActionErrorResponse,
} from '@/lib/process-action-utils';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;
    const jobIdNum = parseJobId(jobId);

    const job = getJob(jobIdNum);
    assertProcessAction(job, 404, 'Job not found');
    assertProcessAction(job.status !== 'processing', 409, 'Processing jobs cannot be deleted');
    assertProcessAction(!isJobActive(jobIdNum), 409, 'Job still has an active processing loop');

    const success = deleteProcessingJob(jobIdNum);
    assertProcessAction(success, 500, 'Failed to delete job');

    console.log(`Job ${jobIdNum} deleted`);

    return NextResponse.json({ success: true, message: 'Job deleted' });
  } catch (error) {
    return processActionErrorResponse('Failed to delete job', error, 'Failed to delete job');
  }
}
