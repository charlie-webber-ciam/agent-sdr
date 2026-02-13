import { NextResponse } from 'next/server';
import { resumeProcessingJob } from '@/lib/db';
import { isJobActive, processJob } from '@/lib/processor';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;
    const jobIdNum = parseInt(jobId, 10);

    if (isNaN(jobIdNum)) {
      return NextResponse.json({ error: 'Invalid job ID' }, { status: 400 });
    }

    resumeProcessingJob(jobIdNum);
    console.log(`Job ${jobIdNum} resumed`);

    // If the processing loop is not running (e.g. after a server restart),
    // re-launch it so the job actually continues.
    if (!isJobActive(jobIdNum)) {
      console.log(`Job ${jobIdNum} has no active processing loop — re-launching`);
      processJob(jobIdNum).catch(error => {
        console.error(`Background processing failed for resumed job ${jobIdNum}:`, error);
      });
    }

    return NextResponse.json({ success: true, message: 'Job resumed' });
  } catch (error) {
    console.error('Failed to resume job:', error);
    return NextResponse.json({ error: 'Failed to resume job' }, { status: 500 });
  }
}
