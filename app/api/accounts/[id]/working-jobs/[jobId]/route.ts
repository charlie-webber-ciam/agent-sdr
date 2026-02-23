import { NextResponse } from 'next/server';
import { getAccountWorkingJob } from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; jobId: string }> }
) {
  try {
    const { jobId: jobIdStr } = await params;
    const jobId = parseInt(jobIdStr);

    if (isNaN(jobId)) {
      return NextResponse.json({ error: 'Invalid job ID' }, { status: 400 });
    }

    const job = getAccountWorkingJob(jobId);
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    return NextResponse.json({ job });
  } catch (error) {
    console.error('Failed to get account working job:', error);
    return NextResponse.json(
      { error: 'Failed to get job' },
      { status: 500 }
    );
  }
}
