import { NextResponse } from 'next/server';
import {
  archiveProcessingJob,
  getJob,
  unarchiveProcessingJob,
} from '@/lib/db';
import { isJobActive } from '@/lib/processor';
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
    assertProcessAction(!isJobActive(jobIdNum), 409, 'Job still has an active processing loop');

    if (job.archived === 1) {
      return NextResponse.json({ success: true, message: 'Job already archived' });
    }

    archiveProcessingJob(jobIdNum);
    console.log(`Job ${jobIdNum} archived`);

    return NextResponse.json({ success: true, message: 'Job archived' });
  } catch (error) {
    return processActionErrorResponse('Failed to archive job', error, 'Failed to archive job');
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;
    const jobIdNum = parseJobId(jobId);

    const job = getJob(jobIdNum);
    assertProcessAction(job, 404, 'Job not found');

    if (job.archived !== 1) {
      return NextResponse.json({ success: true, message: 'Job is not archived' });
    }

    unarchiveProcessingJob(jobIdNum);
    console.log(`Job ${jobIdNum} unarchived`);

    return NextResponse.json({ success: true, message: 'Job unarchived' });
  } catch (error) {
    return processActionErrorResponse('Failed to unarchive job', error, 'Failed to unarchive job');
  }
}
