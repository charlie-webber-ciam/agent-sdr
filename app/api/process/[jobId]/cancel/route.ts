import { NextResponse } from 'next/server';
import { cancelProcessingJob } from '@/lib/db';

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

    cancelProcessingJob(jobIdNum);
    console.log(`Job ${jobIdNum} cancelled`);

    return NextResponse.json({ success: true, message: 'Job cancelled' });
  } catch (error) {
    console.error('Failed to cancel job:', error);
    return NextResponse.json({ error: 'Failed to cancel job' }, { status: 500 });
  }
}
