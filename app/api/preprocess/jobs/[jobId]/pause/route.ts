import { NextResponse } from 'next/server';
import { pausePreprocessingJob } from '@/lib/db';

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

    pausePreprocessingJob(jobIdNum);
    console.log(`Preprocessing job ${jobIdNum} paused`);

    return NextResponse.json({ success: true, message: 'Job paused' });
  } catch (error) {
    console.error('Failed to pause preprocessing job:', error);
    return NextResponse.json({ error: 'Failed to pause job' }, { status: 500 });
  }
}
