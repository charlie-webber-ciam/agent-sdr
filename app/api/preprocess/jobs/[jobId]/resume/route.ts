import { NextResponse } from 'next/server';
import { resumePreprocessingJob } from '@/lib/db';

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

    resumePreprocessingJob(jobIdNum);
    console.log(`Preprocessing job ${jobIdNum} resumed`);

    return NextResponse.json({ success: true, message: 'Job resumed' });
  } catch (error) {
    console.error('Failed to resume preprocessing job:', error);
    return NextResponse.json({ error: 'Failed to resume job' }, { status: 500 });
  }
}
